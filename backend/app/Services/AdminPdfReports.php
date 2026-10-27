<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\LogbookStatus;
use App\Exceptions\ActionRejected;
use App\Models\Assessment;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\InternProfile;
use App\Models\User;
use App\Support\IndonesianDate;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Dua dokumen PDF untuk ditandatangani basah: Daftar Kehadiran (presensi + logbook per hari kerja, satu intern
 * satu bulan) dan Penilaian (setelah mentor submit). Data disusun di sini; template Blade di `resources/views/pdf`
 * hanya menampilkan dan selalu meng-escape teks.
 *
 * @phpstan-type Identity array{name: string, origin_label: string, origin: string, number_label: string, student_number: string, major: string, unit: string, period: string}
 */
class AdminPdfReports
{
    public const OUTSIDE_PERIOD = 'Bulan yang dipilih di luar periode magang intern ini.';

    public const NO_WORKING_DAYS = 'Belum ada hari kerja yang bisa dicetak pada bulan ini.';

    public const NOT_SUBMITTED = 'Penilaian intern ini belum disubmit mentor.';

    /** Indikator tanpa kategori dikelompokkan di sini. */
    public const OTHER_CATEGORY = 'Lainnya';

    private const STATUS_LABELS = [
        'present' => 'Hadir',
        'late' => 'Terlambat',
        'missed_clock_in' => 'Lupa Clock In',
        'leave' => 'Izin',
        'absent' => 'Tidak Hadir',
    ];

    public function __construct(private AttendanceCalendar $calendar, private SystemSettings $settings) {}

    /**
     * @return array{content: string, filename: string}
     *
     * @throws ActionRejected
     */
    public function attendance(User $admin, User $intern, string $month, CarbonInterface $now): array
    {
        $data = $this->attendanceData($intern, $month, $now);
        $content = Pdf::loadView('pdf.daftar-kehadiran', $data)->setPaper('a4')->output();

        AuditLog::record($admin, AuditLog::ACTION_REPORT, $intern->name, "Export PDF Daftar Kehadiran {$data['month_label']}.");

        return ['content' => $content, 'filename' => 'daftar-kehadiran_'.Str::slug($intern->name)."_{$month}.pdf"];
    }

    /**
     * @return array{content: string, filename: string}
     *
     * @throws ActionRejected
     */
    public function assessment(User $admin, User $intern, CarbonInterface $now): array
    {
        $data = $this->assessmentData($intern, $now);
        $content = Pdf::loadView('pdf.penilaian', $data)->setPaper('a4')->output();

        AuditLog::record($admin, AuditLog::ACTION_REPORT, $intern->name, 'Export PDF Penilaian.');

        return ['content' => $content, 'filename' => 'penilaian_'.Str::slug($intern->name).'.pdf'];
    }

    /**
     * Hanya hari kerja: Libur (akhir pekan, libur kalender) tidak ditampilkan, Izin tetap tampil. Hari ini ikut
     * hanya jika sudah ada presensi atau izin; hari setelah hari ini belum ditampilkan.
     *
     * @return array<string, mixed>
     *
     * @throws ActionRejected
     */
    public function attendanceData(User $intern, string $month, CarbonInterface $now): array
    {
        $intern->loadMissing(['unit:id,name', 'internProfile.airport', 'internProfile.mentor:id,name']);
        /** @var InternProfile $profile */
        $profile = $intern->internProfile;
        $first = Carbon::parse("{$month}-01");
        $from = $first->toDateString();
        $to = $first->copy()->endOfMonth()->toDateString();

        if ($to < $profile->start_date->toDateString() || $from > $profile->end_date->toDateString()) {
            throw new ActionRejected(self::OUTSIDE_PERIOD, 'outside_internship');
        }

        $rows = [];

        foreach ($this->calendar->days($intern, $from, $to, $now) as $date => $day) {
            if ($day['status'] === AttendanceStatus::Holiday || $day['status'] === AttendanceStatus::NotClockedIn) {
                continue;
            }

            /** @var Attendance|null $attendance */
            $attendance = $day['attendance'];
            $logbook = $attendance?->logbook;
            $date = Carbon::parse($date);

            $rows[] = [
                'date' => IndonesianDate::dayName($date).', '.IndonesianDate::withYear($date),
                'clock_in' => self::time($attendance?->clock_in_at),
                'clock_out' => self::time($attendance?->clock_out_at),
                // Draft belum dikirim intern, jadi isinya tidak dicetak.
                'activity' => $logbook === null || $logbook->status === LogbookStatus::Draft ? '-' : $logbook->work,
                'remark' => self::STATUS_LABELS[$day['status']->value]
                    .($day['missed_clock_out'] ? ', Lupa Clock Out' : '')
                    .($day['is_corrected'] ? ' (Dikoreksi)' : ''),
            ];
        }

        if ($rows === []) {
            throw new ActionRejected(self::NO_WORKING_DAYS, 'no_data');
        }

        return [
            ...$this->header($intern, $now),
            'month_label' => IndonesianDate::monthYear($first),
            'rows' => $rows,
            'mentor_name' => $profile->mentor->name,
        ];
    }

    /**
     * Tanggal tanda tangan = tanggal submit penilaian, agar dokumen yang dicetak ulang tetap sama. `predicate`
     * tetap disertakan untuk aplikasi; PDF hanya mencetak daftar rentang nilai.
     *
     * @return array<string, mixed>
     *
     * @throws ActionRejected
     */
    public function assessmentData(User $intern, CarbonInterface $now): array
    {
        $intern->loadMissing(['unit:id,name', 'internProfile.airport']);
        $assessment = Assessment::query()
            ->with(['mentor:id,name', 'scores.indicator'])
            ->where('intern_id', $intern->id)
            ->first();

        if ($assessment === null || ! $assessment->isSubmitted()) {
            throw new ActionRejected(self::NOT_SUBMITTED, 'not_submitted');
        }

        // Dikelompokkan per kategori sesuai urutan indikator; tanpa kategori selalu paling akhir. Nomor kategori
        // dan nomor indikator di dalamnya mulai dari 1, seperti formulir mitra.
        $byCategory = [];
        $uncategorized = [];
        $scores = $assessment->scores->sortBy(fn (AssessmentScore $score): string => sprintf('%010d-%010d', $score->indicator->sort_order, $score->indicator_id));

        foreach ($scores as $score) {
            $row = ['name' => $score->indicator->name, 'score' => $score->value()];
            $category = $score->indicator->category;

            if ($category === null || $category === '') {
                $uncategorized[] = $row;
            } else {
                $byCategory[$category][] = $row;
            }
        }

        if ($uncategorized !== []) {
            $byCategory[self::OTHER_CATEGORY] = [...($byCategory[self::OTHER_CATEGORY] ?? []), ...$uncategorized];
        }

        $groups = [];

        foreach ($byCategory as $category => $rows) {
            $groups[] = [
                'number' => count($groups) + 1,
                'name' => mb_strtoupper((string) $category),
                'indicators' => array_map(fn (array $row, int $i): array => ['number' => $i + 1, ...$row], $rows, array_keys($rows)),
            ];
        }

        $finalScore = (float) $assessment->final_score;

        return [
            ...$this->header($intern, $assessment->submitted_at ?? $now),
            'groups' => $groups,
            'final_score' => number_format($finalScore, 2, ',', '.'),
            'predicate' => Assessments::predicate($finalScore),
            'notes' => $assessment->notes,
            'mentor_name' => $assessment->mentor->name ?? '-',
        ];
    }

    /**
     * @return array{region: string, identity: Identity, place_date: string, intern_name: string}
     */
    private function header(User $intern, CarbonInterface $signedAt): array
    {
        /** @var InternProfile $profile */
        $profile = $intern->internProfile;
        $type = $profile->institution_type;
        $city = $profile->airport->city;

        return [
            'region' => $this->settings->reportRegionName(),
            'identity' => [
                'name' => $intern->name,
                'origin_label' => $type?->originLabel() ?? 'Asal Universitas/Sekolah',
                'origin' => $profile->university,
                'number_label' => $type?->numberLabel() ?? 'NIM/NIS',
                'student_number' => $profile->student_number ?? '-',
                'major' => $profile->major,
                'unit' => $intern->unit->name ?? '-',
                'period' => IndonesianDate::long($profile->start_date).' - '.IndonesianDate::long($profile->end_date),
            ],
            'place_date' => ($city === null || $city === '' ? '' : "{$city}, ").IndonesianDate::long($signedAt),
            'intern_name' => $intern->name,
        ];
    }

    private static function time(?string $time): string
    {
        return $time === null ? '-' : substr($time, 0, 5);
    }
}

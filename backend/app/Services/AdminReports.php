<?php

namespace App\Services;

use App\Enums\AssessmentStatus;
use App\Enums\LeaveType;
use App\Enums\LogbookStatus;
use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\Airport;
use App\Models\AssessmentIndicator;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\InternProfile;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Laporan Excel siap pakai: satu file, satu sheet per rekap, satu baris per intern. Intern yang dipilih adalah
 * intern yang periode magangnya bersinggungan dengan periode laporan, sesuai filter. Kolom angka ditulis sebagai
 * angka agar bisa difilter dan diurutkan di Excel.
 *
 * @phpstan-type Filters array{from: string, to: string, airport_id: int|null, mentor_id: int|null, intern_ids: list<int>, sheets: list<string>, quota_exhausted: bool}
 * @phpstan-type Sheet array{0: string, 1: list<string>, 2: list<list<int|float|string|null>>}
 */
class AdminReports
{
    public const SHEETS = [
        'attendance' => 'Rekap Presensi',
        'leave' => 'Rekap Izin',
        'logbook' => 'Rekap Logbook',
        'assessment' => 'Rekap Penilaian',
    ];

    public const NO_DATA = 'Tidak ada data pada periode dan filter ini.';

    private const APP_NAME = 'InJourney Airports - Intern Management & Attendance System';

    private const IDENTITY = ['Nama', 'Email', 'Unit', 'Lokasi Magang', 'Universitas', 'Jurusan', 'Mentor', 'Periode Magang'];

    public function __construct(
        private AttendanceCalendar $calendar,
        private LeaveQuotas $quotas,
        private WorkSchedules $schedules,
    ) {}

    /**
     * Pilihan filter. Akun nonaktif ikut karena laporan bisa untuk periode lampau.
     *
     * @return array<string, mixed>
     */
    public function options(): array
    {
        $people = fn (Role $role) => User::query()->where('role', $role)->orderBy('name')->orderBy('id')->get(['id', 'name', 'email', 'is_active']);

        return [
            'interns' => array_values($people(Role::Intern)->map(fn (User $u): array => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])->all()),
            'mentors' => array_values($people(Role::Mentor)->map(fn (User $u): array => ['id' => $u->id, 'name' => $u->name, 'is_active' => $u->is_active])->all()),
            'airports' => array_values(Airport::query()->orderBy('name')->get(['id', 'name', 'is_active'])->map(fn (Airport $a): array => ['id' => $a->id, 'name' => $a->name, 'is_active' => $a->is_active])->all()),
            'sheets' => self::SHEETS,
        ];
    }

    /**
     * "Pratinjau: 24 intern".
     *
     * @param  Filters  $filters
     */
    public function preview(array $filters): int
    {
        return $this->interns($filters)->count();
    }

    /**
     * @param  Filters  $filters
     * @return array{path: string, filename: string}
     *
     * @throws ActionRejected
     */
    public function export(User $admin, array $filters, CarbonInterface $now): array
    {
        $interns = $this->interns($filters)->with(['unit:id,name', 'internProfile.airport:id,name', 'internProfile.mentor:id,name'])->get();

        if ($interns->isEmpty()) {
            throw new ActionRejected(self::NO_DATA, 'no_data');
        }

        $sheets = [];

        foreach ($filters['sheets'] as $key) {
            $sheets[] = match ($key) {
                'attendance' => $this->attendanceSheet($interns, $filters, $now),
                'leave' => $this->leaveSheet($interns, $filters),
                'logbook' => $this->logbookSheet($interns, $filters, $now),
                default => $this->assessmentSheet($interns),
            };
        }

        $period = IndonesianDate::withYear(Carbon::parse($filters['from'])).' - '.IndonesianDate::withYear(Carbon::parse($filters['to']));
        $filterText = $this->describeFilters($filters, $interns);
        $info = [
            [self::APP_NAME],
            ['Laporan Intern'],
            ["Periode: {$period}"],
            ["Filter: {$filterText}"],
            ['Dibuat: '.IndonesianDate::withYear($now).' '.$now->format('H:i')." oleh {$admin->name}"],
        ];

        if ($filters['to'] >= $now->toDateString()) {
            $info[] = ['Hari ini belum dihitung di Rekap Presensi karena status final ditetapkan setelah 23:59.'];
        }

        $path = $this->write($info, $sheets);

        AuditLog::record(
            $admin,
            AuditLog::ACTION_REPORT,
            implode(', ', array_map(fn (string $key): string => self::SHEETS[$key], $filters['sheets'])),
            "Export Excel {$period}, {$interns->count()} intern. Filter: {$filterText}.",
        );

        return ['path' => $path, 'filename' => "laporan-intern_{$filters['from']}_{$filters['to']}.xlsx"];
    }

    /**
     * @param  Filters  $filters
     * @return Builder<User>
     */
    private function interns(array $filters): Builder
    {
        return User::query()
            ->where('role', Role::Intern)
            ->when($filters['intern_ids'] !== [], fn (Builder $q) => $q->whereIn('id', $filters['intern_ids']))
            ->when($filters['quota_exhausted'], fn (Builder $q) => $q->whereIn('id', $this->quotas->exhaustedInternIds()))
            ->whereHas('internProfile', fn (Builder $q) => $q
                ->whereDate('start_date', '<=', $filters['to'])
                ->whereDate('end_date', '>=', $filters['from'])
                ->when($filters['airport_id'], fn (Builder $p, int $id) => $p->where('airport_id', $id))
                ->when($filters['mentor_id'], fn (Builder $p, int $id) => $p->where('mentor_id', $id)))
            ->orderBy('name')
            ->orderBy('id');
    }

    /**
     * @param  Collection<int, User>  $interns
     * @param  Filters  $filters
     * @return Sheet
     */
    private function attendanceSheet(Collection $interns, array $filters, CarbonInterface $now): array
    {
        $rows = [];

        foreach ($interns as $intern) {
            $recap = $this->calendar->recap($this->calendar->days($intern, $filters['from'], $filters['to'], $now), $filters['from'], $now);
            $attended = $recap['present'] + $recap['late'] + $recap['missed_clock_in'];
            $base = $recap['working_days'] - $recap['leave'];

            $rows[] = [
                ...$this->identity($intern),
                $recap['working_days'],
                $recap['present'],
                $recap['late'],
                $recap['missed_clock_in'],
                $recap['missed_clock_out'],
                $recap['leave'],
                $recap['absent'],
                $recap['corrected'],
                $base > 0 ? round($attended / $base * 100, 1) : null,
            ];
        }

        return [self::SHEETS['attendance'], [...self::IDENTITY, 'Hari Kerja', 'Hadir', 'Terlambat', 'Lupa Clock In', 'Lupa Clock Out', 'Izin', 'Tidak Hadir', 'Dikoreksi', 'Kehadiran (%)'], $rows];
    }

    /**
     * Kuota dihitung untuk masa magang saat ini; hari izin hanya hari kerja di dalam periode laporan.
     *
     * @param  Collection<int, User>  $interns
     * @param  Filters  $filters
     * @return Sheet
     */
    private function leaveSheet(Collection $interns, array $filters): array
    {
        $rows = [];

        foreach ($interns as $intern) {
            $quota = $this->quotas->summary($intern);
            $days = [LeaveType::Sick->value => 0, LeaveType::Urgent->value => 0];

            $leaves = $intern->leaveRequests()
                ->where('status', RequestStatus::Approved)
                ->whereDate('start_date', '<=', $filters['to'])
                ->whereDate('end_date', '>=', $filters['from'])
                ->get();

            foreach ($leaves as $leave) {
                /** @var LeaveRequest $leave */
                $days[$leave->type->value] += $this->schedules->workingDays(
                    $intern,
                    max($filters['from'], $leave->start_date->toDateString()),
                    min($filters['to'], $leave->end_date->toDateString()),
                );
            }

            $rows[] = [
                ...$this->identity($intern),
                $quota['used'] ?? 0,
                $quota['limit'] ?? $this->quotas->limit(),
                array_sum($days),
                $days[LeaveType::Sick->value],
                $days[LeaveType::Urgent->value],
                ($quota['exhausted'] ?? false) ? 'Ya' : 'Tidak',
            ];
        }

        return [self::SHEETS['leave'], [...self::IDENTITY, 'Kuota Terpakai', 'Kuota', 'Total Hari Izin', 'Sakit (hari)', 'Urgent (hari)', 'Kuota Habis'], $rows];
    }

    /**
     * Hari wajib berlogbook = hari berpresensi dalam periode laporan dan periode magang (sampai hari ini).
     *
     * @param  Collection<int, User>  $interns
     * @param  Filters  $filters
     * @return Sheet
     */
    private function logbookSheet(Collection $interns, array $filters, CarbonInterface $now): array
    {
        $rows = [];

        foreach ($interns as $intern) {
            /** @var InternProfile $profile */
            $profile = $intern->internProfile;
            $statuses = Attendance::query()
                ->where('intern_id', $intern->id)
                ->whereDate('date', '>=', max($filters['from'], $profile->start_date->toDateString()))
                ->whereDate('date', '<=', min($filters['to'], $profile->end_date->toDateString(), $now->toDateString()))
                ->with('logbook:id,attendance_id,status')
                ->get()
                ->map(fn (Attendance $attendance): ?LogbookStatus => $attendance->logbook?->status);

            $count = fn (LogbookStatus $status): int => $statuses->filter(fn (?LogbookStatus $s): bool => $s === $status)->count();

            $rows[] = [
                ...$this->identity($intern),
                $count(LogbookStatus::Approved),
                $count(LogbookStatus::PendingReview),
                $count(LogbookStatus::Revision),
                $statuses->filter(fn (?LogbookStatus $s): bool => $s === null || $s === LogbookStatus::Draft)->count(),
            ];
        }

        return [self::SHEETS['logbook'], [...self::IDENTITY, 'Disetujui', 'Menunggu Review', 'Revisi', 'Belum Diisi'], $rows];
    }

    /**
     * Kolom indikator = indikator aktif ditambah indikator yang pernah dipakai penilaian yang sudah disubmit.
     * Penilaian tidak dibatasi periode laporan (satu penilaian per intern).
     *
     * @param  Collection<int, User>  $interns
     * @return Sheet
     */
    private function assessmentSheet(Collection $interns): array
    {
        $interns->load(['assessment.scores', 'assessment.mentor:id,name']);
        $usedIds = AssessmentScore::query()
            ->whereHas('assessment', fn (Builder $q) => $q->where('status', AssessmentStatus::Submitted)->whereIn('intern_id', $interns->modelKeys()))
            ->distinct()
            ->pluck('indicator_id');
        $indicators = AssessmentIndicator::query()
            ->where(fn (Builder $q) => $q->where('is_active', true)->orWhereIn('id', $usedIds))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $rows = [];

        foreach ($interns as $intern) {
            $assessment = $intern->assessment;
            $submitted = $assessment?->isSubmitted() ?? false;
            $scores = $submitted ? $assessment->scores->mapWithKeys(fn (AssessmentScore $s): array => [$s->indicator_id => $s->value()])->all() : [];

            $rows[] = [
                ...$this->identity($intern),
                ...array_values($indicators->map(fn (AssessmentIndicator $indicator): ?int => $scores[$indicator->id] ?? null)->all()),
                $submitted ? (float) $assessment->final_score : null,
                $submitted ? Assessments::predicate((float) $assessment->final_score) : null,
                $submitted ? $assessment->mentor?->name : null,
                $submitted ? $assessment->submitted_at?->format('Y-m-d') : null,
            ];
        }

        return [
            self::SHEETS['assessment'],
            [...self::IDENTITY, ...array_values($indicators->pluck('name')->all()), 'Nilai Akhir', 'Predikat', 'Mentor Penilai', 'Tanggal Submit'],
            $rows,
        ];
    }

    /**
     * @return list<string>
     */
    private function identity(User $intern): array
    {
        $profile = $intern->internProfile;

        return [
            $intern->name,
            $intern->email,
            $intern->unit->name ?? '-',
            $profile->airport->name ?? '-',
            $profile->university ?? '-',
            $profile->major ?? '-',
            $profile->mentor->name ?? '-',
            $profile === null ? '-' : IndonesianDate::withYear($profile->start_date).' - '.IndonesianDate::withYear($profile->end_date),
        ];
    }

    /**
     * @param  Filters  $filters
     * @param  Collection<int, User>  $interns
     */
    private function describeFilters(array $filters, Collection $interns): string
    {
        $airport = $filters['airport_id'] === null ? null : Airport::query()->find($filters['airport_id']);
        $mentor = $filters['mentor_id'] === null ? null : User::query()->find($filters['mentor_id']);
        $internText = $filters['intern_ids'] === [] ? 'Semua' : implode(', ', array_values($interns->pluck('name')->all()));

        return 'Lokasi '.($airport->name ?? 'Semua').'; Mentor '.($mentor->name ?? 'Semua')."; Intern {$internText}"
            .($filters['quota_exhausted'] ? '; hanya kuota izin habis' : '');
    }

    /**
     * @param  list<list<string>>  $info
     * @param  list<Sheet>  $sheets
     */
    private function write(array $info, array $sheets): string
    {
        $path = tempnam(sys_get_temp_dir(), 'report');

        if ($path === false) {
            throw new \RuntimeException('Tidak bisa membuat file sementara untuk laporan.');
        }

        $writer = new Writer;
        $writer->openToFile($path);

        foreach ($sheets as $index => [$name, $head, $rows]) {
            $sheet = $index === 0 ? $writer->getCurrentSheet() : $writer->addNewSheetAndMakeItCurrent();
            $sheet->setName($name);
            $sheet->setColumnWidth(26, 1, 2);
            $sheet->setColumnWidthForRange(18, 3, max(3, count($head)));

            foreach ($info as $line => $values) {
                $writer->addRow($this->row($values, new Style(fontBold: $line === 1, fontSize: $line === 1 ? 14 : 11)));
            }

            $writer->addRow(new Row([]));
            $writer->addRow($this->row($head, new Style(fontBold: true, fontColor: Color::WHITE, backgroundColor: '1F4E79')));

            foreach ($rows as $row) {
                $writer->addRow($this->row($row));
            }
        }

        $writer->close();

        return $path;
    }

    /**
     * Teks selalu ditulis sebagai teks: Row::fromValues() mengubah teks berawalan "=" menjadi rumus Excel,
     * sehingga nama buatan pengguna bisa dijalankan di komputer admin (formula injection).
     *
     * @param  list<int|float|string|null>  $values
     */
    private function row(array $values, ?Style $style = null): Row
    {
        return new Row(array_map(
            fn (int|float|string|null $value): Cell => is_string($value) ? new StringCell($value, $style) : Cell::fromValue($value, $style),
            $values,
        ));
    }
}

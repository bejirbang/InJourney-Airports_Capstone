<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\Role;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Menu Presensi admin: rekap bulanan semua intern dan data presensi per tanggal. Hanya baca; perubahan presensi
 * hanya lewat koreksi. Rincian harian satu intern memakai `/admin/users/{user}/attendance`.
 */
class AdminAttendance
{
    public const FUTURE_DATE = 'Pilih tanggal hari ini atau sebelumnya.';

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
     * Intern yang periode magangnya bersinggungan dengan bulan itu, dengan rekap hari kerja final dan persentase
     * kehadiran (rumus KPI Kehadiran).
     *
     * @return array<string, mixed>
     */
    public function month(string $month, ?int $airportId, ?string $search, CarbonInterface $now): array
    {
        [$from, $to] = AttendanceCalendar::monthRange($month);

        $interns = $this->interns($airportId, $search)
            ->whereHas('internProfile', fn (Builder $q) => $q->whereDate('start_date', '<=', $to)->whereDate('end_date', '>=', $from))
            ->get();

        $first = User::query()->where('role', Role::Intern)->join('intern_profiles', 'intern_profiles.user_id', '=', 'users.id')->min('intern_profiles.start_date');

        return [
            'month' => $month,
            'selectable_months' => $first === null ? null : ['first' => substr((string) $first, 0, 7), 'last' => $now->format('Y-m')],
            'interns' => array_values($interns->map(function (User $intern) use ($month, $from, $to, $now): array {
                $recap = $this->calendar->recap($this->calendar->days($intern, $from, $to, $now), $month, $now);
                $attended = $recap['present'] + $recap['late'] + $recap['missed_clock_in'];
                $base = $recap['working_days'] - $recap['leave'];
                unset($recap['month']);

                return [
                    ...$this->identity($intern),
                    'recap' => $recap,
                    'attendance_rate' => $base > 0 ? (int) round($attended / $base * 100) : null,
                ];
            })->all()),
        ];
    }

    /**
     * Status semua intern pada satu tanggal. Intern yang libur menurut jadwal bandaranya tetap tampil berstatus Libur.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function daily(string $date, ?int $airportId, ?string $search, CarbonInterface $now): array
    {
        if ($date > $now->toDateString()) {
            throw ValidationException::withMessages(['date' => self::FUTURE_DATE]);
        }

        $interns = $this->interns($airportId, $search)->get()->keyBy('id');
        $days = $this->calendar->statusesOn($interns, $date, $now);
        $counts = array_fill_keys(array_map(fn (AttendanceStatus $s): string => $s->value, AttendanceStatus::cases()), 0);
        $counts['missed_clock_out'] = 0;
        $rows = [];

        foreach ($days as $id => $day) {
            $counts[$day['status']->value]++;
            $counts['missed_clock_out'] += $day['missed_clock_out'] ? 1 : 0;
            $rows[] = [
                ...AttendanceCalendar::dayRow($day),
                'clock_out_at' => self::time($day['attendance']?->clock_out_at),
                'is_corrected' => (bool) $day['attendance']?->is_corrected,
                'airport' => $this->identity($interns[$id])['airport'],
            ];
        }

        return ['date' => $date, 'counts' => $counts, 'interns' => $rows];
    }

    /**
     * @return Builder<User>
     */
    private function interns(?int $airportId, ?string $search): Builder
    {
        return User::query()
            ->where('role', Role::Intern)
            ->whereHas('internProfile', fn (Builder $q) => $q->when($airportId !== null, fn (Builder $a) => $a->where('airport_id', $airportId)))
            ->when($search !== null && $search !== '', fn (Builder $q) => $q->where(fn (Builder $s) => $s
                ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower((string) $search).'%'])
                ->orWhereRaw('LOWER(email) LIKE ?', ['%'.mb_strtolower((string) $search).'%'])))
            ->with(['internProfile.airport:id,name', 'internProfile.mentor:id,name'])
            ->orderBy('name')
            ->orderBy('id');
    }

    /**
     * @return array<string, mixed>
     */
    private function identity(User $intern): array
    {
        $profile = $intern->internProfile;

        return [
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'airport' => $profile === null ? null : ['id' => $profile->airport->id, 'name' => $profile->airport->name],
            'mentor' => $profile === null ? null : ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
        ];
    }

    private static function time(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}

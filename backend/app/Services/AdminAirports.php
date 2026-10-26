<?php

namespace App\Services;

use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Http\Requests\Admin\AirportRequest;
use App\Models\Airport;
use App\Models\AirportSpecialSchedule;
use App\Models\AirportWeeklySchedule;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Lokasi & Jadwal: bandara (lokasi magang, pemilik jadwal) beserta titik presensi, jadwal mingguan, dan jadwal
 * khusus. Bandara tidak dihapus. Perubahan jadwal hanya berlaku untuk tanggal yang belum lewat, dan presensi yang
 * sudah tercatat memakai salinan jadwalnya sendiri.
 *
 * @phpstan-type WeekDay array{day_of_week: int, is_workday: bool, start_time: string|null, end_time: string|null}
 */
class AdminAirports
{
    public const HAS_ACTIVE_INTERNS = 'Bandara ini masih menjadi lokasi magang intern aktif. Pindahkan intern ke bandara lain lebih dulu.';

    public const ALREADY_INACTIVE = 'Bandara ini sudah nonaktif.';

    public const ALREADY_ACTIVE = 'Bandara ini sudah aktif.';

    public const OVERLAP = 'Rentang tanggal bertabrakan dengan jadwal khusus lain.';

    public const SPECIAL_PAST = 'Jadwal khusus hanya untuk tanggal yang belum lewat.';

    public const SPECIAL_FINISHED = 'Jadwal khusus yang sudah lewat tidak bisa diubah atau dihapus.';

    public const SPECIAL_RUNNING = 'Jadwal khusus yang sedang berjalan hanya bisa diubah tanggal selesainya, mulai hari ini.';

    private const DAY_NAMES = [1 => 'Sen', 2 => 'Sel', 3 => 'Rab', 4 => 'Kam', 5 => 'Jum', 6 => 'Sab', 7 => 'Min'];

    /**
     * @return list<array<string, mixed>>
     */
    public function list(CarbonInterface $now): array
    {
        $airports = Airport::query()
            ->withCount(['offices as active_offices_count' => fn (Builder $q) => $q->where('is_active', true)])
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        $interns = $this->activeInternCounts($now);

        return array_values($airports->map(fn (Airport $airport): array => [
            ...$this->summary($airport, $interns[$airport->id] ?? 0),
            'weekly_schedule' => $this->weeklyAt($airport, $now->toDateString()),
        ])->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(Airport $airport, CarbonInterface $now): array
    {
        $today = $now->toDateString();
        $airport->loadCount(['offices as active_offices_count' => fn (Builder $q) => $q->where('is_active', true)]);

        return [
            ...$this->summary($airport, $this->activeInternCounts($now, $airport->id)[$airport->id] ?? 0),
            'offices' => array_values($airport->offices()->orderBy('name')->orderBy('id')->get()->map(fn (Office $office): array => [
                'id' => $office->id,
                'name' => $office->name,
                'latitude' => (float) $office->latitude,
                'longitude' => (float) $office->longitude,
                'clock_in_radius_meters' => $office->clock_in_radius_meters,
                'clock_out_radius_meters' => $office->clock_out_radius_meters,
                'is_active' => $office->is_active,
            ])->all()),
            'weekly_schedule' => $this->weeklyAt($airport, $today),
            'upcoming_weekly_schedules' => array_values(array_filter(
                $this->weeklyHistory($airport),
                fn (array $set): bool => $set['effective_from'] > $today,
            )),
            'special_schedules' => $this->specials($airport, $now),
        ];
    }

    /**
     * Bandara dan jadwal mingguan pertamanya dibuat dalam satu transaksi, jadi tidak ada bandara tanpa jadwal.
     *
     * @param  list<WeekDay>  $days
     *
     * @throws ValidationException
     */
    public function create(User $admin, string $name, ?string $city, string $effectiveFrom, array $days): Airport
    {
        return $this->guardUniqueName(function () use ($admin, $name, $city, $effectiveFrom, $days): Airport {
            $airport = Airport::query()->create(['name' => $name, 'city' => $city, 'is_active' => true]);
            $this->writeWeekly($airport, $effectiveFrom, $days);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_OFFICE,
                $airport->name,
                'Tambah bandara. Jadwal mingguan mulai '.IndonesianDate::withYear(Carbon::parse($effectiveFrom)).': '.self::describe($days).'.',
            );

            return $airport;
        });
    }

    /**
     * @throws ValidationException
     */
    public function rename(User $admin, Airport $airport, string $name, ?string $city): Airport
    {
        return $this->guardUniqueName(function () use ($admin, $airport, $name, $city): Airport {
            $oldName = $airport->name;
            $airport->fill(['name' => $name, 'city' => $city]);

            if (! $airport->isDirty(['name', 'city'])) {
                return $airport;
            }

            $details = [];

            if ($airport->isDirty('name')) {
                $details[] = "Ubah nama bandara dari \"{$oldName}\".";
            }

            if ($airport->isDirty('city')) {
                $details[] = 'Ubah kota menjadi "'.($city ?? '-').'".';
            }

            $airport->save();

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $airport->name, implode(' ', $details));

            return $airport;
        });
    }

    /**
     * Intern aktif termasuk yang magangnya belum dimulai, karena mereka tetap memakai jadwal bandara ini.
     *
     * @throws ActionRejected
     */
    public function setActive(User $admin, Airport $airport, bool $active, CarbonInterface $now): Airport
    {
        return DB::transaction(function () use ($admin, $airport, $active, $now): Airport {
            $airport = Airport::query()->lockForUpdate()->findOrFail($airport->id);

            if ($airport->is_active === $active) {
                throw $active
                    ? new ActionRejected(self::ALREADY_ACTIVE, 'already_active')
                    : new ActionRejected(self::ALREADY_INACTIVE, 'already_inactive');
            }

            if (! $active && ($this->activeInternCounts($now, $airport->id)[$airport->id] ?? 0) > 0) {
                throw new ActionRejected(self::HAS_ACTIVE_INTERNS, 'has_active_interns');
            }

            $airport->update(['is_active' => $active]);

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $airport->name, $active ? 'Aktifkan bandara.' : 'Nonaktifkan bandara.');

            return $airport;
        });
    }

    /**
     * Hari yang tidak dikirim disalin dari jadwal yang berlaku sehari sebelum tanggal berlaku, jadi "atur Senin-Kamis
     * sekaligus" cukup mengirim empat hari. Set dengan tanggal berlaku yang sama ditimpa.
     *
     * @param  list<WeekDay>  $days
     * @return array<string, mixed>
     */
    public function saveWeekly(User $admin, Airport $airport, string $effectiveFrom, array $days): array
    {
        return DB::transaction(function () use ($admin, $airport, $effectiveFrom, $days): array {
            Airport::query()->lockForUpdate()->findOrFail($airport->id);

            $previous = $this->weeklyAt($airport, Carbon::parse($effectiveFrom)->subDay()->toDateString());
            $byDay = [];

            foreach ([...($previous['days'] ?? []), ...$days] as $day) {
                $byDay[$day['day_of_week']] = $day;
            }

            ksort($byDay);
            $full = array_values($byDay);

            if (count($full) !== 7) {
                throw ValidationException::withMessages(['days' => AirportRequest::DAYS_INCOMPLETE]);
            }

            AirportWeeklySchedule::query()->where('airport_id', $airport->id)->whereDate('effective_from', $effectiveFrom)->delete();
            $this->writeWeekly($airport, $effectiveFrom, $full);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_OFFICE,
                $airport->name,
                'Ubah jadwal mingguan mulai '.IndonesianDate::withYear(Carbon::parse($effectiveFrom)).': '.self::describe($full).'.',
            );

            return $this->weeklyAt($airport, $effectiveFrom) ?? [];
        });
    }

    /**
     * Riwayat jadwal mingguan, terbaru lebih dulu.
     *
     * @return list<array<string, mixed>>
     */
    public function weeklyHistory(Airport $airport): array
    {
        return array_values(AirportWeeklySchedule::query()
            ->where('airport_id', $airport->id)
            ->orderByDesc('effective_from')
            ->orderBy('day_of_week')
            ->get()
            ->groupBy(fn (AirportWeeklySchedule $row): string => $row->effective_from->toDateString())
            ->map(fn (Collection $rows, string $from): array => $this->weeklySet($from, $rows))
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function specials(Airport $airport, CarbonInterface $now): array
    {
        return array_values($airport->specialSchedules()
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (AirportSpecialSchedule $special): array => $this->special($special, $now))
            ->all());
    }

    /**
     * @param  array{name: string, start_date: string, end_date: string, start_time: string, end_time: string}  $data
     *
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function createSpecial(User $admin, Airport $airport, array $data, CarbonInterface $now): AirportSpecialSchedule
    {
        if ($data['start_date'] < $now->toDateString()) {
            throw ValidationException::withMessages(['start_date' => self::SPECIAL_PAST]);
        }

        return DB::transaction(function () use ($admin, $airport, $data): AirportSpecialSchedule {
            Airport::query()->lockForUpdate()->findOrFail($airport->id);
            $this->ensureNoOverlap($airport->id, $data['start_date'], $data['end_date'], null);

            $special = $airport->specialSchedules()->create(self::specialColumns($data));

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $airport->name, 'Tambah jadwal khusus '.self::describeSpecial($special).'.');

            return $special;
        });
    }

    /**
     * Yang belum dimulai boleh diubah seluruhnya. Yang sedang berjalan hanya tanggal selesainya (mulai hari ini),
     * karena hari yang sudah lewat memakai jam itu. Yang sudah selesai terkunci.
     *
     * @param  array{name: string, start_date: string, end_date: string, start_time: string, end_time: string}  $data
     *
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function updateSpecial(User $admin, AirportSpecialSchedule $special, array $data, CarbonInterface $now): AirportSpecialSchedule
    {
        $today = $now->toDateString();

        return DB::transaction(function () use ($admin, $special, $data, $today): AirportSpecialSchedule {
            Airport::query()->lockForUpdate()->findOrFail($special->airport_id);
            $special = AirportSpecialSchedule::query()->with('airport')->findOrFail($special->id);
            $columns = self::specialColumns($data);

            if ($special->end_date->toDateString() < $today) {
                throw new ActionRejected(self::SPECIAL_FINISHED, 'finished');
            }

            if ($special->start_date->toDateString() <= $today) {
                $unchanged = $columns['start_date'] === $special->start_date->toDateString()
                    && $columns['start_time'] === $special->start_time
                    && $columns['end_time'] === $special->end_time;

                if (! $unchanged || $columns['end_date'] < $today) {
                    throw new ActionRejected(self::SPECIAL_RUNNING, 'running');
                }
            } elseif ($columns['start_date'] < $today) {
                throw ValidationException::withMessages(['start_date' => self::SPECIAL_PAST]);
            }

            $this->ensureNoOverlap($special->airport_id, $columns['start_date'], $columns['end_date'], $special->id);
            $special->update($columns);

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $special->airport->name, 'Ubah jadwal khusus '.self::describeSpecial($special).'.');

            return $special;
        });
    }

    /**
     * Jadwal yang sedang berjalan dihentikan mulai hari ini (tanggal selesai menjadi kemarin), bukan dihapus,
     * supaya hari yang sudah lewat tetap tercatat dengan jam itu.
     *
     * @return bool true jika dihapus, false jika dihentikan
     *
     * @throws ActionRejected
     */
    public function deleteSpecial(User $admin, AirportSpecialSchedule $special, CarbonInterface $now): bool
    {
        $today = $now->toDateString();

        return DB::transaction(function () use ($admin, $special, $today): bool {
            Airport::query()->lockForUpdate()->findOrFail($special->airport_id);
            $special = AirportSpecialSchedule::query()->with('airport')->findOrFail($special->id);
            $airportName = $special->airport->name;

            if ($special->end_date->toDateString() < $today) {
                throw new ActionRejected(self::SPECIAL_FINISHED, 'finished');
            }

            if ($special->start_date->toDateString() < $today) {
                $special->update(['end_date' => Carbon::parse($today)->subDay()->toDateString()]);
                AuditLog::record($admin, AuditLog::ACTION_OFFICE, $airportName, 'Hentikan jadwal khusus '.self::describeSpecial($special).'.');

                return false;
            }

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $airportName, 'Hapus jadwal khusus '.self::describeSpecial($special).'.');
            $special->delete();

            return true;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function special(AirportSpecialSchedule $special, CarbonInterface $now): array
    {
        $today = $now->toDateString();
        $state = match (true) {
            $special->end_date->toDateString() < $today => 'finished',
            $special->start_date->toDateString() <= $today => 'running',
            default => 'upcoming',
        };

        return [
            'id' => $special->id,
            'name' => $special->name,
            'start_date' => $special->start_date->toDateString(),
            'end_date' => $special->end_date->toDateString(),
            'start_time' => substr($special->start_time, 0, 5),
            'end_time' => substr($special->end_time, 0, 5),
            'state' => $state,
            'can_edit' => $state !== 'finished',
        ];
    }

    /**
     * Jumlah intern aktif (belum dinonaktifkan, magang belum berakhir) per bandara.
     *
     * @return array<int, int>
     */
    public function activeInternCounts(CarbonInterface $now, ?int $airportId = null): array
    {
        return User::query()
            ->join('intern_profiles', 'intern_profiles.user_id', '=', 'users.id')
            ->where('users.role', Role::Intern)
            ->where('users.is_active', true)
            ->whereDate('intern_profiles.end_date', '>=', $now->toDateString())
            ->when($airportId !== null, fn (Builder $q) => $q->where('intern_profiles.airport_id', $airportId))
            ->groupBy('intern_profiles.airport_id')
            ->selectRaw('intern_profiles.airport_id, COUNT(*) AS total')
            ->pluck('total', 'airport_id')
            ->map(intval(...))
            ->all();
    }

    /**
     * Set jadwal mingguan yang berlaku pada tanggal itu, atau null jika belum ada.
     *
     * @return array{effective_from: string, days: list<WeekDay>, summary: string}|null
     */
    public function weeklyAt(Airport $airport, string $date): ?array
    {
        $from = AirportWeeklySchedule::query()
            ->where('airport_id', $airport->id)
            ->whereDate('effective_from', '<=', $date)
            ->max('effective_from');

        if ($from === null) {
            return null;
        }

        $from = Carbon::parse((string) $from)->toDateString();
        $rows = AirportWeeklySchedule::query()->where('airport_id', $airport->id)->whereDate('effective_from', $from)->orderBy('day_of_week')->get();

        return $this->weeklySet($from, $rows);
    }

    /**
     * @param  list<WeekDay>  $days
     */
    private function writeWeekly(Airport $airport, string $effectiveFrom, array $days): void
    {
        foreach ($days as $day) {
            $airport->weeklySchedules()->create([
                'day_of_week' => $day['day_of_week'],
                'is_workday' => $day['is_workday'],
                'start_time' => $day['is_workday'] ? self::seconds($day['start_time']) : null,
                'end_time' => $day['is_workday'] ? self::seconds($day['end_time']) : null,
                'effective_from' => $effectiveFrom,
            ]);
        }
    }

    /**
     * @param  Collection<int, AirportWeeklySchedule>  $rows
     * @return array{effective_from: string, days: list<WeekDay>, summary: string}
     */
    private function weeklySet(string $from, Collection $rows): array
    {
        $days = array_values($rows->map(fn (AirportWeeklySchedule $row): array => [
            'day_of_week' => $row->day_of_week,
            'is_workday' => $row->is_workday,
            'start_time' => $row->start_time === null ? null : substr($row->start_time, 0, 5),
            'end_time' => $row->end_time === null ? null : substr($row->end_time, 0, 5),
        ])->all());

        return ['effective_from' => $from, 'days' => $days, 'summary' => self::describe($days)];
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Airport $airport, int $activeInterns): array
    {
        return [
            'id' => $airport->id,
            'name' => $airport->name,
            'city' => $airport->city,
            'is_active' => $airport->is_active,
            'active_offices' => (int) ($airport->getAttribute('active_offices_count') ?? 0),
            'active_interns' => $activeInterns,
        ];
    }

    /**
     * @throws ValidationException
     */
    private function ensureNoOverlap(int $airportId, string $start, string $end, ?int $ignoreId): void
    {
        $overlaps = AirportSpecialSchedule::query()
            ->where('airport_id', $airportId)
            ->whereDate('start_date', '<=', $end)
            ->whereDate('end_date', '>=', $start)
            ->when($ignoreId !== null, fn (Builder $q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages(['start_date' => self::OVERLAP]);
        }
    }

    /**
     * @param  Closure(): Airport  $callback
     *
     * @throws ValidationException
     */
    private function guardUniqueName(Closure $callback): Airport
    {
        try {
            return DB::transaction($callback);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => AirportRequest::NAME_TAKEN]);
        }
    }

    /**
     * @param  array{name: string, start_date: string, end_date: string, start_time: string, end_time: string}  $data
     * @return array{name: string, start_date: string, end_date: string, start_time: string, end_time: string}
     */
    private static function specialColumns(array $data): array
    {
        return [
            'name' => $data['name'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'start_time' => self::seconds($data['start_time']),
            'end_time' => self::seconds($data['end_time']),
        ];
    }

    /**
     * Ringkasan untuk Log Aktivitas dan daftar, misalnya "Sen-Kam 08:00-17:00, Jum 08:30-16:00, Sab-Min libur".
     *
     * @param  list<WeekDay>  $days
     */
    public static function describe(array $days): string
    {
        $groups = [];

        foreach ($days as $day) {
            $label = $day['is_workday'] ? substr((string) $day['start_time'], 0, 5).'-'.substr((string) $day['end_time'], 0, 5) : 'libur';
            $last = array_key_last($groups);

            if ($last !== null && $groups[$last]['label'] === $label && $groups[$last]['to'] === $day['day_of_week'] - 1) {
                $groups[$last]['to'] = $day['day_of_week'];
            } else {
                $groups[] = ['from' => $day['day_of_week'], 'to' => $day['day_of_week'], 'label' => $label];
            }
        }

        return implode(', ', array_map(
            fn (array $g): string => self::DAY_NAMES[$g['from']].($g['to'] !== $g['from'] ? '-'.self::DAY_NAMES[$g['to']] : '').' '.$g['label'],
            $groups,
        ));
    }

    private static function describeSpecial(AirportSpecialSchedule $special): string
    {
        return "\"{$special->name}\" ".IndonesianDate::range($special->start_date, $special->end_date)
            .' '.substr($special->start_time, 0, 5).'-'.substr($special->end_time, 0, 5);
    }

    private static function seconds(?string $time): string
    {
        return substr((string) $time, 0, 5).':00';
    }
}

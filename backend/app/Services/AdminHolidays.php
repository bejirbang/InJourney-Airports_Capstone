<?php

namespace App\Services;

use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AuditLog;
use App\Models\Holiday;
use App\Models\InternProfile;
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
 * Libur berlaku untuk semua bandara. Status presensi dihitung saat dibaca, jadi libur tanggal lampau langsung
 * mengubah status tanpa proses hitung ulang.
 */
class AdminHolidays
{
    public const DATE_TAKEN = 'Tanggal ini sudah menjadi hari libur.';

    public const PAST_DATE = 'Tanggal ini sudah lewat.';

    public function __construct(private WorkSchedules $schedules) {}

    /**
     * @return Collection<int, Holiday>
     */
    public function all(): Collection
    {
        return Holiday::query()->orderBy('date')->get();
    }

    /**
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function create(User $admin, string $date, string $name, bool $confirmed, CarbonInterface $now): Holiday
    {
        $past = $this->pastDates([$date], $now);
        $this->requireConfirmation($past, $confirmed);

        return $this->guardUnique(function () use ($admin, $date, $name, $past): Holiday {
            $this->ensureFree($date);

            $holiday = Holiday::query()->create(['date' => $date, 'name' => $name]);

            $this->log($admin, $holiday, "Tambah libur \"{$name}\".", $past);

            return $holiday;
        });
    }

    /**
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function update(User $admin, Holiday $holiday, string $date, string $name, bool $confirmed, CarbonInterface $now): Holiday
    {
        $oldDate = $holiday->date->toDateString();
        $moved = $oldDate !== $date;
        $past = $moved ? $this->pastDates([$oldDate, $date], $now) : [];
        $this->requireConfirmation($past, $confirmed);

        return $this->guardUnique(function () use ($admin, $holiday, $oldDate, $date, $name, $moved, $past): Holiday {
            if ($moved) {
                $this->ensureFree($date);
            }

            $holiday->update(['date' => $date, 'name' => $name]);

            $from = $moved ? ' (sebelumnya '.IndonesianDate::withYear(Carbon::parse($oldDate)).')' : '';
            $this->log($admin, $holiday, "Ubah libur \"{$name}\"{$from}.", $past);

            return $holiday;
        });
    }

    public function delete(User $admin, Holiday $holiday, CarbonInterface $now): void
    {
        $past = $this->pastDates([$holiday->date->toDateString()], $now);

        DB::transaction(function () use ($admin, $holiday, $past): void {
            $holiday->delete();

            $this->log($admin, $holiday, "Hapus libur \"{$holiday->name}\".", $past);
        });
    }

    /**
     * Intern dalam periode magang yang bandaranya bekerja pada tanggal itu menurut jadwal mingguan.
     */
    public function affectedInterns(string $date): int
    {
        return InternProfile::query()
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->whereHas('user', fn (Builder $q) => $q->where('role', Role::Intern))
            ->get(['airport_id'])
            ->countBy('airport_id')
            ->filter(fn (int $count, int $airportId): bool => $this->schedules->isRoutineWorkday($airportId, $date))
            ->sum();
    }

    /**
     * @param  list<string>  $dates
     * @return list<string>
     */
    private function pastDates(array $dates, CarbonInterface $now): array
    {
        return array_values(array_unique(array_filter($dates, fn (string $date): bool => $date < $now->toDateString())));
    }

    /**
     * @param  list<string>  $past
     *
     * @throws ActionRejected
     */
    private function requireConfirmation(array $past, bool $confirmed): void
    {
        if ($past === [] || $confirmed) {
            return;
        }

        throw new ActionRejected(self::PAST_DATE, 'confirm_recalculate', [
            'affected' => $this->countAffected($past),
        ]);
    }

    /**
     * @throws ValidationException
     */
    private function ensureFree(string $date): void
    {
        if (Holiday::query()->whereDate('date', $date)->exists()) {
            throw ValidationException::withMessages(['date' => self::DATE_TAKEN]);
        }
    }

    /**
     * Dua admin yang menambah tanggal yang sama bersamaan: yang kedua mendapat pesan yang sama
     * dengan pemeriksaan biasa.
     *
     * @param  Closure(): Holiday  $callback
     *
     * @throws ValidationException
     */
    private function guardUnique(Closure $callback): Holiday
    {
        try {
            return DB::transaction($callback);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['date' => self::DATE_TAKEN]);
        }
    }

    /**
     * @param  list<string>  $past
     */
    private function log(User $admin, Holiday $holiday, string $detail, array $past): void
    {
        if ($past !== []) {
            $detail .= " {$this->countAffected($past)} presensi dihitung ulang.";
        }

        AuditLog::record($admin, AuditLog::ACTION_CALENDAR, IndonesianDate::withYear($holiday->date), $detail);
    }

    /**
     * @param  list<string>  $dates
     */
    private function countAffected(array $dates): int
    {
        return array_sum(array_map($this->affectedInterns(...), $dates));
    }
}

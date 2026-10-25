<?php

namespace App\Services;

use App\Exceptions\ActionRejected;
use App\Http\Requests\Admin\OfficeRequest;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminOffices
{
    public const ALREADY_INACTIVE = 'Kantor ini sudah nonaktif.';

    public const ALREADY_ACTIVE = 'Kantor ini sudah aktif.';

    /**
     * @return Collection<int, Office>
     */
    public function all(): Collection
    {
        return Office::query()->with('airport:id,name')->orderBy('name')->orderBy('id')->get();
    }

    /**
     * @param  array{airport_id?: int|string, name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string}  $data
     *
     * @throws ValidationException
     */
    public function create(User $admin, array $data): Office
    {
        return $this->guardUniqueName(function () use ($admin, $data): Office {
            $office = Office::query()->create([...$data, 'is_active' => true]);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_OFFICE,
                $office->name,
                "Tambah kantor di {$this->coordinates($office)}, radius {$this->radii($office)}.",
            );

            return $office;
        });
    }

    /**
     * @param  array{airport_id?: int|string, name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string}  $data
     *
     * @throws ValidationException
     */
    public function update(User $admin, Office $office, array $data): Office
    {
        return $this->guardUniqueName(function () use ($admin, $office, $data): Office {
            $oldName = $office->name;
            $office->fill($data);

            $changes = [];

            if ($office->isDirty('name')) {
                $changes[] = "Ubah nama dari \"{$oldName}\".";
            }

            if ($office->isDirty(['latitude', 'longitude'])) {
                $changes[] = "Ubah titik ke {$this->coordinates($office)}.";
            }

            if ($office->isDirty(['clock_in_radius_meters', 'clock_out_radius_meters'])) {
                $changes[] = "Ubah radius: clock in {$office->clock_in_radius_meters} m, clock out {$office->clock_out_radius_meters} m.";
            }

            if ($changes === []) {
                return $office;
            }

            $office->save();

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $office->name, implode(' ', $changes));

            return $office;
        });
    }

    /**
     * @throws ActionRejected
     */
    public function deactivate(User $admin, Office $office): Office
    {
        return $this->setActive($admin, $office, false);
    }

    /**
     * @throws ActionRejected
     */
    public function activate(User $admin, Office $office): Office
    {
        return $this->setActive($admin, $office, true);
    }

    /**
     * @throws ActionRejected
     */
    private function setActive(User $admin, Office $office, bool $active): Office
    {
        return DB::transaction(function () use ($admin, $office, $active): Office {
            $office = Office::query()->lockForUpdate()->findOrFail($office->id);

            if ($office->is_active === $active) {
                throw $active
                    ? new ActionRejected(self::ALREADY_ACTIVE, 'already_active')
                    : new ActionRejected(self::ALREADY_INACTIVE, 'already_inactive');
            }

            $office->update(['is_active' => $active]);

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $office->name, $active ? 'Aktifkan kantor.' : 'Nonaktifkan kantor.');

            return $office;
        });
    }

    /**
     * Dua admin yang menyimpan nama sama bersamaan: yang kedua mendapat pesan yang sama dengan pemeriksaan biasa.
     *
     * @param  Closure(): Office  $callback
     *
     * @throws ValidationException
     */
    private function guardUniqueName(Closure $callback): Office
    {
        try {
            return DB::transaction($callback);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => OfficeRequest::NAME_TAKEN]);
        }
    }

    private function coordinates(Office $office): string
    {
        return number_format((float) $office->latitude, 4, '.', '').', '.number_format((float) $office->longitude, 4, '.', '');
    }

    private function radii(Office $office): string
    {
        return "{$office->clock_in_radius_meters} m / {$office->clock_out_radius_meters} m";
    }
}

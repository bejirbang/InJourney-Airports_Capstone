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

/**
 * Menu Lokasi Kantor (docs/design-admin.md 9A). Kantor nonaktif boleh dihapus (keputusan pemilik repo
 * 23 Okt 2026, berbeda dengan 9A.5 dan 16). Penghapusan berupa soft delete, jadi riwayat absensi tetap
 * menunjuk kantornya, sementara nama kantor itu boleh dipakai lagi. Perubahan titik atau radius hanya berlaku untuk clock in dan clock out
 * berikutnya karena absensi lama hanya menyimpan id kantor, bukan hasil pemeriksaan radius.
 * Semua tindakan masuk Log Aktivitas, tanpa notifikasi ke intern atau mentor (9A.6).
 */
class AdminOffices
{
    public const ALREADY_INACTIVE = 'Kantor ini sudah nonaktif.';

    public const ALREADY_ACTIVE = 'Kantor ini sudah aktif.';

    public const DELETE_ACTIVE = 'Nonaktifkan kantor lebih dulu sebelum menghapusnya.';

    /**
     * Semua kantor, urut nama.
     *
     * @return Collection<int, Office>
     */
    public function all(): Collection
    {
        return Office::query()->orderBy('name')->orderBy('id')->get();
    }

    /**
     * Tambah kantor. Kantor baru langsung aktif (9A.2 langkah 6).
     *
     * @param  array{name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string}  $data
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
     * Ubah nama, titik, atau radius. Log hanya menyebut yang berubah; tanpa perubahan tidak ada log.
     *
     * @param  array{name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string}  $data
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
     * Nonaktifkan kantor. Kantor aktif terakhir boleh dinonaktifkan; dialog konfirmasi di frontend
     * menjelaskan bahwa intern tidak bisa clock in sampai ada kantor aktif (9A.6).
     *
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
     * Hapus kantor nonaktif. Kantor aktif harus dinonaktifkan dulu, agar penghapusan tidak langsung
     * menghentikan clock in tanpa dialog kantor aktif terakhir.
     *
     * @throws ActionRejected
     */
    public function delete(User $admin, Office $office): void
    {
        DB::transaction(function () use ($admin, $office): void {
            $office = Office::query()->lockForUpdate()->findOrFail($office->id);

            if ($office->is_active) {
                throw new ActionRejected(self::DELETE_ACTIVE, 'still_active');
            }

            $office->delete();

            AuditLog::record($admin, AuditLog::ACTION_OFFICE, $office->name, 'Hapus kantor.');
        });
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

    /**
     * "-6.1256, 106.6559", sama dengan formatCoord di mock-rules.ts.
     */
    private function coordinates(Office $office): string
    {
        return number_format((float) $office->latitude, 4, '.', '').', '.number_format((float) $office->longitude, 4, '.', '');
    }

    /**
     * "100 m / 300 m": radius clock in lalu clock out.
     */
    private function radii(Office $office): string
    {
        return "{$office->clock_in_radius_meters} m / {$office->clock_out_radius_meters} m";
    }
}

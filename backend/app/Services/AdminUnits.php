<?php

namespace App\Services;

use App\Exceptions\ActionRejected;
use App\Http\Requests\Admin\UnitRequest;
use App\Models\AuditLog;
use App\Models\Unit;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Daftar pilihan unit kerja. Unit tidak dihapus; unit nonaktif tidak bisa dipilih untuk akun baru, akun lama tetap
 * memakainya.
 */
class AdminUnits
{
    public const ALREADY_INACTIVE = 'Unit ini sudah nonaktif.';

    public const ALREADY_ACTIVE = 'Unit ini sudah aktif.';

    /**
     * @return Collection<int, Unit>
     */
    public function all(): Collection
    {
        return Unit::query()->withCount('users')->orderBy('name')->orderBy('id')->get();
    }

    /**
     * @throws ValidationException
     */
    public function create(User $admin, string $name): Unit
    {
        return $this->guardUniqueName(function () use ($admin, $name): Unit {
            $unit = Unit::query()->create(['name' => $name, 'is_active' => true]);

            AuditLog::record($admin, AuditLog::ACTION_UNIT, $unit->name, 'Tambah unit.');

            return $unit;
        });
    }

    /**
     * @throws ValidationException
     */
    public function rename(User $admin, Unit $unit, string $name): Unit
    {
        return $this->guardUniqueName(function () use ($admin, $unit, $name): Unit {
            $oldName = $unit->name;
            $unit->fill(['name' => $name]);

            if (! $unit->isDirty('name')) {
                return $unit;
            }

            $unit->save();

            AuditLog::record($admin, AuditLog::ACTION_UNIT, $unit->name, "Ubah nama dari \"{$oldName}\".");

            return $unit;
        });
    }

    /**
     * @throws ActionRejected
     */
    public function setActive(User $admin, Unit $unit, bool $active): Unit
    {
        return DB::transaction(function () use ($admin, $unit, $active): Unit {
            $unit = Unit::query()->lockForUpdate()->findOrFail($unit->id);

            if ($unit->is_active === $active) {
                throw $active
                    ? new ActionRejected(self::ALREADY_ACTIVE, 'already_active')
                    : new ActionRejected(self::ALREADY_INACTIVE, 'already_inactive');
            }

            $unit->update(['is_active' => $active]);

            AuditLog::record($admin, AuditLog::ACTION_UNIT, $unit->name, $active ? 'Aktifkan unit.' : 'Nonaktifkan unit.');

            return $unit;
        });
    }

    /**
     * @param  Closure(): Unit  $callback
     *
     * @throws ValidationException
     */
    private function guardUniqueName(Closure $callback): Unit
    {
        try {
            return DB::transaction($callback);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => UnitRequest::NAME_TAKEN]);
        }
    }
}

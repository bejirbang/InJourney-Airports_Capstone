<?php

namespace App\Services;

use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\Warning;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/**
 * Catatan Warning (docs/design-admin.md Alur 8): menu Warning dan tab Warning di detail intern.
 * Hanya admin yang melihat. Tidak ada notifikasi ke intern atau mentor; setiap tambah dan ubah masuk log.
 */
class AdminWarnings
{
    public const LOCKED = 'Catatan hanya bisa diubah pembuatnya dalam 24 jam.';

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
     * Pilihan intern di menu Warning beserta jumlah catatannya, urut nama.
     *
     * @return list<array{id: int, name: string, warnings: int}>
     */
    public function interns(?string $search): array
    {
        return array_values(User::query()
            ->where('role', Role::Intern)
            ->when($search, fn (Builder $q, string $search) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%']))
            ->withCount('warnings')
            ->orderBy('name')
            ->orderBy('id')
            ->get()
            ->map(fn (User $intern): array => [
                'id' => $intern->id,
                'name' => $intern->name,
                'warnings' => (int) $intern->warnings_count,
            ])
            ->all());
    }

    /**
     * Riwayat catatan satu intern, terbaru lebih dulu, dan jumlah hari Terlambat bulan berjalan
     * ("Terlambat bulan ini: 3 kali") sebagai bahan pertimbangan, termasuk hari ini.
     *
     * @return array{late_this_month: int, warnings: list<array<string, mixed>>}
     */
    public function forIntern(User $admin, User $intern, CarbonInterface $now): array
    {
        [$from, $to] = AttendanceCalendar::monthRange($now->format('Y-m'));
        $lateDays = array_filter(
            $this->calendar->days($intern->loadMissing('internProfile'), $from, $to, $now),
            fn (array $day): bool => ($day['late_minutes'] ?? 0) > 0,
        );

        $warnings = Warning::query()
            ->with('author:id,name')
            ->where('intern_id', $intern->id)
            ->latest()
            ->latest('id')
            ->get();

        return [
            'late_this_month' => count($lateDays),
            'warnings' => array_values($warnings->map(fn (Warning $warning): array => $this->row($warning, $admin, $now))->all()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function create(User $admin, User $intern, string $body, CarbonInterface $now): array
    {
        $warning = DB::transaction(function () use ($admin, $intern, $body): Warning {
            $warning = Warning::query()->create([
                'intern_id' => $intern->id,
                'author_id' => $admin->id,
                'body' => $body,
            ]);

            AuditLog::record($admin, AuditLog::ACTION_WARNING, $intern->name, 'Tambah catatan warning.');

            return $warning;
        });

        return $this->row($warning->load('author:id,name'), $admin, $now);
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ActionRejected
     */
    public function update(User $admin, Warning $warning, string $body, CarbonInterface $now): array
    {
        $intern = $warning->intern;

        // Catatan milik akun intern yang sudah dihapus tidak tampil di mana pun.
        if ($intern === null) {
            throw (new ModelNotFoundException)->setModel(Warning::class, [$warning->id]);
        }

        if (! $warning->editableBy($admin, $now)) {
            throw new ActionRejected(self::LOCKED, 'locked');
        }

        // Simpan tanpa perubahan tidak dicatat di log.
        if ($warning->body === $body) {
            return $this->row($warning->load('author:id,name'), $admin, $now);
        }

        DB::transaction(function () use ($admin, $warning, $intern, $body): void {
            $warning->update(['body' => $body]);

            AuditLog::record($admin, AuditLog::ACTION_WARNING, $intern->name, 'Ubah catatan warning.');
        });

        return $this->row($warning->load('author:id,name'), $admin, $now);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(Warning $warning, User $admin, CarbonInterface $now): array
    {
        return [
            'id' => $warning->id,
            'body' => $warning->body,
            'author' => $warning->author === null ? null : ['id' => $warning->author->id, 'name' => $warning->author->name],
            'created_at' => $warning->created_at?->toIso8601String(),
            'updated_at' => $warning->updated_at?->toIso8601String(),
            // Tombol Ubah; selain itu tampil "Terkunci."
            'can_edit' => $warning->editableBy($admin, $now),
        ];
    }
}

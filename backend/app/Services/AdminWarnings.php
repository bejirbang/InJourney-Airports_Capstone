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
 * Catatan warning dibuat dan diubah admin. Intern yang bersangkutan dan mentornya hanya membaca, dan diberi tahu
 * saat catatan dibuat (bukan saat diubah).
 */
class AdminWarnings
{
    public const LOCKED = 'Catatan hanya bisa diubah pembuatnya dalam 24 jam.';

    public function __construct(
        private AttendanceCalendar $calendar,
        private LeaveQuotas $quotas,
        private Notifier $notifier,
    ) {}

    /**
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
     * Ringkasan di atas daftar: siapa yang bisa membaca, Terlambat bulan ini, dan kuota izin.
     *
     * @return array<string, mixed>
     */
    public function forIntern(User $admin, User $intern, CarbonInterface $now): array
    {
        [$from, $to] = AttendanceCalendar::monthRange($now->format('Y-m'));
        $mentor = $intern->loadMissing('internProfile.mentor:id,name')->internProfile?->mentor;
        $lateDays = array_filter(
            $this->calendar->days($intern, $from, $to, $now),
            fn (array $day): bool => ($day['late_minutes'] ?? 0) > 0,
        );

        $warnings = Warning::query()
            ->with('author:id,name')
            ->where('intern_id', $intern->id)
            ->latest()
            ->latest('id')
            ->get();

        return [
            'mentor' => $mentor === null ? null : ['id' => $mentor->id, 'name' => $mentor->name],
            'late_this_month' => count($lateDays),
            'leave_quota' => $this->quotas->summary($intern),
            'warnings' => array_values($warnings->map(fn (Warning $warning): array => $this->row($warning, $admin, $now))->all()),
        ];
    }

    /**
     * Daftar hanya baca untuk intern yang bersangkutan dan mentornya, terbaru lebih dulu.
     *
     * @return list<array{id: int, body: string, author: string|null, created_at: string|null, updated_at: string|null}>
     */
    public function readOnly(User $intern): array
    {
        return array_values(Warning::query()
            ->with('author:id,name')
            ->where('intern_id', $intern->id)
            ->latest()
            ->latest('id')
            ->get()
            ->map(fn (Warning $warning): array => [
                'id' => $warning->id,
                'body' => $warning->body,
                'author' => $warning->author?->name,
                'created_at' => $warning->created_at?->toIso8601String(),
                'updated_at' => $warning->updated_at?->toIso8601String(),
            ])
            ->all());
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

        $this->notifier->send([$intern->id], 'Ada catatan baru dari admin.', '/catatan');

        $mentorId = $intern->loadMissing('internProfile')->internProfile?->mentor_id;

        if ($mentorId !== null) {
            $this->notifier->send([$mentorId], 'Ada catatan baru untuk '.rtrim($intern->shortName(), '.').'.', '/intern-saya', ['open' => $intern->id, 'tab' => 'catatan']);
        }

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

        if ($intern === null) {
            throw (new ModelNotFoundException)->setModel(Warning::class, [$warning->id]);
        }

        if (! $warning->editableBy($admin, $now)) {
            throw new ActionRejected(self::LOCKED, 'locked');
        }

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
            'can_edit' => $warning->editableBy($admin, $now),
        ];
    }
}

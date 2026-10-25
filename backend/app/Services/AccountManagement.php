<?php

namespace App\Services;

use App\Enums\CorrectionStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AttendanceCorrection;
use App\Models\AuditLog;
use App\Models\InternProfile;
use App\Models\MentorHistory;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountManagement
{
    public const CANNOT_DEACTIVATE_SELF = 'Anda tidak bisa menonaktifkan akun Anda sendiri.';

    public const LAST_ADMIN = 'Minimal harus ada satu admin aktif.';

    public const MENTOR_HAS_INTERNS = 'Mentor ini masih memiliki intern aktif. Pindahkan intern ke mentor lain lebih dulu.';

    public const INTERNSHIP_ENDED = 'Aktifkan kembali intern dengan memperbarui tanggal selesai magang.';

    public const ALREADY_INACTIVE = 'Akun ini sudah nonaktif.';

    public const ALREADY_ACTIVE = 'Akun ini sudah aktif.';

    public const NOT_INTERN = 'Hanya akun intern yang memiliki mentor.';

    public const SAME_MENTOR = 'Pilih mentor baru.';

    public const EXTEND_NOT_INTERN = 'Akun ini bukan intern.';

    public const EXTEND_NOT_AFTER_END = 'Tanggal baru harus setelah tanggal selesai saat ini.';

    public const EXTEND_IN_PAST = 'Tanggal selesai baru tidak boleh sebelum hari ini.';

    public function __construct(private Notifier $notifier) {}

    public static function temporaryPassword(): string
    {
        return Str::password(12, symbols: false);
    }

    /**
     * @param  array{name: string, email: string, role: string, unit_id?: int|string, mentor_id?: int|string, airport_id?: int|string, university?: string, major?: string, start_date?: string, end_date?: string}  $data
     * @return array{user: User, temporary_password: string}
     */
    public function create(User $admin, array $data): array
    {
        $role = Role::from($data['role']);
        $password = self::temporaryPassword();

        $user = DB::transaction(function () use ($admin, $data, $role, $password): User {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $password,
                'role' => $role,
                'unit_id' => $role === Role::Admin ? null : ($data['unit_id'] ?? null),
                'is_active' => true,
                'must_change_password' => true,
            ]);

            if ($role === Role::Intern) {
                InternProfile::query()->create([
                    'user_id' => $user->id,
                    'mentor_id' => $data['mentor_id'] ?? null,
                    'airport_id' => $data['airport_id'] ?? null,
                    'university' => $data['university'] ?? null,
                    'major' => $data['major'] ?? null,
                    'start_date' => $data['start_date'] ?? null,
                    'end_date' => $data['end_date'] ?? null,
                    'leave_quota_since' => $data['start_date'] ?? null,
                ]);

                MentorHistory::query()->create([
                    'intern_id' => $user->id,
                    'mentor_id' => $data['mentor_id'] ?? null,
                    'started_at' => $data['start_date'] ?? null,
                ]);
            }

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $user->name, "Tambah akun {$role->label()}.");

            return $user;
        });

        return ['user' => $user, 'temporary_password' => $password];
    }

    /**
     * @param  array{name: string, email: string, unit_id?: int|string, airport_id?: int|string, university?: string, major?: string, start_date?: string, end_date?: string}  $data
     */
    public function update(User $admin, User $user, array $data): User
    {
        DB::transaction(function () use ($admin, $user, $data): void {
            $user->update([
                'name' => $data['name'],
                'email' => $data['email'],
                'unit_id' => $user->hasRole(Role::Admin) ? null : ($data['unit_id'] ?? $user->unit_id),
            ]);

            $profile = $user->hasRole(Role::Intern) ? $user->internProfile : null;

            if ($profile !== null && isset($data['start_date'], $data['end_date'])) {
                $profile->fill([
                    'airport_id' => $data['airport_id'] ?? $profile->airport_id,
                    'university' => $data['university'] ?? $profile->university,
                    'major' => $data['major'] ?? $profile->major,
                    'start_date' => $data['start_date'],
                    'end_date' => $data['end_date'],
                ]);

                // Kuota yang belum pernah direset oleh Perpanjang ikut tanggal mulai baru.
                if ($profile->isDirty('start_date') && $profile->leave_quota_since->toDateString() === $profile->getOriginal('start_date')?->toDateString()) {
                    $profile->leave_quota_since = $profile->start_date;
                }

                $profile->save();
            }

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $user->name, 'Ubah data akun.');
        });

        return $user;
    }

    /**
     * @return array{pending_corrections: int}
     *
     * @throws ActionRejected
     */
    public function changeMentor(User $admin, User $intern, User $mentor, CarbonInterface $now): array
    {
        if (! $intern->hasRole(Role::Intern)) {
            throw new ActionRejected(self::NOT_INTERN, 'not_intern');
        }

        $today = $now->toDateString();

        [$oldMentor, $moved] = DB::transaction(function () use ($admin, $intern, $mentor, $today): array {
            // Dikunci agar dua admin yang mengganti mentor bersamaan tidak membuat riwayat ganda.
            $profile = InternProfile::query()->where('user_id', $intern->id)->lockForUpdate()->firstOrFail();

            if ($profile->mentor_id === $mentor->id) {
                throw new ActionRejected(self::SAME_MENTOR, 'same_mentor');
            }

            $oldMentor = User::withTrashed()->find($profile->mentor_id);

            $closed = MentorHistory::query()
                ->where('intern_id', $intern->id)
                ->whereNull('ended_at')
                ->update(['ended_at' => $today]);

            // Data lama tanpa riwayat: catat periode mentor lama agar ia tetap melihat intern ini.
            if ($closed === 0) {
                MentorHistory::query()->create([
                    'intern_id' => $intern->id,
                    'mentor_id' => $profile->mentor_id,
                    'started_at' => min($profile->start_date->toDateString(), $today),
                    'ended_at' => $today,
                ]);
            }

            MentorHistory::query()->create([
                'intern_id' => $intern->id,
                'mentor_id' => $mentor->id,
                'started_at' => $today,
            ]);

            $profile->update(['mentor_id' => $mentor->id]);

            // Logbook dan izin pending ikut otomatis karena mentornya dibaca dari profil.
            $moved = AttendanceCorrection::query()
                ->where('intern_id', $intern->id)
                ->where('status', CorrectionStatus::PendingMentor)
                ->update(['mentor_id' => $mentor->id]);

            $from = $oldMentor === null ? '' : " dari {$oldMentor->name}";
            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $intern->name, "Ganti mentor{$from} ke {$mentor->name}.");

            return [$oldMentor, $moved];
        });

        $this->notifier->send([$intern->id], "Mentor Anda sekarang {$mentor->name}.", '/');
        $this->notifier->send([$mentor->id], "Intern {$intern->name} kini menjadi bimbingan Anda.", '/intern-saya');

        if ($oldMentor !== null) {
            $this->notifier->send([$oldMentor->id], "Intern {$intern->name} tidak lagi menjadi bimbingan Anda.", '/intern-saya');
        }

        return ['pending_corrections' => $moved];
    }

    /**
     * @throws ActionRejected
     */
    public function deactivate(User $admin, User $user, CarbonInterface $now): User
    {
        if ($admin->is($user)) {
            throw new ActionRejected(self::CANNOT_DEACTIVATE_SELF, 'self');
        }

        DB::transaction(function () use ($admin, $user, $now): void {
            if ($user->hasRole(Role::Admin)) {
                // Pelaku selalu admin aktif lain, jadi aturan ini hanya terpicu saat dua admin saling
                // menonaktifkan bersamaan. Semua admin aktif dikunci dengan urutan sama agar kedua
                // permintaan berjalan bergantian, lalu yang kedua ditolak. Ambil id lalu hitung,
                // karena PostgreSQL menolak FOR UPDATE bersama COUNT().
                $activeAdmins = User::query()
                    ->where('role', Role::Admin)
                    ->where('is_active', true)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->pluck('id');

                if ($activeAdmins->reject(fn (int $id): bool => $id === $user->id)->isEmpty()) {
                    throw new ActionRejected(self::LAST_ADMIN, 'last_admin');
                }
            }

            $user = User::query()->lockForUpdate()->findOrFail($user->id);

            if (! $user->is_active) {
                throw new ActionRejected(self::ALREADY_INACTIVE, 'already_inactive');
            }

            if ($user->hasRole(Role::Mentor) && $this->hasActiveInterns($user, $now->toDateString())) {
                throw new ActionRejected(self::MENTOR_HAS_INTERNS, 'mentor_has_interns');
            }

            $user->update(['is_active' => false]);
            $user->tokens()->delete();

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $user->name, 'Nonaktifkan akun.');
        });

        return $user->refresh();
    }

    /**
     * @throws ActionRejected
     */
    public function activate(User $admin, User $user, CarbonInterface $now): User
    {
        $profile = $user->internProfile;

        if ($user->hasRole(Role::Intern) && $profile !== null && $profile->end_date->toDateString() < $now->toDateString()) {
            throw new ActionRejected(self::INTERNSHIP_ENDED, 'internship_ended');
        }

        if ($user->is_active) {
            throw new ActionRejected(self::ALREADY_ACTIVE, 'already_active');
        }

        DB::transaction(function () use ($admin, $user): void {
            $user->update(['is_active' => true]);

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $user->name, 'Aktifkan akun.');
        });

        return $user;
    }

    /**
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function extend(User $admin, User $intern, string $endDate, CarbonInterface $now): User
    {
        if (! $intern->hasRole(Role::Intern)) {
            throw new ActionRejected(self::EXTEND_NOT_INTERN, 'not_intern');
        }

        DB::transaction(function () use ($admin, $intern, $endDate, $now): void {
            // Dikunci agar dua admin yang memperpanjang bersamaan dibandingkan dengan tanggal selesai terbaru.
            $profile = InternProfile::query()->where('user_id', $intern->id)->lockForUpdate()->firstOrFail();
            $oldEnd = $profile->end_date;

            if ($endDate <= $oldEnd->toDateString()) {
                throw ValidationException::withMessages(['end_date' => self::EXTEND_NOT_AFTER_END]);
            }

            if ($endDate < $now->toDateString()) {
                throw ValidationException::withMessages(['end_date' => self::EXTEND_IN_PAST]);
            }

            $profile->update(['end_date' => $endDate]);

            $detail = 'Perpanjang magang dari '.IndonesianDate::withYear($oldEnd).' ke '.IndonesianDate::withYear($profile->end_date).'.';

            if (! $intern->is_active) {
                $intern->update(['is_active' => true]);
                $detail .= ' Akun diaktifkan kembali.';
            }

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $intern->name, $detail);
        });

        return $intern->refresh();
    }

    private function hasActiveInterns(User $mentor, string $today): bool
    {
        return User::query()
            ->where('role', Role::Intern)
            ->where('is_active', true)
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id)->whereDate('end_date', '>=', $today))
            ->exists();
    }
}

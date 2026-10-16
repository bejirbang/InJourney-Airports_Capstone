<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Role $role
 * @property string $title
 * @property string|null $phone
 * @property bool $is_active
 * @property bool $must_change_password
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read InternProfile|null $internProfile
 * @property-read Collection<int, Attendance> $attendances
 * @property-read Collection<int, LeaveRequest> $leaveRequests
 * @property-read Collection<int, Task> $assignedTasks
 * @property-read Collection<int, AttendanceCorrection> $attendanceCorrections
 */
#[Fillable(['name', 'email', 'password', 'role', 'title', 'phone', 'is_active', 'must_change_password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * Email disimpan huruf kecil agar login tidak peka huruf besar.
     *
     * @return Attribute<string, string>
     */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => mb_strtolower(trim($value)));
    }

    /**
     * @return HasOne<InternProfile, $this>
     */
    public function internProfile(): HasOne
    {
        return $this->hasOne(InternProfile::class);
    }

    /**
     * Absensi milik intern ini.
     *
     * @return HasMany<Attendance, $this>
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'intern_id');
    }

    /**
     * @return HasMany<LeaveRequest, $this>
     */
    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'intern_id');
    }

    /**
     * @return HasMany<AttendanceCorrection, $this>
     */
    public function attendanceCorrections(): HasMany
    {
        return $this->hasMany(AttendanceCorrection::class, 'intern_id');
    }

    /**
     * Nama pendek untuk notifikasi: "Rina Wulandari" menjadi "Rina W.".
     */
    public function shortName(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [];

        return count($parts) < 2 ? $this->name : $parts[0].' '.mb_substr($parts[1], 0, 1).'.';
    }

    /**
     * Task yang dikerjakan intern ini (bukan Task yang dibuat mentor).
     *
     * @return HasMany<Task, $this>
     */
    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'intern_id');
    }

    public function hasRole(Role $role): bool
    {
        return $this->role === $role;
    }
}

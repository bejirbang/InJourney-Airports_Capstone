<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
 * @property int|null $unit_id
 * @property string|null $phone
 * @property bool $is_active
 * @property bool $must_change_password
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Unit|null $unit
 * @property-read InternProfile|null $internProfile
 * @property-read Collection<int, Attendance> $attendances
 * @property-read Collection<int, LeaveRequest> $leaveRequests
 * @property-read Collection<int, AttendanceCorrection> $attendanceCorrections
 * @property-read Collection<int, Warning> $warnings
 * @property-read int|null $warnings_count
 * @property-read FinalPresentation|null $finalPresentation
 * @property-read Assessment|null $assessment
 */
#[Fillable(['name', 'email', 'password', 'role', 'unit_id', 'phone', 'is_active', 'must_change_password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, SoftDeletes;

    /**
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
     * @return Attribute<string, string>
     */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => mb_strtolower(trim($value)));
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * @return HasOne<InternProfile, $this>
     */
    public function internProfile(): HasOne
    {
        return $this->hasOne(InternProfile::class);
    }

    /**
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
     * @return HasMany<Warning, $this>
     */
    public function warnings(): HasMany
    {
        return $this->hasMany(Warning::class, 'intern_id');
    }

    /**
     * @return HasOne<FinalPresentation, $this>
     */
    public function finalPresentation(): HasOne
    {
        return $this->hasOne(FinalPresentation::class, 'intern_id');
    }

    /**
     * @return HasOne<Assessment, $this>
     */
    public function assessment(): HasOne
    {
        return $this->hasOne(Assessment::class, 'intern_id');
    }

    public function shortName(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [];

        return count($parts) < 2 ? $this->name : $parts[0].' '.mb_substr($parts[1], 0, 1).'.';
    }

    public function hasRole(Role $role): bool
    {
        return $this->role === $role;
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeReachable(Builder $query, string $date): Builder
    {
        return $query->where('is_active', true)->where(fn (Builder $q) => $q
            ->where('role', '!=', Role::Intern)
            ->orWhereHas('internProfile', fn (Builder $p) => $p->whereDate('end_date', '>=', $date)));
    }

    public function isReachable(string $date): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if (! $this->hasRole(Role::Intern)) {
            return true;
        }

        $profile = $this->internProfile;

        return $profile !== null && $profile->end_date->toDateString() >= $date;
    }
}

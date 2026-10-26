<?php

namespace App\Http\Resources;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * Relasi yang dipakai halaman Profil.
     */
    public static function withProfile(User $user): User
    {
        return $user->loadMissing(['unit', 'internProfile.mentor:id,name', 'internProfile.airport:id,name']);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $profile = $this->role === Role::Intern && $this->relationLoaded('internProfile') ? $this->internProfile : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'unit' => $this->unit === null ? null : ['id' => $this->unit->id, 'name' => $this->unit->name],
            'phone' => $this->phone,
            'is_active' => $this->is_active,
            'must_change_password' => $this->must_change_password,
            'home_path' => $this->role->homePath(),
            'intern_profile' => $this->when($profile !== null, fn (): array => [
                'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
                'airport' => ['id' => $profile->airport->id, 'name' => $profile->airport->name],
                'institution_type' => $profile->institution_type?->value,
                'university' => $profile->university,
                'major' => $profile->major,
                'student_number' => $profile->student_number,
                'start_date' => $profile->start_date->toDateString(),
                'end_date' => $profile->end_date->toDateString(),
            ]),
        ];
    }
}

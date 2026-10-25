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
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
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
            'intern_profile' => $this->when(
                $this->role === Role::Intern && $this->relationLoaded('internProfile') && $this->internProfile !== null,
                fn (): array => [
                    'mentor_id' => $this->internProfile?->mentor_id,
                    'start_date' => $this->internProfile?->start_date->toDateString(),
                    'end_date' => $this->internProfile?->end_date->toDateString(),
                ],
            ),
        ];
    }
}

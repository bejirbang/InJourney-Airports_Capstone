<?php

namespace App\Http\Resources;

use App\Enums\Role;
use App\Models\User;
use App\Services\AccountAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class AdminUserResource extends JsonResource
{
    /** @var array<string, mixed>|null */
    private ?array $detail = null;

    /**
     * @param  array<string, mixed>  $extra
     */
    public function withDetail(array $extra): static
    {
        $this->detail = $extra;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $profile = $this->role === Role::Intern ? $this->internProfile : null;
        $mentor = $profile?->mentor;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'unit' => $this->unit === null ? null : ['id' => $this->unit->id, 'name' => $this->unit->name],
            'status' => app(AccountAccess::class)->status($this->resource)->value,
            'mentor' => $mentor === null ? null : ['id' => $mentor->id, 'name' => $mentor->name],
            'airport' => $profile === null ? null : ['id' => $profile->airport->id, 'name' => $profile->airport->name],
            'institution_type' => $profile?->institution_type?->value,
            'university' => $profile?->university,
            'major' => $profile?->major,
            'student_number' => $profile?->student_number,
            'start_date' => $profile?->start_date->toDateString(),
            'end_date' => $profile?->end_date->toDateString(),
            ...($this->detail === null ? [] : [
                'phone' => $this->phone,
                'is_active' => $this->is_active,
                'must_change_password' => $this->must_change_password,
                'created_at' => $this->created_at?->toIso8601String(),
                ...$this->detail,
            ]),
        ];
    }
}

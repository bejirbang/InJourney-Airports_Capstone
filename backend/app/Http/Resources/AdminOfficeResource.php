<?php

namespace App\Http\Resources;

use App\Models\Office;
use Illuminate\Http\Request;

/**
 * @mixin Office
 */
class AdminOfficeResource extends OfficeResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'airport' => ['id' => $this->airport->id, 'name' => $this->airport->name],
            'is_active' => $this->is_active,
        ];
    }
}

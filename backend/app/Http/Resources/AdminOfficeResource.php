<?php

namespace App\Http\Resources;

use App\Models\Office;
use Illuminate\Http\Request;

/**
 * Baris daftar Lokasi Kantor admin: data kantor untuk intern ditambah status Aktif atau Nonaktif.
 *
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
            'is_active' => $this->is_active,
        ];
    }
}

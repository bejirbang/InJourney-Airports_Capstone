<?php

namespace App\Http\Resources;

use App\Models\Announcement;
use Illuminate\Http\Request;

/**
 * @mixin Announcement
 */
class AdminAnnouncementResource extends AnnouncementResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'for_intern' => $this->for_intern,
            'for_mentor' => $this->for_mentor,
        ];
    }
}

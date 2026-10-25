<?php

namespace App\Http\Resources;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Attendance
 */
class AttendanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'status' => $this->status()->value,
            'clock_in_at' => $this->clock_in_at === null ? null : substr($this->clock_in_at, 0, 5),
            'clock_out_at' => $this->clock_out_at === null ? null : substr($this->clock_out_at, 0, 5),
            'late_minutes' => $this->lateMinutes(),
            'scheduled' => ['start' => substr($this->scheduled_start, 0, 5), 'end' => substr($this->scheduled_end, 0, 5)],
            'clock_in_office' => $this->whenLoaded('clockInOffice', fn () => $this->clockInOffice === null ? null : [
                'id' => $this->clockInOffice->id,
                'name' => $this->clockInOffice->name,
            ]),
            'clock_out_office' => $this->whenLoaded('clockOutOffice', fn () => $this->clockOutOffice === null ? null : [
                'id' => $this->clockOutOffice->id,
                'name' => $this->clockOutOffice->name,
            ]),
            'logbook_status' => $this->whenLoaded('logbook', fn () => $this->logbook?->status->value),
            'is_corrected' => $this->is_corrected,
        ];
    }
}

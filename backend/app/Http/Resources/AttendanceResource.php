<?php

namespace App\Http\Resources;

use App\Models\Attendance;
use App\Models\WorkHourSetting;
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
            'clock_in_at' => substr($this->clock_in_at, 0, 5),
            'clock_out_at' => $this->clock_out_at === null ? null : substr($this->clock_out_at, 0, 5),
            'late_minutes' => $this->lateMinutes(WorkHourSetting::effectiveOn($this->date->toDateString())),
            'clock_in_office' => $this->whenLoaded('clockInOffice', fn () => $this->clockInOffice === null ? null : [
                'id' => $this->clockInOffice->id,
                'name' => $this->clockInOffice->name,
            ]),
            'clock_out_office' => $this->whenLoaded('clockOutOffice', fn () => $this->clockOutOffice === null ? null : [
                'id' => $this->clockOutOffice->id,
                'name' => $this->clockOutOffice->name,
            ]),
            'is_corrected' => $this->is_corrected,
        ];
    }
}

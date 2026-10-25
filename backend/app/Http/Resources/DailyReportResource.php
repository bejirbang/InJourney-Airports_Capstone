<?php

namespace App\Http\Resources;

use App\Models\Logbook;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Date;

/**
 * @mixin Logbook
 */
class DailyReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $attendance = $this->attendance;

        return [
            'id' => $this->id,
            'date' => $attendance->date->toDateString(),
            'work' => $this->work,
            'notes' => $this->notes,
            'status' => $this->status->value,
            'sent_at' => $this->updated_at?->toIso8601String(),
            'editable' => $attendance->clock_out_at === null
                && $attendance->date->toDateString() === Date::now()->toDateString(),
        ];
    }
}

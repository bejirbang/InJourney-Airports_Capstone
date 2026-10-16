<?php

namespace App\Http\Resources;

use App\Models\DailyReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Date;

/**
 * @mixin DailyReport
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
            'sent_at' => $this->sent_at->toIso8601String(),
            // Bisa diubah hanya pada hari yang sama dan sebelum clock out.
            'editable' => $attendance->clock_out_at === null
                && $attendance->date->toDateString() === Date::now()->toDateString(),
        ];
    }
}

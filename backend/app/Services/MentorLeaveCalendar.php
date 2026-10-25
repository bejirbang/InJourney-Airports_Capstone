<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class MentorLeaveCalendar
{
    /**
     * @return array<string, mixed>
     */
    public function month(User $mentor, string $month, ?int $internId, CarbonInterface $now): array
    {
        [$from, $to] = AttendanceCalendar::monthRange($month);

        $leaves = LeaveRequest::query()
            ->with('intern:id,name')
            ->whereHas('intern.internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->whereIn('status', [RequestStatus::Pending, RequestStatus::Approved])
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->when($internId, fn (Builder $q, int $id) => $q->where('intern_id', $id))
            ->orderBy('start_date')
            ->orderBy('id')
            ->get();

        $holidays = Holiday::query()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->mapWithKeys(fn (Holiday $h): array => [$h->date->toDateString() => $h->name])
            ->all();

        $today = $now->toDateString();
        $days = [];

        for ($date = Carbon::parse($from); $date->toDateString() <= $to; $date->addDay()) {
            $day = $date->toDateString();
            $off = $date->isWeekend() || isset($holidays[$day]);

            $days[] = [
                'date' => $day,
                'weekday' => $date->isoWeekday(),
                'is_today' => $day === $today,
                'is_off' => $off,
                'holiday_name' => $holidays[$day] ?? null,
                'entries' => $off ? [] : $leaves
                    ->filter(fn (LeaveRequest $leave): bool => $leave->covers($day))
                    ->map(fn (LeaveRequest $leave): array => [
                        'leave_id' => $leave->id,
                        'intern_id' => $leave->intern_id,
                        'short_name' => $leave->intern->shortName(),
                        'type' => $leave->type->value,
                        'status' => $leave->status->value,
                    ])
                    ->values()
                    ->all(),
            ];
        }

        return [
            'month' => $month,
            'days' => $days,
            'leaves' => $leaves->map(fn (LeaveRequest $leave): array => [
                'id' => $leave->id,
                'intern' => ['id' => $leave->intern->id, 'name' => $leave->intern->name, 'short_name' => $leave->intern->shortName()],
                'type' => $leave->type->value,
                'start_date' => $leave->start_date->toDateString(),
                'end_date' => $leave->end_date->toDateString(),
                'status' => $leave->status->value,
            ])->values()->all(),
        ];
    }
}

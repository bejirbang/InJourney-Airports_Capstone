<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Support\DaySchedule;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Hari libur mengikuti jadwal bandara tiap intern dan kalender libur admin. Izin hanya tampil pada hari kerja
 * intern itu. Tanpa filter intern, satu hari ditandai libur hanya jika libur untuk semua bandara intern bimbingan.
 */
class MentorLeaveCalendar
{
    public function __construct(private WorkSchedules $schedules) {}

    /**
     * @return array<string, mixed>
     */
    public function month(User $mentor, string $month, ?int $internId, CarbonInterface $now): array
    {
        [$from, $to] = AttendanceCalendar::monthRange($month);

        $mentees = User::query()
            ->with('internProfile')
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->when($internId, fn (Builder $q, int $id) => $q->whereKey($id))
            ->get();

        $airportOf = $mentees->mapWithKeys(fn (User $intern): array => [$intern->id => (int) $intern->internProfile?->airport_id])->all();

        /** @var array<int, array<string, DaySchedule>> $schedules */
        $schedules = [];

        foreach (array_unique($airportOf) as $airportId) {
            $schedules[$airportId] = $this->schedules->between($airportId, $from, $to);
        }

        $leaves = LeaveRequest::query()
            ->with('intern:id,name')
            ->whereIn('intern_id', array_keys($airportOf))
            ->whereIn('status', [RequestStatus::Pending, RequestStatus::Approved])
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
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
            $offAt = fn (int $airportId): bool => ! $schedules[$airportId][$day]->isWorkday;
            $off = isset($holidays[$day]) || ($schedules === [] ? $date->isWeekend() : array_filter(array_keys($schedules), fn (int $id): bool => ! $offAt($id)) === []);

            $days[] = [
                'date' => $day,
                'weekday' => $date->isoWeekday(),
                'is_today' => $day === $today,
                'is_off' => $off,
                'holiday_name' => $holidays[$day] ?? null,
                'entries' => array_values($leaves
                    ->filter(fn (LeaveRequest $leave): bool => $leave->covers($day) && ! $offAt($airportOf[$leave->intern_id]))
                    ->map(fn (LeaveRequest $leave): array => [
                        'leave_id' => $leave->id,
                        'intern_id' => $leave->intern_id,
                        'short_name' => $leave->intern->shortName(),
                        'type' => $leave->type->value,
                        'status' => $leave->status->value,
                    ])
                    ->all()),
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

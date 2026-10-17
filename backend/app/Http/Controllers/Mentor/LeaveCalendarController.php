<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mentor\MonthFilterRequest;
use App\Models\User;
use App\Services\MentorLeaveCalendar;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

/**
 * Kalender Izin mentor (docs/design-mentor.md, Alur 8).
 */
class LeaveCalendarController extends Controller
{
    public function __invoke(MonthFilterRequest $request, MentorLeaveCalendar $calendar): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();
        $now = Date::now();

        return response()->json(['data' => $calendar->month(
            $mentor,
            $request->string('month', $now->format('Y-m'))->value(),
            $request->filled('intern_id') ? $request->integer('intern_id') : null,
            $now,
        )]);
    }
}

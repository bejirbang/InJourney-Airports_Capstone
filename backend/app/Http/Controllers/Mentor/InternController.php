<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mentor\InternIndexRequest;
use App\Http\Requests\Shared\AttendanceHistoryRequest;
use App\Models\User;
use App\Services\AttendanceHistory;
use App\Services\MentorInterns;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;

class InternController extends Controller
{
    public function __construct(private MentorInterns $interns) {}

    public function index(InternIndexRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $result = $this->interns->list(
            $mentor,
            $request->string('status', 'active')->value(),
            $request->filled('q') ? $request->string('q')->value() : null,
            Date::now(),
        );

        return response()->json([
            'data' => $result['interns'],
            'meta' => ['current_total' => $result['current_total'], 'former_total' => $result['former_total']],
        ]);
    }

    public function show(Request $request, User $intern): JsonResponse
    {
        Gate::authorize('viewAsMentor', $intern);

        return response()->json(['data' => $this->interns->detail($intern, $this->relation($request, $intern), Date::now())]);
    }

    public function attendance(AttendanceHistoryRequest $request, User $intern, AttendanceHistory $history): JsonResponse
    {
        Gate::authorize('viewAsMentor', $intern);

        $month = $request->filled('month') ? $request->string('month')->value() : null;

        return response()->json(['data' => $history->monthForMentor($intern, $month, Date::now())]);
    }

    public function day(User $intern, string $date, AttendanceHistory $history): JsonResponse
    {
        Gate::authorize('viewAsMentor', $intern);

        return response()->json(['data' => $history->dayForMentor($intern, $date, Date::now())]);
    }

    public function dailyReports(AttendanceHistoryRequest $request, User $intern, AttendanceHistory $history): JsonResponse
    {
        Gate::authorize('viewAsMentor', $intern);

        $month = $request->filled('month') ? $request->string('month')->value() : null;

        return response()->json(['data' => $history->dailyReports($intern, $month, Date::now())]);
    }

    public function tasks(Request $request, User $intern): JsonResponse
    {
        Gate::authorize('viewAsMentor', $intern);

        /** @var User $mentor */
        $mentor = $request->user();

        return response()->json(['data' => $this->interns->tasks($mentor, $intern, $this->relation($request, $intern), Date::now())]);
    }

    public function leaves(Request $request, User $intern): JsonResponse
    {
        Gate::authorize('viewAsMentor', $intern);

        return response()->json(['data' => $this->interns->leaves($intern, $this->relation($request, $intern))]);
    }

    private function relation(Request $request, User $intern): string
    {
        /** @var User $mentor */
        $mentor = $request->user();

        return (string) $this->interns->relation($mentor, $intern);
    }
}

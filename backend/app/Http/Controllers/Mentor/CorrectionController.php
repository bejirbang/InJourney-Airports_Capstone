<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\CorrectionDecisionRequest;
use App\Http\Requests\Shared\CorrectionIndexRequest;
use App\Http\Resources\AttendanceCorrectionResource;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Services\AttendanceCorrections;
use App\Services\MentorCorrections;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;

class CorrectionController extends Controller
{
    public function __construct(private MentorCorrections $corrections) {}

    public function index(CorrectionIndexRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $result = $this->corrections->list($mentor, $request->tab(), $request->internId());

        return response()->json([
            'data' => AttendanceCorrectionResource::collection($result['corrections']),
            'meta' => ['pending_count' => $result['pending_count']],
        ]);
    }

    public function show(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        Gate::authorize('manage', $correction);

        return $this->detailed($correction);
    }

    public function approve(CorrectionDecisionRequest $request, AttendanceCorrection $correction): JsonResponse
    {
        Gate::authorize('manage', $correction);

        /** @var User $mentor */
        $mentor = $request->user();

        return response()->json([
            'message' => 'Koreksi di-ACC dan diteruskan ke admin.',
            'data' => $this->detailed($this->corrections->approve($mentor, $correction, $request->note(), Date::now())),
        ]);
    }

    public function reject(CorrectionDecisionRequest $request, AttendanceCorrection $correction): JsonResponse
    {
        Gate::authorize('manage', $correction);

        /** @var User $mentor */
        $mentor = $request->user();

        return response()->json([
            'message' => 'Koreksi ditolak.',
            'data' => $this->detailed($this->corrections->reject($mentor, $correction, (string) $request->note(), Date::now())),
        ]);
    }

    private function detailed(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        $correction->load(['intern:id,name', 'mentor:id,name', 'admin:id,name']);

        return (new AttendanceCorrectionResource($correction))->withDetail([
            'recorded' => AttendanceCorrections::recorded(AttendanceCorrections::attendanceOf($correction)),
        ]);
    }
}

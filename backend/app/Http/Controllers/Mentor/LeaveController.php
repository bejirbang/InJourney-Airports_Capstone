<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\LeaveDecisionRequest;
use App\Http\Requests\Shared\ReviewerLeaveIndexRequest;
use App\Http\Resources\MentorLeaveResource;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\LeaveDecisions;
use App\Services\MentorLeaves;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LeaveController extends Controller
{
    public function __construct(private MentorLeaves $leaves) {}

    public function index(ReviewerLeaveIndexRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $result = $this->leaves->list($mentor, [
            'tab' => $request->input('tab'),
            'type' => $request->input('type'),
            'intern_id' => $request->input('intern_id'),
        ]);

        return response()->json([
            'data' => MentorLeaveResource::collection($result['leaves']),
            'meta' => ['pending_count' => $result['pending_count']],
        ]);
    }

    public function show(LeaveRequest $leave): MentorLeaveResource
    {
        Gate::authorize('manage', $leave);

        return (new MentorLeaveResource($leave->load(['intern:id,name', 'decider:id,name,role'])))->withDetail();
    }

    public function evidence(Request $request, LeaveRequest $leave): StreamedResponse
    {
        Gate::authorize('manage', $leave);

        $path = $leave->evidence_path;
        abort_if($path === null || ! Storage::exists($path), 404, 'Lampiran tidak ditemukan.');

        return $request->boolean('inline')
            ? Storage::response($path, $leave->evidenceFileName())
            : Storage::download($path, $leave->evidenceFileName());
    }

    public function approve(LeaveDecisionRequest $request, LeaveRequest $leave, LeaveDecisions $decisions): JsonResponse
    {
        return $this->decide($request, $leave, $decisions, true);
    }

    public function reject(LeaveDecisionRequest $request, LeaveRequest $leave, LeaveDecisions $decisions): JsonResponse
    {
        return $this->decide($request, $leave, $decisions, false);
    }

    private function decide(LeaveDecisionRequest $request, LeaveRequest $leave, LeaveDecisions $decisions, bool $approve): JsonResponse
    {
        Gate::authorize('manage', $leave);

        /** @var User $mentor */
        $mentor = $request->user();

        $decided = $decisions->decide($mentor, $leave, $approve, $request->string('note')->value(), Date::now());

        return response()->json([
            'message' => $approve ? 'Izin disetujui. Intern sudah diberi tahu.' : 'Izin ditolak. Intern sudah diberi tahu.',
            'data' => (new MentorLeaveResource($decided))->withDetail(),
        ]);
    }
}

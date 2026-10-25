<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\LeaveDecisionRequest;
use App\Http\Requests\Shared\ReviewerLeaveIndexRequest;
use App\Http\Resources\AdminLeaveResource;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\AdminLeaves;
use App\Services\LeaveDecisions;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class LeaveController extends Controller
{
    public function __construct(private AdminLeaves $leaves) {}

    public function index(ReviewerLeaveIndexRequest $request): JsonResponse
    {
        $result = $this->leaves->list([
            'tab' => $request->input('tab'),
            'type' => $request->input('type'),
            'intern_id' => $request->filled('intern_id') ? $request->integer('intern_id') : null,
            'airport_id' => $request->filled('airport_id') ? $request->integer('airport_id') : null,
            'quota_exhausted' => $request->boolean('quota_exhausted'),
        ], Date::now());

        return response()->json([
            'data' => AdminLeaveResource::collection($result['leaves']),
            'meta' => [
                'pending_count' => $result['pending_count'],
                'interns' => $this->leaves->interns(),
            ],
        ]);
    }

    public function show(LeaveRequest $leave): AdminLeaveResource
    {
        return $this->detailed($leave);
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
        /** @var User $admin */
        $admin = $request->user();

        $decided = $decisions->decide(
            $admin,
            $leave,
            $approve,
            $request->string('note')->value(),
            Date::now(),
            $request->boolean('evidence_checked'),
        );

        return response()->json([
            'message' => $approve ? 'Izin disetujui. Intern dan mentor sudah diberi tahu.' : 'Izin ditolak. Intern dan mentor sudah diberi tahu.',
            'data' => $this->detailed($decided),
        ]);
    }

    private function detailed(LeaveRequest $leave): AdminLeaveResource
    {
        return (new AdminLeaveResource($leave->load(['intern:id,name', 'intern.internProfile.mentor:id,name', 'decider:id,name,role'])))->withDetail();
    }
}

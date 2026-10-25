<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\LeaveIndexRequest;
use App\Http\Requests\Intern\LeaveRequestForm;
use App\Http\Requests\Intern\LeaveWorkingDaysRequest;
use App\Http\Resources\InternLeaveResource;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\InternLeaves;
use App\Services\LeaveQuotas;
use App\Services\WorkSchedules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class LeaveController extends Controller
{
    public function index(LeaveIndexRequest $request, LeaveQuotas $quotas): AnonymousResourceCollection
    {
        /** @var User $intern */
        $intern = $request->user();

        $leaves = $intern->leaveRequests()
            ->with('decider:id,name,role')
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();

        return InternLeaveResource::collection($leaves)->additional(['meta' => ['quota' => $quotas->summary($intern)]]);
    }

    public function workingDays(LeaveWorkingDaysRequest $request, WorkSchedules $schedules): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => [
            'working_days' => $schedules->workingDays($intern, $request->string('start_date')->value(), $request->string('end_date')->value()),
        ]]);
    }

    public function store(LeaveRequestForm $request, InternLeaves $leaves): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $leave = $leaves->submit($intern, [
            'type' => $request->string('type')->value(),
            'start_date' => $request->string('start_date')->value(),
            'end_date' => $request->string('end_date')->value(),
            'reason' => $request->string('reason')->value(),
            'evidence_url' => $request->filled('evidence_url') ? $request->string('evidence_url')->value() : null,
        ]);

        return response()->json([
            'message' => 'Izin diajukan. Menunggu mentor.',
            'data' => new InternLeaveResource($leave),
        ], Response::HTTP_CREATED);
    }

    public function show(LeaveRequest $leave): InternLeaveResource
    {
        Gate::authorize('view', $leave);

        return new InternLeaveResource($leave->load('decider:id,name,role'));
    }

    public function cancel(Request $request, LeaveRequest $leave, InternLeaves $leaves): JsonResponse
    {
        Gate::authorize('cancel', $leave);

        /** @var User $intern */
        $intern = $request->user();

        return response()->json([
            'message' => 'Pengajuan izin dibatalkan.',
            'data' => new InternLeaveResource($leaves->cancel($intern, $leave)),
        ]);
    }
}

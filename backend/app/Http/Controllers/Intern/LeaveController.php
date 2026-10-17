<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\LeaveIndexRequest;
use App\Http\Requests\Intern\LeaveRequestForm;
use App\Http\Requests\Intern\LeaveWorkingDaysRequest;
use App\Http\Resources\InternLeaveResource;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\AttendanceCalendar;
use App\Services\InternLeaves;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Halaman Izin intern (docs/design-intern.md, Alur 11).
 */
class LeaveController extends Controller
{
    /**
     * Riwayat izin, tanggal izin terbaru lebih dulu. Filter `status` opsional.
     */
    public function index(LeaveIndexRequest $request): AnonymousResourceCollection
    {
        /** @var User $intern */
        $intern = $request->user();

        $leaves = $intern->leaveRequests()
            ->with('decider:id,name,role')
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();

        return InternLeaveResource::collection($leaves);
    }

    /**
     * "Total: 2 hari kerja" di formulir, sebelum dikirim.
     */
    public function workingDays(LeaveWorkingDaysRequest $request, AttendanceCalendar $calendar): JsonResponse
    {
        return response()->json(['data' => [
            'working_days' => $calendar->workingDays($request->string('start_date')->value(), $request->string('end_date')->value()),
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
        ], $request->file('evidence'));

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

    /**
     * Unduh lampiran setelah hak akses dicek; file tidak pernah diberi URL publik.
     */
    public function evidence(LeaveRequest $leave): StreamedResponse
    {
        Gate::authorize('view', $leave);

        $path = $leave->evidence_path;
        abort_if($path === null || ! Storage::exists($path), 404, 'Lampiran tidak ditemukan.');

        return Storage::download($path, $leave->evidenceFileName());
    }
}

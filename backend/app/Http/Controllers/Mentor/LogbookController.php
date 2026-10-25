<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mentor\LogbookBulkApproveRequest;
use App\Http\Requests\Mentor\LogbookIndexRequest;
use App\Http\Requests\Mentor\LogbookReviewRequest;
use App\Http\Resources\MentorLogbookResource;
use App\Models\Logbook;
use App\Models\User;
use App\Services\MentorLogbooks;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;

class LogbookController extends Controller
{
    public function __construct(private MentorLogbooks $logbooks) {}

    public function index(LogbookIndexRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $result = $this->logbooks->list($mentor, $request->tab(), $request->internId());

        return response()->json([
            'data' => MentorLogbookResource::collection($result['logbooks']),
            'meta' => $result['counts'],
        ]);
    }

    public function show(LogbookIndexRequest $request, Logbook $logbook): MentorLogbookResource
    {
        Gate::authorize('review', $logbook);

        /** @var User $mentor */
        $mentor = $request->user();

        return $this->detailed($mentor, $logbook, $request->tab());
    }

    public function approve(LogbookReviewRequest $request, Logbook $logbook): JsonResponse
    {
        Gate::authorize('review', $logbook);

        /** @var User $mentor */
        $mentor = $request->user();
        $logbook = $this->logbooks->approve($mentor, $logbook, $request->comment(), Date::now());

        return response()->json(['message' => 'Logbook disetujui.', 'data' => $this->detailed($mentor, $logbook, null)]);
    }

    public function revise(LogbookReviewRequest $request, Logbook $logbook): JsonResponse
    {
        Gate::authorize('review', $logbook);

        /** @var User $mentor */
        $mentor = $request->user();
        $logbook = $this->logbooks->requestRevision($mentor, $logbook, (string) $request->comment());

        return response()->json(['message' => 'Permintaan revisi terkirim ke intern.', 'data' => $this->detailed($mentor, $logbook, null)]);
    }

    public function approveMany(LogbookBulkApproveRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();
        $result = $this->logbooks->approveMany($mentor, $request->ids(), Date::now());
        $count = count($result['approved']);

        return response()->json([
            'message' => $result['skipped'] === []
                ? "{$count} logbook disetujui."
                : "{$count} logbook disetujui. ".count($result['skipped']).' logbook dilewati karena sudah tidak menunggu review.',
            'data' => $result,
        ]);
    }

    private function detailed(User $mentor, Logbook $logbook, ?string $tab): MentorLogbookResource
    {
        $logbook->load(['attendance.intern.internProfile', 'reviews.mentor:id,name']);
        $now = Date::now();
        $inactive = $this->logbooks->internInactive($logbook, $now);

        return (new MentorLogbookResource($logbook))->withDetail([
            'intern_inactive' => $inactive,
            'warning' => $inactive && $logbook->status->value === MentorLogbooks::TAB_REVISION ? MentorLogbooks::INTERN_INACTIVE : null,
            'can_approve' => $this->logbooks->canApprove($logbook, $now),
            'can_request_revision' => $logbook->status->value === MentorLogbooks::TAB_PENDING,
            ...$this->logbooks->neighbours($mentor, $logbook, $tab),
        ]);
    }
}

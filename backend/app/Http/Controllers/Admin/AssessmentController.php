<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssessmentIndexRequest;
use App\Models\User;
use App\Services\Assessments;
use Illuminate\Http\JsonResponse;

class AssessmentController extends Controller
{
    public function __construct(private Assessments $assessments) {}

    public function index(AssessmentIndexRequest $request): JsonResponse
    {
        $result = $this->assessments->adminList($request->status(), $request->airportId());

        return response()->json(['data' => $result['rows'], 'meta' => $result['counts']]);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(['data' => $this->assessments->detail(InternRecordController::intern($user), false)]);
    }
}

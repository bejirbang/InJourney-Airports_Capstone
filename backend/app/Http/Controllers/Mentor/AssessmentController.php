<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mentor\AssessmentRequest;
use App\Models\User;
use App\Services\Assessments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;

class AssessmentController extends Controller
{
    public function __construct(private Assessments $assessments) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        return response()->json(['data' => $this->assessments->mentorList($mentor)]);
    }

    public function show(User $intern): JsonResponse
    {
        Gate::authorize('assess', $intern);

        return response()->json(['data' => $this->assessments->detail($intern, true)]);
    }

    public function update(AssessmentRequest $request, User $intern): JsonResponse
    {
        return $this->save($request, $intern, false, 'Draft penilaian tersimpan.');
    }

    public function submit(AssessmentRequest $request, User $intern): JsonResponse
    {
        return $this->save($request, $intern, true, 'Penilaian disubmit dan dikirim ke admin.');
    }

    private function save(AssessmentRequest $request, User $intern, bool $submit, string $message): JsonResponse
    {
        Gate::authorize('assess', $intern);

        /** @var User $mentor */
        $mentor = $request->user();

        $this->assessments->save($mentor, $intern, $request->scores(), $submit, Date::now());

        return response()->json([
            'message' => $message,
            'data' => $this->assessments->detail($intern->fresh() ?? $intern, true),
        ]);
    }
}

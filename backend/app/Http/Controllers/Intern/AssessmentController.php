<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Assessments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssessmentController extends Controller
{
    public function __invoke(Request $request, Assessments $assessments): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $assessments->internView($intern)]);
    }
}

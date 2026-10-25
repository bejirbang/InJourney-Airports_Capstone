<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PresentationDecisionRequest;
use App\Http\Requests\Admin\PresentationIndexRequest;
use App\Models\FinalPresentation;
use App\Models\User;
use App\Services\FinalPresentations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

class PresentationController extends Controller
{
    public function __construct(private FinalPresentations $presentations) {}

    public function index(PresentationIndexRequest $request): JsonResponse
    {
        $result = $this->presentations->adminList($request->tab(), $request->airportId(), Date::now());

        return response()->json(['data' => $result['rows'], 'meta' => $result['counts']]);
    }

    public function show(FinalPresentation $presentation): JsonResponse
    {
        return response()->json(['data' => $this->presentations->detail($presentation, Date::now())]);
    }

    public function approve(Request $request, FinalPresentation $presentation): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();

        return response()->json([
            'message' => 'Presentasi akhir disetujui.',
            'data' => $this->presentations->detail($this->presentations->approve($admin, $presentation, $now), $now),
        ]);
    }

    public function revise(PresentationDecisionRequest $request, FinalPresentation $presentation): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();

        return response()->json([
            'message' => 'Permintaan revisi terkirim ke intern.',
            'data' => $this->presentations->detail($this->presentations->requestRevision($admin, $presentation, $request->note(), $now), $now),
        ]);
    }
}

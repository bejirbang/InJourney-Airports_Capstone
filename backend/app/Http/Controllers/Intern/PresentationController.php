<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\PresentationRequest;
use App\Models\User;
use App\Services\FinalPresentations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

class PresentationController extends Controller
{
    public function __construct(private FinalPresentations $presentations) {}

    public function show(Request $request): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $this->presentations->forIntern($intern, Date::now())]);
    }

    public function update(PresentationRequest $request): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();
        $now = Date::now();

        $this->presentations->submit($intern, $request->evidenceUrl(), $now);

        return response()->json([
            'message' => 'Bukti presentasi terkirim. Menunggu verifikasi admin.',
            'data' => $this->presentations->forIntern($intern, $now),
        ]);
    }
}

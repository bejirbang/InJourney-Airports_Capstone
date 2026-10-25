<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\CorrectionDecisionRequest;
use App\Http\Requests\Shared\CorrectionIndexRequest;
use App\Http\Resources\AttendanceCorrectionResource;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Services\AdminCorrections;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class CorrectionController extends Controller
{
    public function __construct(private AdminCorrections $corrections) {}

    public function index(CorrectionIndexRequest $request): JsonResponse
    {
        $result = $this->corrections->list($request->tab(), $request->internId(), $request->airportId());

        return response()->json([
            'data' => AttendanceCorrectionResource::collection($result['corrections']),
            'meta' => [...$result['counts'], 'interns' => $this->corrections->interns()],
        ]);
    }

    public function show(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        return $this->detailed($correction);
    }

    public function approve(CorrectionDecisionRequest $request, AttendanceCorrection $correction): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json([
            'message' => 'Koreksi disetujui. Status hari itu menjadi Hadir.',
            'data' => $this->detailed($this->corrections->approve($admin, $correction, (string) $request->note(), Date::now())),
        ]);
    }

    public function reject(CorrectionDecisionRequest $request, AttendanceCorrection $correction): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json([
            'message' => 'Koreksi ditolak. Data presensi tidak berubah.',
            'data' => $this->detailed($this->corrections->reject($admin, $correction, (string) $request->note(), Date::now())),
        ]);
    }

    private function detailed(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        $correction->load(['intern:id,name', 'mentor:id,name', 'admin:id,name']);

        return (new AttendanceCorrectionResource($correction))->withDetail($this->corrections->preview($correction));
    }
}

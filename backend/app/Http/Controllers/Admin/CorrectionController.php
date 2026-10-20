<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CorrectionDecisionRequest;
use App\Http\Requests\Admin\CorrectionIndexRequest;
use App\Http\Resources\AdminCorrectionResource;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Services\AdminCorrections;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Halaman Koreksi Absensi admin (docs/design-admin.md, Alur 4): daftar, detail, bukti, Setujui, Tolak.
 */
class CorrectionController extends Controller
{
    public function __construct(private AdminCorrections $corrections) {}

    public function index(CorrectionIndexRequest $request): JsonResponse
    {
        $list = $this->corrections->list([
            'status' => $request->input('status'),
            'intern_id' => $request->filled('intern_id') ? $request->integer('intern_id') : null,
            'from' => $request->input('from'),
            'to' => $request->input('to'),
        ]);

        return response()->json([
            'data' => AdminCorrectionResource::collection($list),
            // Pilihan filter Intern.
            'meta' => ['interns' => $this->corrections->interns()],
        ]);
    }

    public function show(AttendanceCorrection $correction): AdminCorrectionResource
    {
        return $this->detailed($correction);
    }

    /**
     * Bukti koreksi. `?inline=1` untuk Pratinjau, tanpanya Unduh. Tanpa URL publik.
     */
    public function evidence(Request $request, AttendanceCorrection $correction): StreamedResponse
    {
        $path = $correction->evidence_path;
        abort_if($path === null || ! Storage::exists($path), 404, 'Bukti tidak ditemukan.');

        $name = "bukti-koreksi-{$correction->date->toDateString()}.".pathinfo($path, PATHINFO_EXTENSION);

        return $request->boolean('inline') ? Storage::response($path, $name) : Storage::download($path, $name);
    }

    public function approve(CorrectionDecisionRequest $request, AttendanceCorrection $correction): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $correction = $this->corrections->approve(
            $admin,
            $correction,
            $request->string('clock_in')->value(),
            $request->string('clock_out')->value(),
            $request->string('note')->value(),
            Date::now(),
        );

        return response()->json([
            'message' => 'Koreksi disetujui. Status absensi dihitung ulang.',
            'data' => $this->detailed($correction),
        ]);
    }

    public function reject(CorrectionDecisionRequest $request, AttendanceCorrection $correction): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $correction = $this->corrections->reject($admin, $correction, $request->string('note')->value(), Date::now());

        return response()->json([
            'message' => 'Koreksi ditolak. Data absensi tidak berubah.',
            'data' => $this->detailed($correction),
        ]);
    }

    private function detailed(AttendanceCorrection $correction): AdminCorrectionResource
    {
        $correction->load(['intern:id,name', 'decider:id,name']);

        return (new AdminCorrectionResource($correction))->withDetail($this->corrections->currentStatus($correction, Date::now()));
    }
}

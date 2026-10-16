<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\AttendanceCorrectionRequest;
use App\Http\Resources\AttendanceCorrectionResource;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Services\AttendanceCorrections;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Tab Koreksi di halaman Absensi intern (docs/design-intern.md, Alur 7).
 */
class AttendanceCorrectionController extends Controller
{
    /**
     * Permintaan koreksi milik intern, terbaru diajukan lebih dulu.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $intern */
        $intern = $request->user();

        $corrections = $intern->attendanceCorrections()
            ->with('decider:id,name')
            ->latest()
            ->latest('id')
            ->get();

        return AttendanceCorrectionResource::collection($corrections);
    }

    public function store(AttendanceCorrectionRequest $request, AttendanceCorrections $corrections): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $correction = $corrections->submit($intern, [
            'date' => $request->string('date')->value(),
            'clock_in' => $request->string('clock_in')->value(),
            'clock_out' => $request->string('clock_out')->value(),
            'reason' => $request->string('reason')->value(),
        ], $request->file('evidence'), Date::now());

        return response()->json([
            'message' => 'Permintaan koreksi terkirim. Menunggu admin.',
            'data' => new AttendanceCorrectionResource($correction),
        ], Response::HTTP_CREATED);
    }

    public function show(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        Gate::authorize('view', $correction);

        return new AttendanceCorrectionResource($correction->load('decider:id,name'));
    }

    public function cancel(AttendanceCorrection $correction, AttendanceCorrections $corrections): JsonResponse
    {
        Gate::authorize('cancel', $correction);

        return response()->json([
            'message' => 'Permintaan koreksi dibatalkan.',
            'data' => new AttendanceCorrectionResource($corrections->cancel($correction)),
        ]);
    }

    /**
     * Unduh bukti setelah hak akses dicek; file tidak pernah diberi URL publik.
     */
    public function evidence(AttendanceCorrection $correction): StreamedResponse
    {
        Gate::authorize('view', $correction);

        abort_if($correction->evidence_path === null || ! Storage::exists($correction->evidence_path), 404, 'Bukti tidak ditemukan.');

        $extension = pathinfo($correction->evidence_path, PATHINFO_EXTENSION);

        return Storage::download($correction->evidence_path, "bukti-koreksi-{$correction->date->toDateString()}.{$extension}");
    }
}

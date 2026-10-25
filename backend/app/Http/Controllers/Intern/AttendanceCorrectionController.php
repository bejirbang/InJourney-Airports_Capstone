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
use Symfony\Component\HttpFoundation\Response;

class AttendanceCorrectionController extends Controller
{
    public function __construct(private AttendanceCorrections $corrections) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $intern */
        $intern = $request->user();

        return AttendanceCorrectionResource::collection($intern->attendanceCorrections()
            ->with(['mentor:id,name', 'admin:id,name'])
            ->latest()
            ->latest('id')
            ->get());
    }

    public function store(AttendanceCorrectionRequest $request): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $correction = $this->corrections->submit(
            $intern,
            $request->string('date')->value(),
            $request->string('reason')->value(),
            Date::now(),
        );

        return response()->json([
            'message' => 'Pengajuan koreksi terkirim. Menunggu mentor.',
            'data' => $this->detailed($correction),
        ], Response::HTTP_CREATED);
    }

    public function show(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        Gate::authorize('view', $correction);

        return $this->detailed($correction);
    }

    public function cancel(AttendanceCorrection $correction): JsonResponse
    {
        Gate::authorize('cancel', $correction);

        return response()->json([
            'message' => 'Pengajuan koreksi dibatalkan.',
            'data' => $this->detailed($this->corrections->cancel($correction)),
        ]);
    }

    private function detailed(AttendanceCorrection $correction): AttendanceCorrectionResource
    {
        $correction->load(['mentor:id,name', 'admin:id,name']);

        return (new AttendanceCorrectionResource($correction))->withDetail([
            'recorded' => AttendanceCorrections::recorded(AttendanceCorrections::attendanceOf($correction)),
        ]);
    }
}

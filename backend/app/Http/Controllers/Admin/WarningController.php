<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\WarningRequest;
use App\Models\User;
use App\Models\Warning;
use App\Services\AdminWarnings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;

/**
 * Menu Warning dan tab Warning di detail intern (docs/design-admin.md, Alur 8). Hanya admin.
 */
class WarningController extends Controller
{
    public function __construct(private AdminWarnings $warnings) {}

    /**
     * Daftar intern di kiri halaman Warning, dengan jumlah catatan (`?q=` cari nama).
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->filled('q') ? $request->string('q')->value() : null;

        return response()->json(['data' => $this->warnings->interns($search)]);
    }

    public function forIntern(Request $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json(['data' => $this->warnings->forIntern($admin, InternRecordController::intern($user), Date::now())]);
    }

    public function store(WarningRequest $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $warning = $this->warnings->create($admin, InternRecordController::intern($user), $request->string('body')->value(), Date::now());

        return response()->json([
            'message' => 'Catatan tersimpan. Tidak ada notifikasi ke intern atau mentor.',
            'data' => $warning,
        ], Response::HTTP_CREATED);
    }

    public function update(WarningRequest $request, Warning $warning): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json([
            'message' => 'Perubahan tersimpan.',
            'data' => $this->warnings->update($admin, $warning, $request->string('body')->value(), Date::now()),
        ]);
    }
}

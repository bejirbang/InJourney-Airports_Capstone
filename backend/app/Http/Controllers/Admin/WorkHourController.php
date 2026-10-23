<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\WorkHourRequest;
use App\Models\User;
use App\Services\AdminWorkHours;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

/**
 * Pengaturan, tab Jam Kerja (docs/design-admin.md 9.1).
 */
class WorkHourController extends Controller
{
    public function __construct(private AdminWorkHours $workHours) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->workHours->overview(Date::now())]);
    }

    public function store(WorkHourRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        /** @var array{start_time: string, end_time: string, effective_from: string} $input */
        $input = $request->validated();
        $this->workHours->save($admin, $input);

        return response()->json([
            'message' => 'Perubahan tersimpan. Data absensi sebelumnya tidak berubah.',
            'data' => $this->workHours->overview(Date::now()),
        ]);
    }
}

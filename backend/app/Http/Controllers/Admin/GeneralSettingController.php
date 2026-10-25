<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GeneralSettingsRequest;
use App\Models\User;
use App\Services\AdminGeneralSettings;
use Illuminate\Http\JsonResponse;

class GeneralSettingController extends Controller
{
    public function __construct(private AdminGeneralSettings $settings) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->settings->values()]);
    }

    public function update(GeneralSettingsRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json([
            'message' => 'Perubahan tersimpan. Berlaku untuk perhitungan berikutnya.',
            'data' => $this->settings->update($admin, $request->values()),
        ]);
    }
}

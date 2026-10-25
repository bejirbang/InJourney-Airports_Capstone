<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UnitRequest;
use App\Models\Unit;
use App\Models\User;
use App\Services\AdminUnits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class UnitController extends Controller
{
    public function __construct(private AdminUnits $units) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => array_values($this->units->all()->map($this->item(...))->all())]);
    }

    public function store(UnitRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $unit = $this->units->create($admin, $request->unitName());

        return response()->json(['message' => 'Unit ditambahkan.', 'data' => $this->item($unit)], Response::HTTP_CREATED);
    }

    public function update(UnitRequest $request, Unit $unit): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $unit = $this->units->rename($admin, $unit, $request->unitName());

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->item($unit)]);
    }

    public function deactivate(Request $request, Unit $unit): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $unit = $this->units->setActive($admin, $unit, false);

        return response()->json(['message' => 'Unit dinonaktifkan. Akun yang sudah memakai unit ini tidak berubah.', 'data' => $this->item($unit)]);
    }

    public function activate(Request $request, Unit $unit): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $unit = $this->units->setActive($admin, $unit, true);

        return response()->json(['message' => 'Unit diaktifkan.', 'data' => $this->item($unit)]);
    }

    /**
     * @return array{id: int, name: string, is_active: bool, user_count: int}
     */
    private function item(Unit $unit): array
    {
        return [
            'id' => $unit->id,
            'name' => $unit->name,
            'is_active' => $unit->is_active,
            'user_count' => $unit->users_count ?? $unit->users()->count(),
        ];
    }
}

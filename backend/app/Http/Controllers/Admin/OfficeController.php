<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\OfficeRequest;
use App\Http\Resources\AdminOfficeResource;
use App\Models\Office;
use App\Models\User;
use App\Services\AdminOffices;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class OfficeController extends Controller
{
    public function __construct(private AdminOffices $offices) {}

    public function index(Request $request): JsonResponse
    {
        $offices = $this->offices->all($request->filled('airport_id') ? $request->integer('airport_id') : null);

        return response()->json([
            'data' => AdminOfficeResource::collection($offices),
            'meta' => $this->meta(),
        ]);
    }

    public function show(Office $office): AdminOfficeResource
    {
        return new AdminOfficeResource($office);
    }

    public function store(OfficeRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        /** @var array{airport_id?: int|string, name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string} $input */
        $input = $request->validated();
        $office = $this->offices->create($admin, $input);

        return response()->json([
            'message' => 'Perubahan tersimpan.',
            'data' => new AdminOfficeResource($office),
            'meta' => $this->meta(),
        ], Response::HTTP_CREATED);
    }

    public function update(OfficeRequest $request, Office $office): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        /** @var array{airport_id?: int|string, name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string} $input */
        $input = $request->validated();
        $office = $this->offices->update($admin, $office, $input);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => new AdminOfficeResource($office), 'meta' => $this->meta()]);
    }

    public function deactivate(Request $request, Office $office): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $office = $this->offices->deactivate($admin, $office);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => new AdminOfficeResource($office), 'meta' => $this->meta()]);
    }

    public function activate(Request $request, Office $office): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $office = $this->offices->activate($admin, $office);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => new AdminOfficeResource($office), 'meta' => $this->meta()]);
    }

    /**
     * @return array{active_count: int}
     */
    private function meta(): array
    {
        return ['active_count' => Office::query()->active()->count()];
    }
}

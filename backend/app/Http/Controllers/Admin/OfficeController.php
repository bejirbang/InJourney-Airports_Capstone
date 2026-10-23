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

/**
 * Menu Lokasi Kantor (docs/design-admin.md 9A): daftar, tambah, ubah, nonaktifkan, aktifkan, hapus kantor nonaktif.
 */
class OfficeController extends Controller
{
    public function __construct(private AdminOffices $offices) {}

    public function index(): JsonResponse
    {
        $offices = $this->offices->all();

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

        /** @var array{name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string} $input */
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

        /** @var array{name: string, latitude: float|string, longitude: float|string, clock_in_radius_meters: int|string, clock_out_radius_meters: int|string} $input */
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

    public function destroy(Request $request, Office $office): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $this->offices->delete($admin, $office);

        return response()->json(['message' => 'Kantor dihapus.', 'meta' => $this->meta()]);
    }

    /**
     * `active_count` untuk "N kantor aktif" dan dialog kantor aktif terakhir; 0 = banner
     * "Belum ada kantor aktif. Intern tidak bisa clock in." (9A.6).
     *
     * @return array{active_count: int}
     */
    private function meta(): array
    {
        return ['active_count' => Office::query()->active()->count()];
    }
}

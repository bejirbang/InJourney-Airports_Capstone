<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\HolidayRequest;
use App\Models\Holiday;
use App\Models\User;
use App\Services\AdminHolidays;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;

/**
 * Pengaturan, tab Kalender Libur (docs/design-admin.md 9.2, 9.3).
 */
class HolidayController extends Controller
{
    public function __construct(private AdminHolidays $holidays) {}

    public function index(): JsonResponse
    {
        $today = Date::now()->toDateString();

        return response()->json([
            'data' => $this->holidays->all()->map(fn (Holiday $holiday): array => $this->row($holiday, $today))->values(),
        ]);
    }

    public function store(HolidayRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();
        $holiday = $this->holidays->create($admin, $request->string('date')->toString(), $request->string('name')->toString(), $request->boolean('confirm'), $now);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->row($holiday, $now->toDateString())], Response::HTTP_CREATED);
    }

    public function update(HolidayRequest $request, Holiday $holiday): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();
        $holiday = $this->holidays->update($admin, $holiday, $request->string('date')->toString(), $request->string('name')->toString(), $request->boolean('confirm'), $now);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->row($holiday, $now->toDateString())]);
    }

    public function destroy(Request $request, Holiday $holiday): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $this->holidays->delete($admin, $holiday, Date::now());

        return response()->json(['message' => 'Perubahan tersimpan.']);
    }

    /**
     * @return array{id: int, date: string, name: string, is_past: bool}
     */
    private function row(Holiday $holiday, string $today): array
    {
        $date = $holiday->date->toDateString();

        return [
            'id' => $holiday->id,
            'date' => $date,
            'name' => $holiday->name,
            // Dialog Hapus menambahkan "Status absensi tanggal itu dihitung ulang." untuk tanggal lampau.
            'is_past' => $date < $today,
        ];
    }
}

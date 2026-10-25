<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AirportRequest;
use App\Http\Requests\Admin\SpecialScheduleRequest;
use App\Http\Requests\Admin\WeeklyScheduleRequest;
use App\Models\Airport;
use App\Models\AirportSpecialSchedule;
use App\Models\User;
use App\Services\AdminAirports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;

class AirportController extends Controller
{
    public function __construct(private AdminAirports $airports) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->airports->list(Date::now())]);
    }

    public function show(Airport $airport): JsonResponse
    {
        return response()->json(['data' => $this->airports->detail($airport, Date::now())]);
    }

    public function store(AirportRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $airport = $this->airports->create($admin, $request->airportName(), $request->string('effective_from')->value(), AirportRequest::days($request));

        return response()->json([
            'message' => 'Bandara ditambahkan. Tambahkan titik presensi agar intern bisa clock in.',
            'data' => $this->airports->detail($airport, Date::now()),
        ], Response::HTTP_CREATED);
    }

    public function update(AirportRequest $request, Airport $airport): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $airport = $this->airports->rename($admin, $airport, $request->airportName());

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->airports->detail($airport, Date::now())]);
    }

    public function deactivate(Request $request, Airport $airport): JsonResponse
    {
        return $this->setActive($request, $airport, false, 'Bandara dinonaktifkan.');
    }

    public function activate(Request $request, Airport $airport): JsonResponse
    {
        return $this->setActive($request, $airport, true, 'Bandara diaktifkan.');
    }

    public function weeklyHistory(Airport $airport): JsonResponse
    {
        return response()->json(['data' => $this->airports->weeklyHistory($airport)]);
    }

    public function saveWeekly(WeeklyScheduleRequest $request, Airport $airport): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json([
            'message' => 'Jadwal mingguan tersimpan. Presensi sebelum tanggal berlaku tidak berubah.',
            'data' => $this->airports->saveWeekly($admin, $airport, $request->effectiveFrom(), $request->days()),
        ]);
    }

    public function specials(Airport $airport): JsonResponse
    {
        return response()->json(['data' => $this->airports->specials($airport, Date::now())]);
    }

    public function storeSpecial(SpecialScheduleRequest $request, Airport $airport): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();
        $special = $this->airports->createSpecial($admin, $airport, $request->schedule(), $now);

        return response()->json(['message' => 'Jadwal khusus tersimpan.', 'data' => $this->airports->special($special, $now)], Response::HTTP_CREATED);
    }

    public function updateSpecial(SpecialScheduleRequest $request, AirportSpecialSchedule $special): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();
        $special = $this->airports->updateSpecial($admin, $special, $request->schedule(), $now);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->airports->special($special, $now)]);
    }

    public function destroySpecial(Request $request, AirportSpecialSchedule $special): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $deleted = $this->airports->deleteSpecial($admin, $special, Date::now());

        return response()->json(['message' => $deleted ? 'Jadwal khusus dihapus.' : 'Jadwal khusus dihentikan mulai hari ini.']);
    }

    private function setActive(Request $request, Airport $airport, bool $active, string $message): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $now = Date::now();
        $airport = $this->airports->setActive($admin, $airport, $active, $now);

        return response()->json(['message' => $message, 'data' => $this->airports->detail($airport, $now)]);
    }
}

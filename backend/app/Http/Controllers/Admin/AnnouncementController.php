<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AnnouncementRequest;
use App\Http\Resources\AdminAnnouncementResource;
use App\Models\Announcement;
use App\Models\User;
use App\Services\AdminAnnouncements;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;

class AnnouncementController extends Controller
{
    public function __construct(private AdminAnnouncements $announcements) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => AdminAnnouncementResource::collection($this->announcements->all())]);
    }

    public function store(AnnouncementRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $announcement = $this->announcements->create($admin, $request->announcement(), Date::now());

        return response()->json([
            'message' => 'Pengumuman terkirim ke bell icon penerima.',
            'data' => new AdminAnnouncementResource($announcement),
        ], Response::HTTP_CREATED);
    }

    public function update(AnnouncementRequest $request, Announcement $announcement): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $announcement = $this->announcements->update($admin, $announcement, $request->announcement(), Date::now());

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => new AdminAnnouncementResource($announcement)]);
    }

    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $this->announcements->delete($admin, $announcement);

        return response()->json(['message' => 'Pengumuman dihapus.']);
    }
}

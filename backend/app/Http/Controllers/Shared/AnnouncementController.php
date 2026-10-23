<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use Illuminate\Support\Facades\Gate;

/**
 * Isi pengumuman saat notifikasi lonceng diklik (design-intern.md 16, design-mentor.md 14).
 * Dipakai semua role; intern dan mentor hanya untuk pengumuman role-nya.
 */
class AnnouncementController extends Controller
{
    public function show(Announcement $announcement): AnnouncementResource
    {
        Gate::authorize('view', $announcement);

        return new AnnouncementResource($announcement->load('author:id,name'));
    }
}

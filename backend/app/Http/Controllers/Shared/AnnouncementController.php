<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use Illuminate\Support\Facades\Gate;

class AnnouncementController extends Controller
{
    public function show(Announcement $announcement): AnnouncementResource
    {
        Gate::authorize('view', $announcement);

        return new AnnouncementResource($announcement->load('author:id,name'));
    }
}

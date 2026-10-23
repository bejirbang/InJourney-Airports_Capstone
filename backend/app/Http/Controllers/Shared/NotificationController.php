<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Services\UserNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Lonceng notifikasi semua role. Item baru dan perubahan status dibaca juga dikirim lewat WebSocket (`users.{id}`).
 */
class NotificationController extends Controller
{
    public function __construct(private UserNotifications $notifications) {}

    /**
     * 20 item per muatan, terbaru lebih dulu. `?cursor=` dari `meta.next_cursor` untuk memuat berikutnya.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $page = $this->notifications->page($user);

        return response()->json([
            'data' => array_map(fn (Notification $n): array => $n->toItem(), $page->items()),
            'meta' => [
                'next_cursor' => $page->nextCursor()?->encode(),
                'unread_count' => Notification::unreadCountFor($user->id),
            ],
        ]);
    }

    public function read(Request $request, int $notification): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $item = $this->notifications->markRead($user, $notification);

        return response()->json(['data' => $item->toItem(), 'meta' => ['unread_count' => Notification::unreadCountFor($user->id)]]);
    }

    public function readAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->notifications->markAllRead($user);

        return response()->json(['meta' => ['unread_count' => 0]]);
    }
}

<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\InternLogbooks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public const MENU = [
        ['key' => 'dashboard', 'path' => '/intern/dashboard'],
        ['key' => 'attendance', 'path' => '/intern/attendance'],
        ['key' => 'logbooks', 'path' => '/intern/logbooks'],
        ['key' => 'leaves', 'path' => '/intern/leaves'],
        ['key' => 'presentation', 'path' => '/intern/presentation'],
        ['key' => 'notes', 'path' => '/intern/notes'],
    ];

    /**
     * Angka di Logbook: logbook Revisi dan hari hasil koreksi yang belum diisi.
     */
    public function __invoke(Request $request, InternLogbooks $logbooks): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $badges = ['logbooks' => count($logbooks->actionNeeded($intern))];

        return response()->json(['data' => array_map(
            fn (array $item): array => [...$item, 'badge' => $badges[$item['key']] ?? null],
            self::MENU,
        )]);
    }
}

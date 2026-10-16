<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Menu sidebar Intern (docs/design-intern.md, bagian 2.2).
 * Hanya kunci dan alamat halaman; label Indonesia ditampilkan frontend.
 * Chat dan notifikasi ada di navbar, bukan di sidebar.
 */
class MenuController extends Controller
{
    public const MENU = [
        ['key' => 'dashboard', 'path' => '/intern/dashboard'],
        ['key' => 'attendance', 'path' => '/intern/attendance'],
        ['key' => 'tasks', 'path' => '/intern/tasks'],
        ['key' => 'leaves', 'path' => '/intern/leaves'],
    ];

    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => self::MENU]);
    }
}

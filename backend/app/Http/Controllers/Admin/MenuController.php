<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use Illuminate\Http\JsonResponse;

/**
 * Menu sidebar Admin (docs/design-admin.md, bagian 2.1 dan 2.2).
 * Hanya kunci dan alamat halaman; label Indonesia ditampilkan frontend.
 * `badge` adalah jumlah yang menunggu diproses admin: Koreksi dan Izin.
 * Chat dan notifikasi ada di navbar, bukan di sidebar.
 */
class MenuController extends Controller
{
    public const MENU = [
        ['key' => 'dashboard', 'path' => '/admin/dashboard'],
        ['key' => 'users', 'path' => '/admin/users'],
        ['key' => 'attendance', 'path' => '/admin/attendance'],
        ['key' => 'corrections', 'path' => '/admin/corrections'],
        ['key' => 'leaves', 'path' => '/admin/leaves'],
        ['key' => 'warnings', 'path' => '/admin/warnings'],
        ['key' => 'announcements', 'path' => '/admin/announcements'],
        ['key' => 'reports', 'path' => '/admin/reports'],
        ['key' => 'settings', 'path' => '/admin/settings'],
        ['key' => 'offices', 'path' => '/admin/offices'],
        ['key' => 'audit_log', 'path' => '/admin/audit-log'],
    ];

    public function __invoke(): JsonResponse
    {
        // Sama dengan total kotak di Dashboard Admin; data intern yang sudah dihapus tidak ikut.
        $badges = [
            'corrections' => AttendanceCorrection::query()->where('status', RequestStatus::Pending)->whereHas('intern')->count(),
            // Admin hanya memproses izin yang menggantung lebih dari 24 jam (design-admin.md Alur 5).
            'leaves' => LeaveRequest::query()->overduePending(now())->whereHas('intern')->count(),
        ];

        $menu = array_map(
            fn (array $item): array => [...$item, 'badge' => $badges[$item['key']] ?? null],
            self::MENU,
        );

        return response()->json(['data' => $menu]);
    }
}

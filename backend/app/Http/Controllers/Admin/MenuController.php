<?php

namespace App\Http\Controllers\Admin;

use App\Enums\CorrectionStatus;
use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Services\SystemSettings;
use Illuminate\Http\JsonResponse;

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

    public function __invoke(SystemSettings $settings): JsonResponse
    {
        $badges = [
            'corrections' => AttendanceCorrection::query()->where('status', CorrectionStatus::PendingAdmin)->whereHas('intern')->count(),
            'leaves' => LeaveRequest::query()->overduePending(now(), $settings->leaveEscalationHours())->whereHas('intern')->count(),
        ];

        $menu = array_map(
            fn (array $item): array => [...$item, 'badge' => $badges[$item['key']] ?? null],
            self::MENU,
        );

        return response()->json(['data' => $menu]);
    }
}

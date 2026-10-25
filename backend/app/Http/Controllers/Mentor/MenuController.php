<?php

namespace App\Http\Controllers\Mentor;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\MentorCorrections;
use App\Services\MentorLogbooks;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public const MENU = [
        ['key' => 'dashboard', 'path' => '/mentor/dashboard'],
        ['key' => 'interns', 'path' => '/mentor/interns'],
        ['key' => 'logbooks', 'path' => '/mentor/logbooks'],
        ['key' => 'corrections', 'path' => '/mentor/corrections'],
        ['key' => 'leaves', 'path' => '/mentor/leaves'],
        ['key' => 'leave_calendar', 'path' => '/mentor/leave-calendar'],
        ['key' => 'performance', 'path' => '/mentor/performance'],
    ];

    public function __invoke(Request $request, MentorLogbooks $logbooks, MentorCorrections $corrections): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $badges = [
            'logbooks' => $logbooks->pendingCount($mentor),
            'corrections' => $corrections->pendingCount($mentor),
            'leaves' => $this->pendingLeaves($mentor),
        ];

        $menu = array_map(
            fn (array $item): array => [...$item, 'badge' => $badges[$item['key']] ?? null],
            self::MENU,
        );

        return response()->json(['data' => $menu]);
    }

    private function pendingLeaves(User $mentor): int
    {
        return LeaveRequest::query()
            ->where('status', RequestStatus::Pending)
            ->whereHas('intern.internProfile', fn (Builder $query) => $query->where('mentor_id', $mentor->id))
            ->count();
    }
}

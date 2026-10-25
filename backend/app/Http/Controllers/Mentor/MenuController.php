<?php

namespace App\Http\Controllers\Mentor;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public const MENU = [
        ['key' => 'dashboard', 'path' => '/mentor/dashboard'],
        ['key' => 'interns', 'path' => '/mentor/interns'],
        ['key' => 'leaves', 'path' => '/mentor/leaves'],
        ['key' => 'leave_calendar', 'path' => '/mentor/leave-calendar'],
        ['key' => 'performance', 'path' => '/mentor/performance'],
    ];

    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $badges = ['leaves' => $this->pendingLeaves($mentor)];

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

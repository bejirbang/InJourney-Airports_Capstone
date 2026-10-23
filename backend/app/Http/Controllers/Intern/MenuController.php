<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

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

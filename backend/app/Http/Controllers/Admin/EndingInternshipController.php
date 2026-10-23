<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\EndingInternships;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class EndingInternshipController extends Controller
{
    public function __invoke(EndingInternships $endings): JsonResponse
    {
        return response()->json(['data' => $endings->all(Date::now())]);
    }
}

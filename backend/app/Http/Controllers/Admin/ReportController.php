<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ReportRequest;
use App\Models\User;
use App\Services\AdminReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    public function __construct(private AdminReports $reports) {}

    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->reports->options()]);
    }

    public function export(ReportRequest $request): BinaryFileResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $file = $this->reports->export($admin, $request->filters(), Date::now());

        return response()
            ->download($file['path'], $file['filename'], ['Content-Type' => self::XLSX])
            ->deleteFileAfterSend();
    }
}

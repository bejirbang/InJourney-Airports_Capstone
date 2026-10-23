<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AuditLogIndexRequest;
use App\Models\AuditLog;
use App\Services\AdminAuditLogs;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    public function __construct(private AdminAuditLogs $logs) {}

    public function index(AuditLogIndexRequest $request): JsonResponse
    {
        $page = $this->logs->list($request->filters());

        return response()->json([
            'data' => array_map(fn (AuditLog $log): array => [
                'id' => $log->id,
                'created_at' => $log->created_at?->toIso8601String(),
                'admin' => ['id' => $log->admin_id, 'name' => $log->admin_name],
                'action' => $log->action,
                'object' => $log->object,
                'detail' => $log->detail,
            ], $page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->logs->options()]);
    }
}

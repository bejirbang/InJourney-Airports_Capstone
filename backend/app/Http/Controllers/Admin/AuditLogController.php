<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AuditLogIndexRequest;
use App\Models\AuditLog;
use App\Services\AdminAuditLogs;
use Illuminate\Http\JsonResponse;

/**
 * Log Aktivitas (docs/design-admin.md 13.1). Hanya baca: tidak ada endpoint ubah atau hapus.
 */
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
                // Nama saat tindakan dilakukan; `id` null jika akun admin sudah dihapus permanen.
                'admin' => ['id' => $log->admin_id, 'name' => $log->admin_name],
                'action' => $log->action,
                'object' => $log->object,
                'detail' => $log->detail,
            ], $page->items()),
            // "N catatan" dari `total`.
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

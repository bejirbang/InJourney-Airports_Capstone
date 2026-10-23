<?php

namespace App\Http\Requests\Admin;

use App\Models\AuditLog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filter Log Aktivitas (docs/design-admin.md 13.1): `from`, `to` (tanggal), `admin_id`, `action` (jenis aksi),
 * dan `page`. Semua opsional.
 */
class AuditLogIndexRequest extends FormRequest
{
    public const PERIOD_INVALID = 'Periode tidak valid.';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'admin_id' => ['nullable', 'integer'],
            'action' => ['nullable', Rule::in(AuditLog::ACTIONS)],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array{from: string|null, to: string|null, admin_id: int|null, action: string|null}
     */
    public function filters(): array
    {
        return [
            'from' => $this->filled('from') ? $this->string('from')->toString() : null,
            'to' => $this->filled('to') ? $this->string('to')->toString() : null,
            'admin_id' => $this->filled('admin_id') ? $this->integer('admin_id') : null,
            'action' => $this->filled('action') ? $this->string('action')->toString() : null,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'from.*' => self::PERIOD_INVALID,
            'to.*' => self::PERIOD_INVALID,
            'admin_id.*' => 'Admin tidak valid.',
            'action.*' => 'Jenis aksi tidak valid.',
            'page.*' => 'Halaman tidak valid.',
        ];
    }
}

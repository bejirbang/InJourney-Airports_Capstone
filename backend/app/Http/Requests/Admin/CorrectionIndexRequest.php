<?php

namespace App\Http\Requests\Admin;

use App\Services\AdminCorrections;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filter daftar Koreksi Absensi (docs/design-admin.md 6.2): `status` (default pending),
 * `intern_id`, dan rentang tanggal absensi `from` sampai `to`.
 */
class CorrectionIndexRequest extends FormRequest
{
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
            'status' => ['sometimes', Rule::in(AdminCorrections::FILTERS)],
            'intern_id' => ['sometimes', 'nullable', 'integer'],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*' => 'Filter koreksi tidak valid.',
        ];
    }
}

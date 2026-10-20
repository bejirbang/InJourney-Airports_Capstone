<?php

namespace App\Http\Requests\Shared;

use App\Enums\LeaveType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Tab dan filter halaman Izin mentor dan admin (docs/design-mentor.md 9.2, design-admin.md 7.2):
 * `tab` pending (default) atau all, `type` sick atau urgent, `intern_id`.
 */
class ReviewerLeaveIndexRequest extends FormRequest
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
            'tab' => ['sometimes', Rule::in(['pending', 'all'])],
            'type' => ['sometimes', 'nullable', Rule::enum(LeaveType::class)],
            'intern_id' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*' => 'Filter izin tidak valid.',
        ];
    }
}

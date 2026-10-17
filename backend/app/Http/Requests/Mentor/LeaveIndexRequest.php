<?php

namespace App\Http\Requests\Mentor;

use App\Enums\LeaveType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Tab dan filter halaman Izin mentor (docs/design-mentor.md 9.2): `tab` pending (default) atau all,
 * `type` sick atau urgent, `intern_id`.
 */
class LeaveIndexRequest extends FormRequest
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

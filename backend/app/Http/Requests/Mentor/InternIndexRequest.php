<?php

namespace App\Http\Requests\Mentor;

use App\Services\MentorInterns;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filter Intern Saya: `status` (active, inactive, former, all; default active) dan `q` (cari nama).
 */
class InternIndexRequest extends FormRequest
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
            'status' => ['sometimes', Rule::in(MentorInterns::FILTERS)],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*' => 'Filter intern tidak valid.',
        ];
    }
}

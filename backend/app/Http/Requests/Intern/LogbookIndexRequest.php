<?php

namespace App\Http\Requests\Intern;

use App\Services\InternLogbooks;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LogbookIndexRequest extends FormRequest
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
            'month' => ['sometimes', 'date_format:Y-m'],
            'status' => ['sometimes', 'nullable', Rule::in(InternLogbooks::FILTERS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'month.date_format' => 'Format bulan tidak valid.',
            'status.in' => 'Filter status tidak valid.',
        ];
    }
}

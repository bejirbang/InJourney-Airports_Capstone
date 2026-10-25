<?php

namespace App\Http\Requests\Shared;

use App\Services\AttendanceHistory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AttendanceHistoryRequest extends FormRequest
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
            'status' => ['sometimes', 'nullable', Rule::in(AttendanceHistory::FILTERS)],
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

    public function month(): ?string
    {
        return $this->filled('month') ? $this->string('month')->value() : null;
    }

    public function statusFilter(): ?string
    {
        return $this->filled('status') ? $this->string('status')->value() : null;
    }
}

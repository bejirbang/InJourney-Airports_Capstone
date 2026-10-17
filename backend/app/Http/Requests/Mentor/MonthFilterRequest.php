<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Bulan (`?month=2026-10`, default bulan berjalan) dan filter intern untuk Kalender Izin dan Performa Intern.
 */
class MonthFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'month' => ['sometimes', 'date_format:Y-m'],
            'intern_id' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'month.date_format' => 'Format bulan tidak valid.',
            'intern_id.integer' => 'Filter intern tidak valid.',
        ];
    }
}

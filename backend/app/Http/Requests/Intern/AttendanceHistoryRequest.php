<?php

namespace App\Http\Requests\Intern;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Bulan riwayat absensi (`?month=2026-10`). Tanpa parameter, bulan berjalan.
 */
class AttendanceHistoryRequest extends FormRequest
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
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'month.date_format' => 'Format bulan tidak valid.',
        ];
    }
}

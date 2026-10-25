<?php

namespace App\Http\Requests\Intern;

use Illuminate\Foundation\Http\FormRequest;

class AttendanceCorrectionRequest extends FormRequest
{
    public const REASON_REQUIRED = 'Alasan wajib diisi.';

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
            'date' => ['required', 'date_format:Y-m-d'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.*' => 'Pilih tanggal yang akan dikoreksi.',
            'reason.required' => self::REASON_REQUIRED,
            'reason.string' => self::REASON_REQUIRED,
            'reason.max' => 'Alasan maksimal 1000 karakter.',
        ];
    }
}

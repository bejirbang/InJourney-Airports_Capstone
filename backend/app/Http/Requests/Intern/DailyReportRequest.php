<?php

namespace App\Http\Requests\Intern;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Isian yang hanya spasi menjadi kosong lewat middleware TrimStrings, jadi ikut ditolak.
 */
class DailyReportRequest extends FormRequest
{
    public const WORK_REQUIRED = 'Isi apa yang Anda kerjakan hari ini.';

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
            'work' => ['required', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'work.*' => self::WORK_REQUIRED,
            'notes.string' => 'Kendala atau catatan harus berupa teks.',
        ];
    }
}

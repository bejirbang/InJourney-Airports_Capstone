<?php

namespace App\Http\Requests\Intern;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Isi Daily Report. Pesan sama dengan validateReport di frontend/src/lib/mock-rules.ts.
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

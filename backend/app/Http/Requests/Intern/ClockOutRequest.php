<?php

namespace App\Http\Requests\Intern;

/**
 * Isian logbook boleh ikut dikirim saat clock out (dialog logbook), wajib jika belum clock in.
 */
class ClockOutRequest extends ClockRequest
{
    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'work' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'work.string' => LogbookRequest::WORK_REQUIRED,
            'notes.string' => 'Kendala atau catatan harus berupa teks.',
        ];
    }
}

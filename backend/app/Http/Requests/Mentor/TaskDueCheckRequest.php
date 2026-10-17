<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Pemeriksaan tenggat sebelum simpan (`?due_at=2026-10-17 17:00`), untuk peringatan hari libur.
 */
class TaskDueCheckRequest extends FormRequest
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
            'due_at' => ['required', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'due_at.*' => TaskFormRequest::DUE_INVALID,
        ];
    }
}

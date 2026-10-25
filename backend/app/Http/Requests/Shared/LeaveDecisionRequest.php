<?php

namespace App\Http\Requests\Shared;

use Illuminate\Foundation\Http\FormRequest;

class LeaveDecisionRequest extends FormRequest
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
            'note' => ['required', 'string', 'max:1000'],
            'evidence_checked' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => 'Catatan wajib diisi.',
            'note.string' => 'Catatan wajib diisi.',
            'note.max' => 'Catatan maksimal 1000 karakter.',
            'evidence_checked.boolean' => 'Isian pemeriksaan bukti tidak valid.',
        ];
    }
}

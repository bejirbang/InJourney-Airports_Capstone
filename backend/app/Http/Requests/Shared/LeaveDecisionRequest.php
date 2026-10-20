<?php

namespace App\Http\Requests\Shared;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Setujui atau Tolak izin oleh mentor atau admin. Catatan wajib (docs/design-mentor.md 9.4, design-admin.md 7.4).
 * Admin juga mengirim `evidence_checked` (centang "Saya sudah memeriksa bukti"); syaratnya diperiksa di LeaveDecisions.
 */
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

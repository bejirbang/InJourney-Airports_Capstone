<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Setujui atau Tolak izin. Catatan wajib (docs/design-mentor.md 9.4).
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
        ];
    }
}

<?php

namespace App\Http\Requests\Shared;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Catatan opsional hanya saat mentor ACC. Tolak oleh mentor, serta Setujui dan Tolak oleh admin, wajib catatan.
 */
class CorrectionDecisionRequest extends FormRequest
{
    public const NOTE_REQUIRED = 'Catatan wajib diisi.';

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
            'note' => [$this->routeIs('mentor.corrections.approve') ? 'nullable' : 'required', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => self::NOTE_REQUIRED,
            'note.string' => self::NOTE_REQUIRED,
            'note.max' => 'Catatan maksimal 1000 karakter.',
        ];
    }

    public function note(): ?string
    {
        return $this->filled('note') ? $this->string('note')->value() : null;
    }
}

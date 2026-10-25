<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Revisi wajib berisi catatan (misalnya link tidak bisa dibuka); Setujui tanpa catatan.
 */
class PresentationDecisionRequest extends FormRequest
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
            'note' => ['required', 'string', 'max:1000'],
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

    public function note(): string
    {
        return $this->string('note')->value();
    }
}

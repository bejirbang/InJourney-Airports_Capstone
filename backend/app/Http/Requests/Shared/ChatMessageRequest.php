<?php

namespace App\Http\Requests\Shared;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Kirim pesan chat: `body` teks saja, maksimal 2000 karakter (keputusan pemilik repo 23 Okt 2026).
 */
class ChatMessageRequest extends FormRequest
{
    public const BODY_REQUIRED = 'Pesan wajib diisi.';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => trim($this->input('body'))]);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => self::BODY_REQUIRED,
            'body.string' => self::BODY_REQUIRED,
            'body.max' => 'Pesan maksimal 2000 karakter.',
        ];
    }
}

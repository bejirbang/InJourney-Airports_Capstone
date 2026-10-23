<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class WarningRequest extends FormRequest
{
    public const BODY_REQUIRED = 'Catatan wajib diisi.';

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
            'body.max' => 'Catatan maksimal 2000 karakter.',
        ];
    }
}

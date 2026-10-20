<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Tambah atau ubah catatan Warning (docs/design-admin.md 10.1): `body` wajib.
 */
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
            'body' => ['required', 'string'],
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
        ];
    }
}

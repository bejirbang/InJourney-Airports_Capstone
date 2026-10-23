<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public const NAME_REQUIRED = 'Nama wajib diisi.';

    public const PHONE_FORMAT = 'Format nomor telepon tidak valid.';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // Angka, spasi, dan tanda hubung, boleh diawali +. Contoh: 0812-3456-7890 atau +62 812 3456 7890.
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+?\d[\d\s-]{6,}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => self::NAME_REQUIRED,
            'name.string' => self::NAME_REQUIRED,
            'name.max' => 'Nama maksimal 255 karakter.',
            'phone.string' => self::PHONE_FORMAT,
            'phone.max' => self::PHONE_FORMAT,
            'phone.regex' => self::PHONE_FORMAT,
        ];
    }
}

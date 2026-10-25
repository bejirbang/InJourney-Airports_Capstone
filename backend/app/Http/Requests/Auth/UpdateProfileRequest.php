<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Semua role hanya mengubah nomor telepon. Data lain diubah admin.
 */
class UpdateProfileRequest extends FormRequest
{
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
            // Angka, spasi, dan tanda hubung, boleh diawali +. Contoh: 0812-3456-7890 atau +62 812 3456 7890.
            'phone' => ['present', 'nullable', 'string', 'max:20', 'regex:/^\+?\d[\d\s-]{6,}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.present' => self::PHONE_FORMAT,
            'phone.string' => self::PHONE_FORMAT,
            'phone.max' => self::PHONE_FORMAT,
            'phone.regex' => self::PHONE_FORMAT,
        ];
    }
}

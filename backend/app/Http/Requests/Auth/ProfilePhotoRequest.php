<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Unggah foto profil. Batas ukuran sama dengan unggahan lain (config/uploads.php).
 */
class ProfilePhotoRequest extends FormRequest
{
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
            'photo' => [
                'required',
                'file',
                'max:'.config('uploads.max_kilobytes'),
                'mimes:'.implode(',', config('uploads.photo_mimes')),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'photo.required' => 'Pilih foto lebih dulu.',
            'photo.file' => 'Foto tidak dapat dibaca. Pilih file lagi.',
            'photo.max' => config('uploads.messages.photo_max'),
            'photo.mimes' => config('uploads.messages.photo_mimes'),
        ];
    }
}

<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

class TaskFormRequest extends FormRequest
{
    public const INTERN_REQUIRED = 'Pilih intern untuk Task ini.';

    public const DUE_INVALID = 'Tenggat harus setelah waktu sekarang.';

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
            ...$this->isMethod('POST') ? ['intern_id' => ['required', 'integer']] : [],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'due_at' => ['required', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'intern_id.*' => self::INTERN_REQUIRED,
            'title.required' => 'Judul wajib diisi.',
            'title.string' => 'Judul wajib diisi.',
            'title.max' => 'Judul maksimal 255 karakter.',
            'description.*' => 'Deskripsi wajib diisi.',
            'due_at.*' => self::DUE_INVALID,
        ];
    }
}

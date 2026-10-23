<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Buat dan Ubah pengumuman (docs/design-admin.md 11): `title`, `body`, `for_intern`, `for_mentor`.
 * Judul dan isi wajib, minimal satu penerima. Judul paling panjang 255 karakter karena menjadi teks lonceng.
 */
class AnnouncementRequest extends FormRequest
{
    public const RECIPIENT_REQUIRED = 'Pilih minimal satu penerima.';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['title', 'body'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:5000'],
            'for_intern' => ['sometimes', 'boolean'],
            'for_mentor' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->boolean('for_intern') && ! $this->boolean('for_mentor')) {
                    $validator->errors()->add('recipients', self::RECIPIENT_REQUIRED);
                }
            },
        ];
    }

    /**
     * @return array{title: string, body: string, for_intern: bool, for_mentor: bool}
     */
    public function announcement(): array
    {
        return [
            'title' => $this->string('title')->toString(),
            'body' => $this->string('body')->toString(),
            'for_intern' => $this->boolean('for_intern'),
            'for_mentor' => $this->boolean('for_mentor'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul wajib diisi.',
            'title.string' => 'Judul wajib diisi.',
            'title.max' => 'Judul maksimal 255 karakter.',
            'body.required' => 'Isi pengumuman wajib diisi.',
            'body.string' => 'Isi pengumuman wajib diisi.',
            'body.max' => 'Isi pengumuman maksimal 5000 karakter.',
            'for_intern.boolean' => self::RECIPIENT_REQUIRED,
            'for_mentor.boolean' => self::RECIPIENT_REQUIRED,
        ];
    }
}

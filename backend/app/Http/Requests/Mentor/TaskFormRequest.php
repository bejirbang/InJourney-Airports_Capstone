<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Formulir Buat Task dan Ubah Task (docs/design-mentor.md 6.3).
 * Pesan sama dengan validateTask di frontend/src/lib/mock-rules.ts.
 * Intern aktif bimbingan sendiri dan tenggat setelah waktu sekarang diperiksa di MentorTasks.
 *
 * `due_at` waktu lokal (Asia/Jakarta), misalnya "2026-10-15 17:00" atau "2026-10-15T17:00".
 * `intern_id` hanya untuk Buat Task; intern tidak bisa diganti saat mengubah.
 */
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

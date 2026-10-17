<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Accept atau Revise (docs/design-mentor.md 8.3). Komentar wajib untuk Revise, opsional untuk Accept.
 * `submitted_at` adalah waktu kumpul yang dilihat mentor saat membuka Task, untuk mendeteksi pengumpulan ulang.
 * Pesan sama dengan validateRevise di frontend/src/lib/mock-rules.ts.
 */
class TaskReviewRequest extends FormRequest
{
    public const REVISE_REQUIRED = 'Komentar revisi wajib diisi.';

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
            'comment' => [$this->routeIs('mentor.tasks.revise') ? 'required' : 'nullable', 'string'],
            'submitted_at' => ['sometimes', 'nullable', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'comment.*' => self::REVISE_REQUIRED,
            'submitted_at.*' => 'Waktu pengumpulan tidak valid. Muat ulang.',
        ];
    }
}

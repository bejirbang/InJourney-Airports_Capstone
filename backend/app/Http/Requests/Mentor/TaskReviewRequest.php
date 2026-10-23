<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `submitted_at` adalah waktu kumpul yang dilihat mentor saat membuka Task, untuk mendeteksi pengumpulan ulang.
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

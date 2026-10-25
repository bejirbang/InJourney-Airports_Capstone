<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Minta Revisi wajib berisi komentar; Setujui tidak.
 */
class LogbookReviewRequest extends FormRequest
{
    public const COMMENT_REQUIRED = 'Tulis komentar revisi.';

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
            'comment' => [$this->routeIs('mentor.logbooks.revise') ? 'required' : 'nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'comment.required' => self::COMMENT_REQUIRED,
            'comment.string' => self::COMMENT_REQUIRED,
            'comment.max' => 'Komentar maksimal 2000 karakter.',
        ];
    }

    public function comment(): ?string
    {
        return $this->filled('comment') ? $this->string('comment')->value() : null;
    }
}

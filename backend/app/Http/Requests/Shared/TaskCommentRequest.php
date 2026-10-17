<?php

namespace App\Http\Requests\Shared;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Komentar Task dari intern atau mentor. Pesan sama dengan validateComment di frontend/src/lib/mock-rules.ts.
 * Isian yang hanya spasi menjadi kosong lewat middleware TrimStrings, jadi ikut ditolak.
 */
class TaskCommentRequest extends FormRequest
{
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
            'body.*' => 'Tulis komentar dulu.',
        ];
    }
}

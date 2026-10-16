<?php

namespace App\Http\Requests\Intern;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Dialog Kumpulkan Hasil dan Ganti Hasil (docs/design-intern.md 11.2 dan 11.3).
 * Pesan sama dengan validateSubmission di frontend/src/lib/mock-rules.ts.
 */
class TaskSubmissionRequest extends FormRequest
{
    public const LINK_OR_FILE = 'Isi link atau pilih file.';

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
            'link' => ['nullable', 'required_without:file', 'string', 'max:2048', 'regex:/^https?:\/\//i'],
            'file' => [
                'nullable',
                'file',
                'max:'.config('uploads.max_kilobytes'),
                'mimes:'.implode(',', config('uploads.mimes')),
            ],
            // Status yang dilihat intern saat membuka dialog, untuk memilih pesan bila mentor sudah Accept.
            'from' => ['sometimes', Rule::enum(TaskStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'link.required_without' => self::LINK_OR_FILE,
            'link.string' => 'Format link tidak valid.',
            'link.max' => 'Format link tidak valid.',
            'link.regex' => 'Format link tidak valid.',
            'file.file' => 'File tidak dapat dibaca. Pilih file lagi.',
            'file.max' => config('uploads.messages.max'),
            'file.mimes' => config('uploads.messages.mimes_or_link'),
            'from.*' => 'Status asal tidak valid.',
        ];
    }
}

<?php

namespace App\Http\Requests\Intern;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Perpindahan kartu Kanban atau tombol Mulai Kerjakan.
 * `from` adalah status yang dilihat intern; dipakai untuk mendeteksi perubahan oleh mentor.
 */
class TaskMoveRequest extends FormRequest
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
            'to' => ['required', Rule::enum(TaskStatus::class)],
            'from' => ['sometimes', Rule::enum(TaskStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'to.*' => 'Status tujuan tidak valid.',
            'from.*' => 'Status asal tidak valid.',
        ];
    }
}

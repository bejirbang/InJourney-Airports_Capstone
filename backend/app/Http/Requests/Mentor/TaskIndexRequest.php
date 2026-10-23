<?php

namespace App\Http\Requests\Mentor;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TaskIndexRequest extends FormRequest
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
            'intern_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', Rule::enum(TaskStatus::class)],
            'late' => ['sometimes', 'boolean'],
            'due_from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'due_to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:due_from'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', Rule::in(['due', 'newest', 'intern'])],
            'include_older_done' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*' => 'Filter Task tidak valid.',
            'due_to.after_or_equal' => 'Tanggal akhir harus sesudah tanggal awal.',
        ];
    }
}

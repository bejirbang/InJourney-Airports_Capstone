<?php

namespace App\Http\Requests\Mentor;

use App\Services\MentorLogbooks;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LogbookIndexRequest extends FormRequest
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
            'tab' => ['sometimes', 'nullable', Rule::in(MentorLogbooks::TABS)],
            'intern_id' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tab.in' => 'Tab tidak valid.',
            'intern_id.integer' => 'Intern tidak valid.',
        ];
    }

    public function tab(): ?string
    {
        return $this->filled('tab') ? $this->string('tab')->value() : null;
    }

    public function internId(): ?int
    {
        return $this->filled('intern_id') ? $this->integer('intern_id') : null;
    }
}

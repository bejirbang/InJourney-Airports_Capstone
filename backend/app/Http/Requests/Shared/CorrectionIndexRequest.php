<?php

namespace App\Http\Requests\Shared;

use App\Services\AdminCorrections;
use App\Services\MentorCorrections;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CorrectionIndexRequest extends FormRequest
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
        $tabs = $this->routeIs('admin.*') ? AdminCorrections::TABS : MentorCorrections::TABS;

        return [
            'tab' => ['sometimes', 'nullable', Rule::in($tabs)],
            'intern_id' => ['sometimes', 'nullable', 'integer'],
            'airport_id' => ['sometimes', 'nullable', 'integer'],
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
            'airport_id.integer' => 'Bandara tidak valid.',
        ];
    }

    public function tab(): ?string
    {
        return $this->filled('tab') ? $this->string('tab')->value() : null;
    }

    public function airportId(): ?int
    {
        return $this->filled('airport_id') ? $this->integer('airport_id') : null;
    }

    public function internId(): ?int
    {
        return $this->filled('intern_id') ? $this->integer('intern_id') : null;
    }
}

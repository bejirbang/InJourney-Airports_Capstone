<?php

namespace App\Http\Requests\Admin;

use App\Services\FinalPresentations;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PresentationIndexRequest extends FormRequest
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
            'tab' => ['sometimes', 'nullable', Rule::in(FinalPresentations::TABS)],
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
}

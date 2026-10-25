<?php

namespace App\Http\Requests\Admin;

use App\Services\Assessments;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssessmentIndexRequest extends FormRequest
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
            'status' => ['sometimes', 'nullable', Rule::in(Assessments::STATUSES)],
            'airport_id' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.in' => 'Status tidak valid.',
            'airport_id.integer' => 'Bandara tidak valid.',
        ];
    }

    public function status(): ?string
    {
        return $this->filled('status') ? $this->string('status')->value() : null;
    }

    public function airportId(): ?int
    {
        return $this->filled('airport_id') ? $this->integer('airport_id') : null;
    }
}

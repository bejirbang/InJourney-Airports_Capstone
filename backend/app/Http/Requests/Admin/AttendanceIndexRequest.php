<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AttendanceIndexRequest extends FormRequest
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
            'month' => ['sometimes', 'date_format:Y-m'],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'airport_id' => ['sometimes', 'nullable', 'integer'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'month.date_format' => 'Format bulan tidak valid.',
            'date.date_format' => 'Format tanggal tidak valid.',
            'airport_id.integer' => 'Bandara tidak valid.',
            'q.*' => 'Pencarian maksimal 100 karakter.',
        ];
    }

    public function month(): ?string
    {
        return $this->filled('month') ? $this->string('month')->value() : null;
    }

    public function day(): ?string
    {
        return $this->filled('date') ? $this->string('date')->value() : null;
    }

    public function airportId(): ?int
    {
        return $this->filled('airport_id') ? $this->integer('airport_id') : null;
    }

    public function search(): ?string
    {
        return $this->filled('q') ? trim($this->string('q')->value()) : null;
    }
}

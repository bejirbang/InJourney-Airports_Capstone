<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Tumpang tindih dan batas tanggal yang sudah lewat dicek di service dalam transaksi.
 */
class SpecialScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama jadwal wajib diisi.',
            'name.string' => 'Nama jadwal wajib diisi.',
            'name.max' => 'Nama jadwal maksimal 255 karakter.',
            'start_date.required' => 'Isi tanggal mulai dan selesai.',
            'end_date.required' => 'Isi tanggal mulai dan selesai.',
            'start_date.date_format' => 'Format tanggal tidak valid.',
            'end_date.date_format' => 'Format tanggal tidak valid.',
            'end_date.after_or_equal' => 'Tanggal selesai harus sesudah tanggal mulai.',
            'start_time.required' => 'Isi jam masuk dan jam pulang.',
            'end_time.required' => 'Isi jam masuk dan jam pulang.',
            'start_time.date_format' => 'Format jam tidak valid.',
            'end_time.date_format' => 'Format jam tidak valid.',
            'end_time.after' => AirportRequest::END_BEFORE_START,
        ];
    }

    /**
     * @return array{name: string, start_date: string, end_date: string, start_time: string, end_time: string}
     */
    public function schedule(): array
    {
        return [
            'name' => $this->string('name')->value(),
            'start_date' => $this->string('start_date')->value(),
            'end_date' => $this->string('end_date')->value(),
            'start_time' => $this->string('start_time')->value(),
            'end_time' => $this->string('end_time')->value(),
        ];
    }
}

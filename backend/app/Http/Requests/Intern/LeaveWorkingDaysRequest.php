<?php

namespace App\Http\Requests\Intern;

use Illuminate\Foundation\Http\FormRequest;

class LeaveWorkingDaysRequest extends FormRequest
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
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'start_date.*' => 'Isi tanggal mulai dan selesai.',
            'end_date.required' => 'Isi tanggal mulai dan selesai.',
            'end_date.date_format' => 'Isi tanggal mulai dan selesai.',
            'end_date.after_or_equal' => 'Tanggal selesai harus sesudah tanggal mulai.',
        ];
    }
}

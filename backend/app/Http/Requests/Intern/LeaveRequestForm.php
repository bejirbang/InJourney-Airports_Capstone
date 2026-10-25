<?php

namespace App\Http\Requests\Intern;

use App\Enums\LeaveType;
use App\Rules\GoogleDriveLink;
use App\Services\InternLeaves;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeaveRequestForm extends FormRequest
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
            'type' => ['required', Rule::enum(LeaveType::class)],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'reason' => ['required', 'string'],
            'evidence_url' => ['nullable', 'string', new GoogleDriveLink],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.*' => 'Pilih jenis izin.',
            'start_date.required' => 'Isi tanggal mulai dan selesai.',
            'end_date.required' => 'Isi tanggal mulai dan selesai.',
            'start_date.date_format' => InternLeaves::OUTSIDE_PERIOD,
            'end_date.date_format' => InternLeaves::OUTSIDE_PERIOD,
            'end_date.after_or_equal' => 'Tanggal selesai harus sesudah tanggal mulai.',
            'reason.required' => 'Alasan wajib diisi.',
            'evidence_url.string' => GoogleDriveLink::MESSAGE,
        ];
    }
}

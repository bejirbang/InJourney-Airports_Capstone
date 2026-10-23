<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Simpan jam kerja (docs/design-admin.md 9.1): `start_time`, `end_time` (JJ:MM), `effective_from`.
 * Tanggal berlaku paling cepat hari ini agar absensi sebelumnya tidak berubah.
 */
class WorkHourRequest extends FormRequest
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
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'effective_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'start_time.required' => 'Jam masuk wajib diisi.',
            'end_time.required' => 'Jam pulang wajib diisi.',
            'start_time.date_format' => CorrectionDecisionRequest::TIME_FORMAT,
            'end_time.date_format' => CorrectionDecisionRequest::TIME_FORMAT,
            'end_time.after' => 'Jam pulang harus setelah jam masuk.',
            'effective_from.required' => 'Tanggal berlaku wajib diisi.',
            'effective_from.date_format' => 'Format tanggal tidak valid.',
            'effective_from.after_or_equal' => 'Tanggal berlaku tidak boleh sebelum hari ini.',
        ];
    }
}

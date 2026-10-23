<?php

namespace App\Http\Requests\Intern;

use App\Services\AttendanceCorrections;
use Illuminate\Foundation\Http\FormRequest;

class AttendanceCorrectionRequest extends FormRequest
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
            'date' => ['required', 'date_format:Y-m-d'],
            'clock_in' => ['required', 'date_format:H:i'],
            'clock_out' => ['required', 'date_format:H:i', 'after:clock_in'],
            'reason' => ['required', 'string'],
            'evidence' => [
                'nullable',
                'file',
                'max:'.config('uploads.max_kilobytes'),
                'mimes:'.implode(',', config('uploads.mimes')),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.required' => 'Pilih tanggal absensi.',
            'date.date_format' => AttendanceCorrections::DATE_NOT_ALLOWED,
            'clock_in.required' => 'Isi jam clock in dan clock out yang benar.',
            'clock_out.required' => 'Isi jam clock in dan clock out yang benar.',
            'clock_in.date_format' => 'Format jam tidak valid. Gunakan JJ:MM.',
            'clock_out.date_format' => 'Format jam tidak valid. Gunakan JJ:MM.',
            'clock_out.after' => 'Jam clock out harus setelah jam clock in.',
            'reason.required' => 'Alasan wajib diisi.',
            'evidence.file' => 'Bukti tidak dapat dibaca. Pilih file lagi.',
            'evidence.max' => config('uploads.messages.max'),
            'evidence.mimes' => config('uploads.messages.mimes'),
        ];
    }
}

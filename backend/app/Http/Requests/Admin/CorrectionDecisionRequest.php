<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Keputusan koreksi absensi (docs/design-admin.md 6.3 sampai 6.5). Catatan verifikasi wajib
 * untuk Setujui maupun Tolak. Setujui juga membawa jam final `clock_in` dan `clock_out`.
 */
class CorrectionDecisionRequest extends FormRequest
{
    public const NOTE_REQUIRED = 'Catatan verifikasi wajib diisi.';

    public const TIME_FORMAT = 'Format jam tidak valid. Gunakan JJ:MM.';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        $rules = [
            'note' => ['required', 'string', 'max:1000'],
        ];

        if ($this->routeIs('admin.corrections.approve')) {
            $rules['clock_in'] = ['required', 'date_format:H:i'];
            $rules['clock_out'] = ['required', 'date_format:H:i', 'after:clock_in'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => self::NOTE_REQUIRED,
            'note.string' => self::NOTE_REQUIRED,
            'note.max' => 'Catatan maksimal 1000 karakter.',
            'clock_in.required' => 'Isi jam clock in dan clock out final.',
            'clock_out.required' => 'Isi jam clock in dan clock out final.',
            'clock_in.date_format' => self::TIME_FORMAT,
            'clock_out.date_format' => self::TIME_FORMAT,
            'clock_out.after' => 'Jam clock out harus setelah jam clock in.',
        ];
    }
}

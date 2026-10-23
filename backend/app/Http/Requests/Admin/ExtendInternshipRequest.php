<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Dialog Perpanjang Magang (docs/design-admin.md 8.2): `end_date` tanggal selesai baru.
 * Aturan "setelah tanggal selesai saat ini" diperiksa di AccountManagement::extend() saat profil dikunci.
 */
class ExtendInternshipRequest extends FormRequest
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
            'end_date' => ['required', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'end_date.required' => 'Tanggal selesai baru wajib diisi.',
            'end_date.date_format' => 'Format tanggal tidak valid.',
        ];
    }
}

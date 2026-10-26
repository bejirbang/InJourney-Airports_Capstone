<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PDF Daftar Kehadiran (`intern_id` + `month`) dan PDF Penilaian (`intern_id`). `intern_id` hanya menerima akun
 * intern, jadi id mentor atau admin di permintaan tidak bisa dipakai membuka data orang lain.
 */
class PdfReportRequest extends FormRequest
{
    public const INTERN_INVALID = 'Intern tidak ditemukan.';

    public const MONTH_INVALID = 'Pilih bulan dengan format YYYY-MM.';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $rules = [
            'intern_id' => ['required', 'integer', Rule::exists('users', 'id')->where('role', Role::Intern->value)->whereNull('deleted_at')],
        ];

        if ($this->routeIs('admin.reports.attendance-pdf')) {
            $rules['month'] = ['required', 'date_format:Y-m'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'intern_id.*' => self::INTERN_INVALID,
            'month.*' => self::MONTH_INVALID,
        ];
    }

    public function intern(): User
    {
        return User::query()->findOrFail($this->integer('intern_id'));
    }

    public function month(): string
    {
        return $this->string('month')->value();
    }
}

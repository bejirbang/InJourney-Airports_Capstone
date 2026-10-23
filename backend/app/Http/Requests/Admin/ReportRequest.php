<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Services\AdminReports;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportRequest extends FormRequest
{
    public const PERIOD_INVALID = 'Periode tidak valid.';

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
            'type' => ['required', Rule::in(array_keys(AdminReports::TYPES))],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'intern_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', Role::Intern->value)->whereNull('deleted_at')],
            'mentor_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', Role::Mentor->value)->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array{type: string, from: string, to: string, intern_id: int|null, mentor_id: int|null}
     */
    public function filters(): array
    {
        return [
            'type' => $this->string('type')->toString(),
            'from' => $this->string('from')->toString(),
            'to' => $this->string('to')->toString(),
            'intern_id' => $this->filled('intern_id') ? $this->integer('intern_id') : null,
            'mentor_id' => $this->filled('mentor_id') ? $this->integer('mentor_id') : null,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.*' => 'Pilih jenis laporan.',
            'from.*' => self::PERIOD_INVALID,
            'to.*' => self::PERIOD_INVALID,
            'intern_id.*' => 'Intern tidak ditemukan.',
            'mentor_id.*' => 'Mentor tidak ditemukan.',
        ];
    }
}

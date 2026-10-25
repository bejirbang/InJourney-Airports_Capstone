<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Services\AdminReports;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Dipakai untuk pratinjau jumlah intern dan export. Periode maksimal 12 bulan untuk menjaga beban server.
 */
class ReportRequest extends FormRequest
{
    public const PERIOD_INVALID = 'Periode tidak valid.';

    public const PERIOD_TOO_LONG = 'Pilih periode maksimal 12 bulan.';

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
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'airport_id' => ['nullable', 'integer', Rule::exists('airports', 'id')],
            'mentor_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', Role::Mentor->value)->whereNull('deleted_at')],
            'intern_ids' => ['sometimes', 'array'],
            'intern_ids.*' => ['integer', 'distinct', Rule::exists('users', 'id')->where('role', Role::Intern->value)->whereNull('deleted_at')],
            'sheets' => ['sometimes', 'array', 'min:1'],
            'sheets.*' => [Rule::in(array_keys(AdminReports::SHEETS)), 'distinct'],
            'quota_exhausted' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->hasAny(['from', 'to'])) {
                    return;
                }

                $limit = Carbon::parse($this->string('from')->value())->addMonthsNoOverflow(12)->subDay()->toDateString();

                if ($this->string('to')->value() > $limit) {
                    $validator->errors()->add('to', self::PERIOD_TOO_LONG);
                }
            },
        ];
    }

    /**
     * @return array{from: string, to: string, airport_id: int|null, mentor_id: int|null, intern_ids: list<int>, sheets: list<string>, quota_exhausted: bool}
     */
    public function filters(): array
    {
        /** @var list<int|string> $internIds */
        $internIds = $this->input('intern_ids', []);
        /** @var list<string> $sheets */
        $sheets = $this->input('sheets', array_keys(AdminReports::SHEETS));

        return [
            'from' => $this->string('from')->toString(),
            'to' => $this->string('to')->toString(),
            'airport_id' => $this->filled('airport_id') ? $this->integer('airport_id') : null,
            'mentor_id' => $this->filled('mentor_id') ? $this->integer('mentor_id') : null,
            'intern_ids' => array_map(intval(...), $internIds),
            // Urutan sheet mengikuti urutan baku, bukan urutan centang.
            'sheets' => array_values(array_intersect(array_keys(AdminReports::SHEETS), $sheets)),
            'quota_exhausted' => $this->boolean('quota_exhausted'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'from.*' => self::PERIOD_INVALID,
            'to.*' => self::PERIOD_INVALID,
            'airport_id.*' => 'Lokasi tidak ditemukan.',
            'mentor_id.*' => 'Mentor tidak ditemukan.',
            'intern_ids.*' => 'Intern tidak ditemukan.',
            'sheets.*' => 'Pilih minimal satu isi laporan.',
            'quota_exhausted.*' => 'Filter kuota tidak valid.',
        ];
    }
}

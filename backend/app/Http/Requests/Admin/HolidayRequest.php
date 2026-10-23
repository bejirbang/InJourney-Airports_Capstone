<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Validator;

class HolidayRequest extends FormRequest
{
    public const REQUIRED = 'Tanggal dan nama libur wajib diisi.';

    public const WEEKEND = 'Sabtu dan Minggu sudah libur otomatis.';

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
            'date' => ['required', 'date_format:Y-m-d'],
            'name' => ['required', 'string', 'max:100'],
            'confirm' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $date = $this->input('date');

                if (! $validator->errors()->has('date') && is_string($date) && Carbon::parse($date)->isWeekend()) {
                    $validator->errors()->add('date', self::WEEKEND);
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.required' => self::REQUIRED,
            'date.date_format' => 'Format tanggal tidak valid.',
            'name.required' => self::REQUIRED,
            'name.string' => self::REQUIRED,
            'name.max' => 'Nama libur maksimal 100 karakter.',
            'confirm.boolean' => 'Konfirmasi tidak valid.',
        ];
    }
}

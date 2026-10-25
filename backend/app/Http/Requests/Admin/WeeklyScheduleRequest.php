<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Atur satu atau beberapa hari sekaligus mulai tanggal berlaku. Hari lain disalin dari jadwal sebelumnya.
 */
class WeeklyScheduleRequest extends FormRequest
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
        return AirportRequest::weeklyRules(false);
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [fn (Validator $validator) => AirportRequest::checkHours($validator, $this->input('days'))];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return AirportRequest::weeklyMessages();
    }

    /**
     * @return list<array{day_of_week: int, is_workday: bool, start_time: string|null, end_time: string|null}>
     */
    public function days(): array
    {
        return AirportRequest::days($this);
    }

    public function effectiveFrom(): string
    {
        return $this->string('effective_from')->value();
    }
}

<?php

namespace App\Http\Requests\Admin;

use App\Models\Airport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Tambah bandara (nama, kota, jadwal mingguan pertama wajib 7 hari) dan ubah nama/kota (`PUT`). Kota dipakai di dokumen
 * PDF, jadi wajib saat tambah; `PUT` tanpa `city` mempertahankan kota lama. Aturan hari dipakai ulang oleh WeeklyScheduleRequest.
 */
class AirportRequest extends FormRequest
{
    public const NAME_REQUIRED = 'Nama bandara wajib diisi.';

    public const NAME_TAKEN = 'Nama bandara sudah dipakai.';

    public const CITY_REQUIRED = 'Kota wajib diisi.';

    public const EFFECTIVE_PAST = 'Tanggal berlaku tidak boleh di masa lalu.';

    public const DAYS_INCOMPLETE = 'Isi jadwal untuk ketujuh hari.';

    public const HOURS_REQUIRED = 'Hari kerja wajib punya jam masuk dan jam pulang.';

    public const END_BEFORE_START = 'Jam pulang harus setelah jam masuk.';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['name', 'city'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $rules = ['name' => ['required', 'string', 'max:255'], 'city' => ['sometimes', 'nullable', 'string', 'max:100']];

        return $this->editing() === null
            ? [...$rules, 'city' => ['required', 'string', 'max:100'], ...self::weeklyRules(true)]
            : $rules;
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $name = $this->input('name');
                $editing = $this->editing();

                if (! $validator->errors()->has('name') && is_string($name)) {
                    $taken = Airport::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                        ->when($editing !== null, fn ($q) => $q->whereKeyNot($editing?->id))
                        ->exists();

                    if ($taken) {
                        $validator->errors()->add('name', self::NAME_TAKEN);
                    }
                }

                if ($editing === null) {
                    self::checkHours($validator, $this->input('days'));
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
            'name.required' => self::NAME_REQUIRED,
            'name.string' => self::NAME_REQUIRED,
            'name.max' => 'Nama bandara maksimal 255 karakter.',
            'city.required' => self::CITY_REQUIRED,
            'city.string' => self::CITY_REQUIRED,
            'city.max' => 'Kota maksimal 100 karakter.',
            ...self::weeklyMessages(),
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function weeklyRules(bool $allDays): array
    {
        return [
            'effective_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'days' => ['required', 'array', $allDays ? 'size:7' : 'between:1,7'],
            'days.*' => ['array:day_of_week,is_workday,start_time,end_time'],
            'days.*.day_of_week' => ['required', 'integer', 'between:1,7', 'distinct'],
            'days.*.is_workday' => ['required', 'boolean'],
            'days.*.start_time' => ['nullable', 'date_format:H:i'],
            'days.*.end_time' => ['nullable', 'date_format:H:i'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function weeklyMessages(): array
    {
        return [
            'effective_from.required' => 'Isi tanggal berlaku.',
            'effective_from.date_format' => 'Format tanggal tidak valid.',
            'effective_from.after_or_equal' => self::EFFECTIVE_PAST,
            'days.required' => self::DAYS_INCOMPLETE,
            'days.array' => self::DAYS_INCOMPLETE,
            'days.size' => self::DAYS_INCOMPLETE,
            'days.between' => 'Pilih minimal satu hari.',
            'days.*.array' => 'Data hari tidak valid.',
            'days.*.day_of_week.*' => 'Data hari tidak valid.',
            'days.*.is_workday.*' => 'Data hari tidak valid.',
            'days.*.start_time.date_format' => 'Format jam tidak valid.',
            'days.*.end_time.date_format' => 'Format jam tidak valid.',
        ];
    }

    public static function checkHours(Validator $validator, mixed $days): void
    {
        if (! is_array($days)) {
            return;
        }

        foreach ($days as $i => $day) {
            if (! is_array($day) || ! filter_var($day['is_workday'] ?? false, FILTER_VALIDATE_BOOLEAN)
                || $validator->errors()->hasAny(["days.{$i}.start_time", "days.{$i}.end_time"])) {
                continue;
            }

            $start = $day['start_time'] ?? null;
            $end = $day['end_time'] ?? null;

            if (! is_string($start) || ! is_string($end) || $start === '' || $end === '') {
                $validator->errors()->add("days.{$i}.start_time", self::HOURS_REQUIRED);
            } elseif ($end <= $start) {
                $validator->errors()->add("days.{$i}.end_time", self::END_BEFORE_START);
            }
        }
    }

    /**
     * @return list<array{day_of_week: int, is_workday: bool, start_time: string|null, end_time: string|null}>
     */
    public static function days(FormRequest $request): array
    {
        /** @var list<array{day_of_week: int|string, is_workday: bool|int|string, start_time?: string|null, end_time?: string|null}> $days */
        $days = $request->validated('days');

        return array_map(fn (array $day): array => [
            'day_of_week' => (int) $day['day_of_week'],
            'is_workday' => filter_var($day['is_workday'], FILTER_VALIDATE_BOOLEAN),
            'start_time' => $day['start_time'] ?? null,
            'end_time' => $day['end_time'] ?? null,
        ], $days);
    }

    public function airportName(): string
    {
        return $this->string('name')->value();
    }

    /**
     * Kosong disimpan null. Saat mengubah, tanpa `city` berarti kota lama dipertahankan.
     */
    public function city(?Airport $current = null): ?string
    {
        if (! $this->has('city')) {
            return $current?->city;
        }

        $city = $this->string('city')->value();

        return $city === '' ? null : $city;
    }

    private function editing(): ?Airport
    {
        $airport = $this->route('airport');

        return $airport instanceof Airport ? $airport : null;
    }
}

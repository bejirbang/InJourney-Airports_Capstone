<?php

namespace App\Http\Requests\Admin;

use App\Models\Office;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Batas atas hanya batas kolom database. Bandara pemilik titik dipilih saat titik dibuat dan tidak dipindah.
 */
class OfficeRequest extends FormRequest
{
    public const PIN_REQUIRED = 'Pilih titik kantor di peta.';

    public const NAME_REQUIRED = 'Nama kantor wajib diisi.';

    public const NAME_TAKEN = 'Nama kantor sudah dipakai kantor lain di bandara ini.';

    public const AIRPORT_REQUIRED = 'Pilih bandara pemilik titik presensi.';

    public const RADIUS_INVALID = 'Isi radius dalam meter, lebih dari 0.';

    private const RADIUS_COLUMN_MAX = 2147483647;

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
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $radius = ['required', 'integer', 'min:1', 'max:'.self::RADIUS_COLUMN_MAX];

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'clock_in_radius_meters' => $radius,
            'clock_out_radius_meters' => $radius,
        ];

        if ($this->editing() === null) {
            $rules['airport_id'] = ['required', 'integer', Rule::exists('airports', 'id')->where('is_active', true)];
        }

        return $rules;
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
                $airportId = $editing->airport_id ?? $this->input('airport_id');

                if ($validator->errors()->hasAny(['name', 'airport_id']) || ! is_string($name)) {
                    return;
                }

                $taken = Office::query()
                    ->where('airport_id', $airportId)
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->when($editing !== null, fn ($q) => $q->whereKeyNot($editing?->id))
                    ->exists();

                if ($taken) {
                    $validator->errors()->add('name', self::NAME_TAKEN);
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
            'name.max' => 'Nama kantor maksimal 255 karakter.',
            'airport_id.*' => self::AIRPORT_REQUIRED,
            'latitude.*' => self::PIN_REQUIRED,
            'longitude.*' => self::PIN_REQUIRED,
            'clock_in_radius_meters.*' => self::RADIUS_INVALID,
            'clock_out_radius_meters.*' => self::RADIUS_INVALID,
        ];
    }

    private function editing(): ?Office
    {
        $office = $this->route('office');

        return $office instanceof Office ? $office : null;
    }
}

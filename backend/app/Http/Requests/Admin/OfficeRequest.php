<?php

namespace App\Http\Requests\Admin;

use App\Models\Office;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Tambah dan Ubah kantor (docs/design-admin.md 9A.3, 9A.4): `name`, `latitude`, `longitude` (dari pin peta),
 * `clock_in_radius_meters`, `clock_out_radius_meters`.
 *
 * Radius cukup bilangan bulat lebih dari 0, tanpa rentang tetap dari sistem (keputusan 13 Okt 2026, 17.1 no. 16).
 * Batas atas hanya batas kolom database.
 */
class OfficeRequest extends FormRequest
{
    public const PIN_REQUIRED = 'Pilih titik kantor di peta.';

    public const NAME_REQUIRED = 'Nama kantor wajib diisi.';

    public const NAME_TAKEN = 'Nama kantor sudah dipakai kantor lain.';

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
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        $radius = ['required', 'integer', 'min:1', 'max:'.self::RADIUS_COLUMN_MAX];

        return [
            'name' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'clock_in_radius_meters' => $radius,
            'clock_out_radius_meters' => $radius,
        ];
    }

    /**
     * Nama tidak boleh sama dengan kantor lain tanpa membedakan huruf besar, termasuk kantor nonaktif.
     * Kantor yang sudah dihapus tidak dihitung, jadi namanya boleh dipakai lagi.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $name = $this->input('name');

                if ($validator->errors()->has('name') || ! is_string($name)) {
                    return;
                }

                $editing = $this->route('office');
                $editingId = $editing instanceof Office ? $editing->id : null;

                $taken = Office::query()
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->when($editingId !== null, fn ($q) => $q->whereKeyNot($editingId))
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
            'latitude.*' => self::PIN_REQUIRED,
            'longitude.*' => self::PIN_REQUIRED,
            'clock_in_radius_meters.*' => self::RADIUS_INVALID,
            'clock_out_radius_meters.*' => self::RADIUS_INVALID,
        ];
    }
}

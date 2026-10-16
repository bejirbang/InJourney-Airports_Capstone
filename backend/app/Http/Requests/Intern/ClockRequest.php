<?php

namespace App\Http\Requests\Intern;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Posisi dari browser saat tombol Clock In atau Clock Out ditekan.
 */
class ClockRequest extends FormRequest
{
    public const LOCATION_UNREADABLE = 'Lokasi tidak dapat dibaca. Coba lagi.';

    /**
     * Cukup satu pesan, tanpa tambahan "(and 1 more error)".
     *
     * @var bool
     */
    protected $stopOnFirstFailure = true;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'latitude.*' => self::LOCATION_UNREADABLE,
            'longitude.*' => self::LOCATION_UNREADABLE,
        ];
    }
}

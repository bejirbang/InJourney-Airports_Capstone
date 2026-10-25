<?php

namespace App\Http\Requests\Admin;

use App\Services\SystemSettings;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Batas atas hanya penjaga nilai yang tidak masuk akal, bukan aturan dari dokumen.
 */
class GeneralSettingsRequest extends FormRequest
{
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
            SystemSettings::LATE_TOLERANCE_MINUTES => ['required', 'integer', 'between:0,120'],
            SystemSettings::LEAVE_QUOTA => ['required', 'integer', 'between:1,30'],
            SystemSettings::END_REMINDER_DAYS => ['required', 'integer', 'between:1,60'],
            SystemSettings::LEAVE_ESCALATION_HOURS => ['required', 'integer', 'between:1,168'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            SystemSettings::LATE_TOLERANCE_MINUTES.'.*' => 'Isi toleransi terlambat 0-120 menit.',
            SystemSettings::LEAVE_QUOTA.'.*' => 'Isi kuota izin 1-30 kali.',
            SystemSettings::END_REMINDER_DAYS.'.*' => 'Isi pengingat akhir magang 1-60 hari.',
            SystemSettings::LEAVE_ESCALATION_HOURS.'.*' => 'Isi batas izin ke admin 1-168 jam.',
        ];
    }

    /**
     * @return array<string, int>
     */
    public function values(): array
    {
        $values = [];

        foreach (array_keys($this->rules()) as $key) {
            $values[$key] = $this->integer($key);
        }

        return $values;
    }
}

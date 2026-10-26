<?php

namespace App\Http\Requests\Mentor;

use App\Models\AssessmentIndicator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `scores` berisi nilai bulat per indikator aktif; nilai kosong boleh saat simpan draft. `notes` catatan mentor
 * (opsional). Kelengkapan saat submit dan syarat penilaian dicek ulang di service.
 */
class AssessmentRequest extends FormRequest
{
    public const SCORE_RANGE = 'Nilai harus antara 0 dan 100.';

    public const INDICATOR_INVALID = 'Indikator tidak valid.';

    public const SCORE_INTEGER = 'Nilai harus berupa bilangan bulat.';

    public const NOTES_TOO_LONG = 'Catatan maksimal 1000 karakter.';

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('notes'))) {
            $this->merge(['notes' => trim($this->input('notes'))]);
        }
    }

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
            'scores' => ['present', 'array'],
            'scores.*' => ['array:indicator_id,score'],
            'scores.*.indicator_id' => [
                'required',
                'integer',
                'distinct',
                Rule::in(AssessmentIndicator::query()->active()->pluck('id')->all()),
            ],
            'scores.*.score' => ['nullable', 'integer', 'between:0,100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'scores.present' => 'Isi nilai penilaian.',
            'scores.array' => 'Isi nilai penilaian.',
            'scores.*.array' => self::INDICATOR_INVALID,
            'scores.*.indicator_id.*' => self::INDICATOR_INVALID,
            'scores.*.score.integer' => self::SCORE_INTEGER,
            'scores.*.score.*' => self::SCORE_RANGE,
            'notes.max' => self::NOTES_TOO_LONG,
            'notes.*' => 'Catatan tidak valid.',
        ];
    }

    /**
     * Nilai per id indikator, tanpa nilai kosong.
     *
     * @return array<int, int>
     */
    public function scores(): array
    {
        /** @var list<array{indicator_id: int|string, score: int|string|null}> $rows */
        $rows = $this->validated('scores');
        $scores = [];

        foreach ($rows as $row) {
            if ($row['score'] !== null && $row['score'] !== '') {
                $scores[(int) $row['indicator_id']] = (int) $row['score'];
            }
        }

        return $scores;
    }

    /**
     * Catatan kosong disimpan null.
     */
    public function notes(): ?string
    {
        $notes = $this->validated('notes');

        return is_string($notes) && $notes !== '' ? $notes : null;
    }
}

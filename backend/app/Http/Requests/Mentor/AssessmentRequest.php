<?php

namespace App\Http\Requests\Mentor;

use App\Models\AssessmentIndicator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `scores` berisi nilai per indikator aktif; nilai kosong boleh saat simpan draft. Kelengkapan saat submit dan
 * syarat penilaian dicek ulang di service.
 */
class AssessmentRequest extends FormRequest
{
    public const SCORE_RANGE = 'Nilai harus antara 0 dan 100.';

    public const INDICATOR_INVALID = 'Indikator tidak valid.';

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
            'scores.*.score' => ['nullable', 'numeric', 'between:0,100', 'decimal:0,2'],
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
            'scores.*.score.decimal' => 'Nilai maksimal 2 angka di belakang koma.',
            'scores.*.score.*' => self::SCORE_RANGE,
        ];
    }

    /**
     * Nilai per id indikator, tanpa nilai kosong.
     *
     * @return array<int, float>
     */
    public function scores(): array
    {
        /** @var list<array{indicator_id: int|string, score: int|float|string|null}> $rows */
        $rows = $this->validated('scores');
        $scores = [];

        foreach ($rows as $row) {
            if ($row['score'] !== null && $row['score'] !== '') {
                $scores[(int) $row['indicator_id']] = (float) $row['score'];
            }
        }

        return $scores;
    }
}

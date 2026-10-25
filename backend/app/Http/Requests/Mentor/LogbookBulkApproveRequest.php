<?php

namespace App\Http\Requests\Mentor;

use Illuminate\Foundation\Http\FormRequest;

class LogbookBulkApproveRequest extends FormRequest
{
    public const SELECT_FIRST = 'Pilih logbook yang akan disetujui.';

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
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'ids.max' => 'Pilih paling banyak 200 logbook sekaligus.',
            'ids.*' => self::SELECT_FIRST,
            'ids.*.*' => self::SELECT_FIRST,
        ];
    }

    /**
     * @return list<int>
     */
    public function ids(): array
    {
        /** @var list<int|string> $ids */
        $ids = $this->input('ids', []);

        return array_map(intval(...), $ids);
    }
}

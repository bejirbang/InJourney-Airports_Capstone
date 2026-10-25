<?php

namespace App\Http\Requests\Admin;

use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Nama unit unik tanpa beda huruf besar, sama dengan index database.
 */
class UnitRequest extends FormRequest
{
    public const NAME_REQUIRED = 'Nama unit wajib diisi.';

    public const NAME_TAKEN = 'Nama unit sudah dipakai.';

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
            'name' => ['required', 'string', 'max:255'],
        ];
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

                if ($validator->errors()->has('name') || ! is_string($name)) {
                    return;
                }

                $taken = Unit::query()
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
            'name.max' => 'Nama unit maksimal 255 karakter.',
        ];
    }

    public function unitName(): string
    {
        return $this->string('name')->value();
    }

    private function editing(): ?Unit
    {
        $unit = $this->route('unit');

        return $unit instanceof Unit ? $unit : null;
    }
}

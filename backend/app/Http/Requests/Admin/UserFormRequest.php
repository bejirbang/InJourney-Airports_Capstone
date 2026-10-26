<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstitutionType;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class UserFormRequest extends FormRequest
{
    public const NAME_REQUIRED = 'Nama wajib diisi.';

    public const EMAIL_REQUIRED = 'Email wajib diisi.';

    public const EMAIL_FORMAT = 'Format email tidak valid.';

    public const EMAIL_TAKEN = 'Email sudah terdaftar.';

    public const UNIT_REQUIRED = 'Pilih unit.';

    public const MENTOR_REQUIRED = 'Pilih mentor untuk intern ini.';

    public const AIRPORT_REQUIRED = 'Pilih lokasi magang.';

    public const INSTITUTION_TYPE_REQUIRED = 'Pilih jenis institusi: universitas atau sekolah.';

    public const UNIVERSITY_REQUIRED = 'Asal universitas wajib diisi.';

    public const MAJOR_REQUIRED = 'Jurusan wajib diisi.';

    public const STUDENT_NUMBER_REQUIRED = 'NIM/NIS wajib diisi.';

    public const PERIOD_INVALID = 'Tanggal selesai harus sesudah tanggal mulai.';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Email disimpan huruf kecil, jadi pemeriksaan "sudah terdaftar" juga tanpa beda huruf besar.
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }

        foreach (['university', 'major', 'student_number'] as $field) {
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
        $editing = $this->editing();
        $role = $editing->role ?? Role::tryFrom((string) $this->input('role'));
        $isIntern = $role === Role::Intern;

        $unique = Rule::unique('users', 'email')->withoutTrashed();

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255', 'email', $editing === null ? $unique : $unique->ignore($editing->id)],
        ];

        if ($editing === null) {
            $rules['role'] = ['required', Rule::enum(Role::class)];
        }

        if ($role === Role::Intern || $role === Role::Mentor) {
            $rules['unit_id'] = ['required', 'integer', $this->activeOrCurrent('units', $editing?->unit_id)];
        }

        if ($editing === null && $isIntern) {
            $rules['mentor_id'] = ['required', 'integer', Rule::exists('users', 'id')
                ->where('role', Role::Mentor->value)
                ->where('is_active', true)
                ->whereNull('deleted_at')];
        }

        if ($isIntern) {
            $rules['airport_id'] = ['required', 'integer', $this->activeOrCurrent('airports', $editing?->internProfile?->airport_id)];
            $rules['institution_type'] = ['required', Rule::enum(InstitutionType::class)];
            $rules['university'] = ['required', 'string', 'max:255'];
            $rules['major'] = ['required', 'string', 'max:255'];
            $rules['student_number'] = ['required', 'string', 'max:30'];
            $rules['start_date'] = ['required', 'date_format:Y-m-d'];
            // Tanggal selesai tidak boleh sebelum tanggal mulai; magang satu hari diperbolehkan.
            $rules['end_date'] = ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => self::NAME_REQUIRED,
            'name.string' => self::NAME_REQUIRED,
            'name.max' => 'Nama maksimal 255 karakter.',
            'email.required' => self::EMAIL_REQUIRED,
            'email.string' => self::EMAIL_FORMAT,
            'email.max' => self::EMAIL_FORMAT,
            'email.email' => self::EMAIL_FORMAT,
            'email.unique' => self::EMAIL_TAKEN,
            'role.required' => 'Pilih role akun.',
            'role.enum' => 'Pilih role akun.',
            'unit_id.*' => self::UNIT_REQUIRED,
            'mentor_id.*' => self::MENTOR_REQUIRED,
            'airport_id.*' => self::AIRPORT_REQUIRED,
            'institution_type.*' => self::INSTITUTION_TYPE_REQUIRED,
            'university.max' => 'Asal universitas maksimal 255 karakter.',
            'university.*' => self::UNIVERSITY_REQUIRED,
            'major.max' => 'Jurusan maksimal 255 karakter.',
            'major.*' => self::MAJOR_REQUIRED,
            'student_number.max' => 'NIM/NIS maksimal 30 karakter.',
            'student_number.*' => self::STUDENT_NUMBER_REQUIRED,
            'start_date.*' => self::PERIOD_INVALID,
            'end_date.*' => self::PERIOD_INVALID,
        ];
    }

    /**
     * Pilihan nonaktif tidak bisa dipilih untuk akun baru, tetapi akun lama boleh tetap memakainya.
     */
    private function activeOrCurrent(string $table, ?int $currentId): Exists
    {
        return Rule::exists($table, 'id')->where(fn (Builder $q) => $q
            ->where('is_active', true)
            ->when($currentId !== null, fn (Builder $q) => $q->orWhere('id', $currentId)));
    }

    private function editing(): ?User
    {
        $user = $this->route('user');

        return $user instanceof User ? $user : null;
    }
}

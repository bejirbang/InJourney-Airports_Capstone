<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Tambah Akun dan Ubah data (docs/design-admin.md 4.2, tabel Validasi).
 *
 * Tambah: `name`, `email`, `role`, `title` (opsional); untuk intern juga `mentor_id`, `start_date`, `end_date`.
 * Ubah: tanpa `role` dan `mentor_id` (role tidak bisa diubah, mentor lewat Ganti mentor);
 * `start_date` dan `end_date` hanya untuk intern.
 */
class UserFormRequest extends FormRequest
{
    public const NAME_REQUIRED = 'Nama wajib diisi.';

    public const EMAIL_REQUIRED = 'Email wajib diisi.';

    public const EMAIL_FORMAT = 'Format email tidak valid.';

    public const EMAIL_TAKEN = 'Email sudah terdaftar.';

    public const MENTOR_REQUIRED = 'Pilih mentor untuk intern ini.';

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
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $editing = $this->editing();
        $isIntern = $editing === null
            ? $this->input('role') === Role::Intern->value
            : $editing->hasRole(Role::Intern);

        $unique = Rule::unique('users', 'email')->withoutTrashed();

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'max:255', 'email', $editing === null ? $unique : $unique->ignore($editing->id)],
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($editing === null) {
            $rules['role'] = ['required', Rule::enum(Role::class)];
        }

        if ($editing === null && $isIntern) {
            $rules['mentor_id'] = ['required', 'integer', Rule::exists('users', 'id')
                ->where('role', Role::Mentor->value)
                ->where('is_active', true)
                ->whereNull('deleted_at')];
        }

        if ($isIntern) {
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
            'title.string' => 'Jabatan tidak valid.',
            'title.max' => 'Jabatan maksimal 255 karakter.',
            'role.required' => 'Pilih role akun.',
            'role.enum' => 'Pilih role akun.',
            'mentor_id.*' => self::MENTOR_REQUIRED,
            'start_date.*' => self::PERIOD_INVALID,
            'end_date.*' => self::PERIOD_INVALID,
        ];
    }

    private function editing(): ?User
    {
        $user = $this->route('user');

        return $user instanceof User ? $user : null;
    }
}

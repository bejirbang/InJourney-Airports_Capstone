<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Services\AdminUsers;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filter daftar Pengguna: `q` (nama atau email), `role`, `status` (active, inactive, all; default active), `page`.
 */
class UserIndexRequest extends FormRequest
{
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
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'role' => ['sometimes', 'nullable', Rule::enum(Role::class)],
            'status' => ['sometimes', Rule::in(AdminUsers::STATUSES)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*' => 'Filter pengguna tidak valid.',
        ];
    }
}

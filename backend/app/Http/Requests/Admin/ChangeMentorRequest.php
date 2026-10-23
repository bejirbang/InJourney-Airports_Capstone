<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Services\AccountManagement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangeMentorRequest extends FormRequest
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
            'mentor_id' => ['required', 'integer', Rule::exists('users', 'id')
                ->where('role', Role::Mentor->value)
                ->where('is_active', true)
                ->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'mentor_id.*' => AccountManagement::SAME_MENTOR,
        ];
    }
}

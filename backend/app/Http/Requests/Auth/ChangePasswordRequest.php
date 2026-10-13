<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Validator;

/**
 * Ganti password sementara. Pesan sama dengan validatePassword di frontend/src/lib/mock-rules.ts.
 */
class ChangePasswordRequest extends FormRequest
{
    public const RULE_MESSAGE = 'Password minimal 8 karakter dan berisi huruf serta angka.';

    public const SAME_AS_TEMPORARY = 'Password baru tidak boleh sama dengan password sementara.';

    public const CONFIRMATION = 'Ulangi password baru dengan isian yang sama.';

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'password' => ['bail', 'required', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/\d/', 'confirmed'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.required' => self::RULE_MESSAGE,
            'password.string' => self::RULE_MESSAGE,
            'password.min' => self::RULE_MESSAGE,
            'password.regex' => self::RULE_MESSAGE,
            'password.confirmed' => self::CONFIRMATION,
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var User $user */
                $user = $this->user();

                if (Hash::check($this->string('password')->value(), $user->password)) {
                    $validator->errors()->add('password', self::SAME_AS_TEMPORARY);
                }
            },
        ];
    }
}

<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Host dicocokkan persis, bukan "mengandung", agar drive.google.com.situs-jahat.com tidak lolos.
 */
class GoogleDriveLink implements ValidationRule
{
    public const MESSAGE = 'Link harus berupa link Google Drive atau Google Docs, contoh: https://drive.google.com/...';

    public const MAX_LENGTH = 2048;

    public const HOSTS = ['drive.google.com', 'docs.google.com'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::passes($value)) {
            $fail(self::MESSAGE);
        }
    }

    public static function passes(mixed $value): bool
    {
        if (! is_string($value) || strlen($value) > self::MAX_LENGTH || filter_var($value, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($value);

        return $parts !== false
            && ($parts['scheme'] ?? null) === 'https'
            && in_array($parts['host'] ?? null, self::HOSTS, true)
            && ! isset($parts['user'])
            && ! isset($parts['pass'])
            && ! isset($parts['port']);
    }
}

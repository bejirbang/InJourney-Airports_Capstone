<?php

namespace App\Http\Requests\Intern;

use App\Rules\GoogleDriveLink;
use Illuminate\Foundation\Http\FormRequest;

class PresentationRequest extends FormRequest
{
    public const LINK_REQUIRED = 'Link bukti wajib diisi.';

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
            'evidence_url' => ['required', 'string', new GoogleDriveLink],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'evidence_url.required' => self::LINK_REQUIRED,
            'evidence_url.string' => GoogleDriveLink::MESSAGE,
        ];
    }

    public function evidenceUrl(): string
    {
        return $this->string('evidence_url')->value();
    }
}

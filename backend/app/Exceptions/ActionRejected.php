<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tindakan ditolak karena aturan bisnis (absensi, koreksi, Task).
 * `reason` membantu frontend memilih tampilan, misalnya tombol Coba lagi untuk `outside_radius`.
 * `data` berisi isi tambahan untuk tampilan itu, misalnya jumlah intern di dialog dampak libur.
 */
class ActionRejected extends Exception
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(string $message, public readonly string $reason, public readonly array $data = [])
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'reason' => $this->reason,
            ...$this->data,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}

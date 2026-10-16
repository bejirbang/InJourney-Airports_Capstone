<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tindakan ditolak karena aturan bisnis (absensi, koreksi, Task).
 * `reason` membantu frontend memilih tampilan, misalnya tombol Coba lagi untuk `outside_radius`.
 */
class ActionRejected extends Exception
{
    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'reason' => $this->reason,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}

<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

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

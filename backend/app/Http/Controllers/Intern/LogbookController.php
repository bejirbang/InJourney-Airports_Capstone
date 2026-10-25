<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\LogbookIndexRequest;
use App\Http\Requests\Intern\LogbookRequest;
use App\Models\User;
use App\Services\InternLogbooks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Symfony\Component\HttpFoundation\Response;

class LogbookController extends Controller
{
    public const MESSAGES = [
        InternLogbooks::ACTION_SAVE => 'Logbook tersimpan.',
        InternLogbooks::ACTION_SUBMIT => 'Logbook terkirim ke mentor.',
        InternLogbooks::ACTION_RESUBMIT => 'Logbook terkirim ulang ke mentor.',
    ];

    public function __construct(private InternLogbooks $logbooks) {}

    public function index(LogbookIndexRequest $request): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $this->logbooks->month(
            $intern,
            $request->filled('month') ? $request->string('month')->value() : null,
            $request->filled('status') ? $request->string('status')->value() : null,
            Date::now(),
        )]);
    }

    public function show(Request $request, string $date): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $this->logbooks->day($intern, $date, Date::now())]);
    }

    public function update(LogbookRequest $request, string $date): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();
        $now = Date::now();

        $result = $this->logbooks->save(
            $intern,
            $date,
            $request->string('work')->value(),
            $request->filled('notes') ? $request->string('notes')->value() : null,
            $now,
        );

        return response()->json([
            'message' => self::MESSAGES[$result['action']],
            'data' => $this->logbooks->day($intern, $date, $now),
        ], $result['created'] ? Response::HTTP_CREATED : Response::HTTP_OK);
    }
}

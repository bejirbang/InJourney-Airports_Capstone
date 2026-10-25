<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\ChatMessageRequest;
use App\Models\User;
use App\Services\Chats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;

class ChatController extends Controller
{
    public function __construct(private Chats $chats) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $result = $this->chats->conversations($me, $request->filled('q') ? $request->string('q')->value() : null, Date::now());

        return response()->json(['data' => $result['conversations'], 'meta' => ['unread_total' => $result['unread_total']]]);
    }

    public function contacts(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        return response()->json(['data' => $this->chats->contacts($me, $request->filled('q') ? $request->string('q')->value() : null, Date::now())]);
    }

    public function messages(Request $request, User $user): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $result = $this->chats->messages($me, $user, $request->filled('before_id') ? $request->integer('before_id') : null, Date::now());

        return response()->json([
            'data' => $result['messages'],
            'meta' => ['partner' => $result['partner'], 'has_more' => $result['has_more']],
        ]);
    }

    public function send(ChatMessageRequest $request, User $user): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        return response()->json(['data' => $this->chats->send($me, $user, $request->string('body')->value(), Date::now())], Response::HTTP_CREATED);
    }

    public function read(Request $request, User $user): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        return response()->json(['meta' => $this->chats->markRead($me, $user, Date::now())]);
    }
}

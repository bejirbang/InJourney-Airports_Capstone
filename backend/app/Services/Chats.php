<?php

namespace App\Services;

use App\Events\ChatMessageSent;
use App\Events\ChatMessagesRead;
use App\Exceptions\ActionRejected;
use App\Models\ChatMessage;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class Chats
{
    public const MESSAGES_PER_PAGE = 30;

    public const CONTACT_LIMIT = 50;

    public const SELF = 'Anda tidak bisa chat dengan diri sendiri.';

    public const INACTIVE_RECIPIENT = 'Akun ini nonaktif.';

    public function __construct(private Notifier $notifier, private UserNotifications $notifications) {}

    /**
     * @return array{conversations: list<array<string, mixed>>, unread_total: int}
     */
    public function conversations(User $me, ?string $search, CarbonInterface $now): array
    {
        $partnerSql = 'CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END';

        $latest = ChatMessage::query()
            ->selectRaw("{$partnerSql} AS partner_id, MAX(id) AS last_id", [$me->id])
            ->where(fn (Builder $q) => $q->where('sender_id', $me->id)->orWhere('receiver_id', $me->id))
            ->groupByRaw($partnerSql, [$me->id])
            ->get()
            ->mapWithKeys(fn (ChatMessage $row): array => [(int) $row->getAttribute('partner_id') => (int) $row->getAttribute('last_id')]);

        // Akun yang dihapus tidak tampil.
        $partners = User::query()
            ->whereIn('id', $latest->keys())
            ->when($search, fn (Builder $q, string $s) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($s).'%']))
            ->with(['internProfile', 'unit'])
            ->get()
            ->keyBy('id');

        $lastMessages = ChatMessage::query()->whereIn('id', $latest->only($partners->keys()->all())->values())->get()->keyBy('id');
        $unread = $this->unreadBySender($me);

        $rows = [];

        foreach ($latest->sortDesc() as $partnerId => $lastId) {
            $partner = $partners->get($partnerId);
            $last = $lastMessages->get($lastId);

            if ($partner === null || $last === null) {
                continue;
            }

            $rows[] = [
                'partner' => $this->person($partner, $now),
                'last_message' => $last->toItem(),
                'unread_count' => $unread[$partnerId] ?? 0,
            ];
        }

        return ['conversations' => $rows, 'unread_total' => $this->unreadTotal($unread)];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function contacts(User $me, ?string $search, CarbonInterface $now): array
    {
        return array_values(User::query()
            ->whereKeyNot($me->id)
            ->reachable($now->toDateString())
            ->when($search, fn (Builder $q, string $s) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($s).'%']))
            ->with(['internProfile', 'unit'])
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::CONTACT_LIMIT)
            ->get()
            ->map(fn (User $user): array => $this->person($user, $now))
            ->all());
    }

    /**
     * @return array{partner: array<string, mixed>, messages: list<array<string, mixed>>, has_more: bool}
     *
     * @throws ActionRejected
     */
    public function messages(User $me, User $partner, ?int $beforeId, CarbonInterface $now): array
    {
        $this->ensureNotSelf($me, $partner);

        $page = ChatMessage::query()
            ->between($me->id, $partner->id)
            ->when($beforeId, fn (Builder $q, int $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')
            ->limit(self::MESSAGES_PER_PAGE + 1)
            ->get();

        return [
            'partner' => $this->person($partner->loadMissing(['internProfile', 'unit']), $now),
            'messages' => array_values($page->take(self::MESSAGES_PER_PAGE)->reverse()->map(fn (ChatMessage $m): array => $m->toItem())->all()),
            'has_more' => $page->count() > self::MESSAGES_PER_PAGE,
        ];
    }

    /**
     * @return array{id: int, sender_id: int, receiver_id: int, body: string, read_at: string|null, created_at: string|null}
     *
     * @throws ActionRejected
     */
    public function send(User $me, User $partner, string $body, CarbonInterface $now): array
    {
        $this->ensureNotSelf($me, $partner);

        if (! $partner->isReachable($now->toDateString())) {
            throw new ActionRejected(self::INACTIVE_RECIPIENT, 'inactive_recipient');
        }

        $message = DB::transaction(function () use ($me, $partner, $body): ChatMessage {
            $message = ChatMessage::query()->create([
                'sender_id' => $me->id,
                'receiver_id' => $partner->id,
                'body' => $body,
            ]);

            $this->notifier->chatMessage($partner, $me);

            return $message;
        });

        ChatMessageSent::dispatch($message->toItem(), ['id' => $me->id, 'name' => $me->name]);

        return $message->toItem();
    }

    /**
     * @return array{unread_total: int}
     *
     * @throws ActionRejected
     */
    public function markRead(User $me, User $partner, CarbonInterface $now): array
    {
        $this->ensureNotSelf($me, $partner);

        $unread = ChatMessage::query()->where('sender_id', $partner->id)->where('receiver_id', $me->id)->whereNull('read_at');
        $lastId = $unread->clone()->max('id');

        if ($lastId !== null) {
            $unread->where('id', '<=', $lastId)->update(['read_at' => $now]);
            ChatMessagesRead::dispatch($me->id, $partner->id, (int) $lastId, $now->toIso8601String());
        }

        $this->notifications->markChatRead($me, $partner->id);

        return ['unread_total' => $this->unreadTotal($this->unreadBySender($me))];
    }

    /**
     * Angka di ikon chat: semua pesan belum dibaca dari akun yang masih ada, tidak terpengaruh pencarian.
     *
     * @param  array<int, int>  $unread
     */
    private function unreadTotal(array $unread): int
    {
        $existing = User::query()->whereIn('id', array_keys($unread))->pluck('id')->all();

        return array_sum(array_intersect_key($unread, array_flip($existing)));
    }

    /**
     * @return array<int, int>
     */
    private function unreadBySender(User $me): array
    {
        return ChatMessage::query()
            ->where('receiver_id', $me->id)
            ->whereNull('read_at')
            ->selectRaw('sender_id, COUNT(*) AS unread')
            ->groupBy('sender_id')
            ->get()
            ->mapWithKeys(fn (ChatMessage $row): array => [$row->sender_id => (int) $row->getAttribute('unread')])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function person(User $user, CarbonInterface $now): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->role->value,
            'unit' => $user->unit?->name,
            'can_send' => $user->isReachable($now->toDateString()),
        ];
    }

    /**
     * @throws ActionRejected
     */
    private function ensureNotSelf(User $me, User $partner): void
    {
        if ($me->is($partner)) {
            throw new ActionRejected(self::SELF, 'self');
        }
    }
}

<?php

use App\Events\ChatMessageSent;
use App\Events\ChatMessagesRead;
use App\Events\NotificationSent;
use App\Events\NotificationsRead;
use App\Models\ChatMessage;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->sari = User::factory()->mentor()->create(['name' => 'Sari Wijaya', 'title' => 'UI/UX Lead']);
    $this->rina = User::factory()->intern(['mentor_id' => $this->sari->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Rina Wulandari']);
    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
});

function chat(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function message(User $from, User $to, string $body, string $at, ?string $readAt = null): ChatMessage
{
    $message = ChatMessage::query()->create(['sender_id' => $from->id, 'receiver_id' => $to->id, 'body' => $body, 'read_at' => $readAt]);
    $message->forceFill(['created_at' => $at, 'updated_at' => $at])->saveQuietly();

    return $message;
}

describe('kirim pesan', function () {
    it('stores the message, notifies the receiver once per sender, and broadcasts to both sides', function () {
        Event::fake([ChatMessageSent::class, NotificationSent::class]);

        $response = chat($this->admin, 'POST', "/api/chats/{$this->sari->id}/messages", ['body' => '  Halo Bu Sari, masa magang Rina berakhir 17 Okt 2026. ']);

        $response->assertCreated()->assertJsonPath('data', [
            'id' => $response->json('data.id'),
            'sender_id' => $this->admin->id,
            'receiver_id' => $this->sari->id,
            'body' => 'Halo Bu Sari, masa magang Rina berakhir 17 Okt 2026.',
            'read_at' => null,
            'created_at' => '2026-10-12T10:00:00+07:00',
        ]);

        expect(Notification::query()->sole()->only(['user_id', 'chat_sender_id', 'text', 'link_path', 'link_params']))->toBe([
            'user_id' => $this->sari->id,
            'chat_sender_id' => $this->admin->id,
            'text' => 'Pesan baru dari Admin Sinta.',
            'link_path' => '/chat',
            'link_params' => ['to' => $this->admin->id],
        ]);

        Event::assertDispatched(ChatMessageSent::class, fn (ChatMessageSent $e): bool => $e->broadcastAs() === 'chat.message'
            && array_map(fn ($c) => $c->name, $e->broadcastOn()) === ["private-users.{$this->sari->id}", "private-users.{$this->admin->id}"]
            && $e->broadcastWith()['sender'] === ['id' => $this->admin->id, 'name' => 'Admin Sinta']);
        Event::assertDispatched(NotificationSent::class, fn (NotificationSent $e): bool => $e->userId === $this->sari->id);
    });

    it('moves the same sender notification up and makes it unread again instead of adding rows', function () {
        chat($this->admin, 'POST', "/api/chats/{$this->sari->id}/messages", ['body' => 'Pesan pertama.'])->assertCreated();
        Notification::query()->update(['read_at' => now()]);

        $this->travelTo(Carbon::parse('2026-10-12 11:30:00'));
        chat($this->admin, 'POST', "/api/chats/{$this->sari->id}/messages", ['body' => 'Pesan kedua.'])->assertCreated();

        $notification = Notification::query()->sole();
        expect($notification->read_at)->toBeNull()
            ->and($notification->created_at->toDateTimeString())->toBe('2026-10-12 11:30:00');
    });

    it('lets anyone chat with anyone reachable, including an intern who has not started', function () {
        $newIntern = User::factory()->intern(['mentor_id' => $this->sari->id, 'start_date' => '2026-11-01', 'end_date' => '2027-01-31'])->create();

        chat($this->rina, 'POST', "/api/chats/{$this->admin->id}/messages", ['body' => 'Halo.'])->assertCreated();
        chat($this->sari, 'POST', "/api/chats/{$newIntern->id}/messages", ['body' => 'Selamat datang.'])->assertCreated();
    });

    it('refuses new messages to accounts that cannot log in', function (Closure $target) {
        chat($this->admin, 'POST', '/api/chats/'.$target()->id.'/messages', ['body' => 'Halo.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'inactive_recipient')
            ->assertJsonPath('message', 'Akun ini nonaktif.');

        expect(ChatMessage::query()->count())->toBe(0);
    })->with([
        'dinonaktifkan' => [fn () => User::factory()->mentor()->inactive()->create()],
        'magang berakhir' => [fn () => User::factory()->intern(['start_date' => '2026-07-01', 'end_date' => '2026-10-11'])->create()],
    ]);

    it('validates the message', function (string $body, string $message) {
        chat($this->rina, 'POST', "/api/chats/{$this->sari->id}/messages", ['body' => $body])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['body' => $message]);
    })->with([
        'kosong' => ['   ', 'Pesan wajib diisi.'],
        'terlalu panjang' => [str_repeat('a', 2001), 'Pesan maksimal 2000 karakter.'],
    ]);

    it('rejects chatting with yourself and with deleted accounts', function () {
        chat($this->rina, 'POST', "/api/chats/{$this->rina->id}/messages", ['body' => 'Halo.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'self');

        $gone = User::factory()->mentor()->create();
        $gone->delete();
        chat($this->rina, 'POST', "/api/chats/{$gone->id}/messages", ['body' => 'Halo.'])->assertNotFound();
    });
});

describe('daftar percakapan', function () {
    it('lists only my conversations, latest first, with unread counts', function () {
        $budi = User::factory()->intern(['mentor_id' => $this->sari->id])->create(['name' => 'Budi Kurniawan']);
        message($this->rina, $this->sari, 'Bu, Task ERD sudah saya kumpulkan.', '2026-10-12 08:00:00', '2026-10-12 08:05:00');
        message($this->sari, $this->rina, 'Baik, saya cek.', '2026-10-12 08:10:00');
        message($this->admin, $this->rina, 'Bisa jelaskan kenapa lupa clock out?', '2026-10-12 09:00:00');
        message($this->admin, $this->rina, 'Mohon dijawab.', '2026-10-12 09:01:00');
        message($budi, $this->sari, 'Rahasia.', '2026-10-12 09:30:00');

        chat($this->rina, 'GET', '/api/chats')
            ->assertOk()
            ->assertJsonPath('data.*.partner.name', ['Admin Sinta', 'Sari Wijaya'])
            ->assertJsonPath('data.0.unread_count', 2)
            ->assertJsonPath('data.0.last_message.body', 'Mohon dijawab.')
            ->assertJsonPath('data.1.partner', [
                'id' => $this->sari->id,
                'name' => 'Sari Wijaya',
                'role' => 'mentor',
                'title' => 'UI/UX Lead',
                'photo_url' => null,
                'can_send' => true,
            ])
            ->assertJsonPath('data.1.unread_count', 1)
            ->assertJsonPath('meta.unread_total', 3);

        chat($this->rina, 'GET', '/api/chats?q=sari')->assertJsonPath('data.*.partner.name', ['Sari Wijaya'])->assertJsonPath('meta.unread_total', 3);

        chat($this->admin, 'GET', '/api/chats')->assertJsonPath('data.*.partner.name', ['Rina Wulandari']);
    });

    it('keeps old conversations with inactive accounts readable but closed, and hides deleted accounts', function () {
        $old = User::factory()->mentor()->inactive()->create(['name' => 'Mentor Lama']);
        $gone = User::factory()->mentor()->create(['name' => 'Sudah Dihapus']);
        message($old, $this->rina, 'Sampai jumpa.', '2026-10-01 08:00:00');
        message($gone, $this->rina, 'Halo.', '2026-10-02 08:00:00');
        $gone->delete();

        chat($this->rina, 'GET', '/api/chats')
            ->assertJsonPath('data.*.partner.name', ['Mentor Lama'])
            ->assertJsonPath('data.0.partner.can_send', false)
            ->assertJsonPath('meta.unread_total', 1);

        chat($this->rina, 'GET', "/api/chats/{$old->id}/messages")
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Sampai jumpa.')
            ->assertJsonPath('meta.partner.can_send', false);
    });

    it('offers reachable contacts to start a chat', function () {
        User::factory()->mentor()->inactive()->create(['name' => 'Mentor Nonaktif']);

        chat($this->rina, 'GET', '/api/chats/contacts')
            ->assertOk()
            ->assertJsonPath('data.*.name', ['Admin Sinta', 'Sari Wijaya']);

        chat($this->rina, 'GET', '/api/chats/contacts?q=SINTA')->assertJsonPath('data.*.name', ['Admin Sinta']);
    });
});

describe('isi percakapan', function () {
    it('returns messages oldest to newest and loads older ones on request', function () {
        foreach (range(1, 32) as $i) {
            message($i % 2 ? $this->rina : $this->sari, $i % 2 ? $this->sari : $this->rina, "Pesan {$i}", Carbon::parse('2026-10-12 08:00:00')->addMinutes($i)->toDateTimeString());
        }

        $latest = chat($this->rina, 'GET', "/api/chats/{$this->sari->id}/messages")
            ->assertOk()
            ->assertJsonCount(30, 'data')
            ->assertJsonPath('data.0.body', 'Pesan 3')
            ->assertJsonPath('data.29.body', 'Pesan 32')
            ->assertJsonPath('meta.has_more', true);

        chat($this->rina, 'GET', "/api/chats/{$this->sari->id}/messages?before_id=".$latest->json('data.0.id'))
            ->assertJsonPath('data.*.body', ['Pesan 1', 'Pesan 2'])
            ->assertJsonPath('meta.has_more', false);
    });

    it('marks the conversation read, clears the chat notification, and tells both sides', function () {
        Event::fake([ChatMessagesRead::class, NotificationsRead::class]);
        chat($this->sari, 'POST', "/api/chats/{$this->rina->id}/messages", ['body' => 'Satu.']);
        $last = message($this->sari, $this->rina, 'Dua.', '2026-10-12 10:00:00');
        message($this->admin, $this->rina, 'Dari admin.', '2026-10-12 10:00:00');

        chat($this->rina, 'POST', "/api/chats/{$this->sari->id}/read")
            ->assertOk()
            ->assertJsonPath('meta.unread_total', 1);

        expect(ChatMessage::query()->where('sender_id', $this->sari->id)->whereNull('read_at')->count())->toBe(0)
            ->and(Notification::query()->where('chat_sender_id', $this->sari->id)->value('read_at'))->not->toBeNull();

        Event::assertDispatched(ChatMessagesRead::class, fn (ChatMessagesRead $e): bool => $e->broadcastAs() === 'chat.read'
            && array_map(fn ($c) => $c->name, $e->broadcastOn()) === ["private-users.{$this->rina->id}", "private-users.{$this->sari->id}"]
            && $e->broadcastWith() === [
                'reader_id' => $this->rina->id,
                'partner_id' => $this->sari->id,
                'last_read_id' => $last->id,
                'read_at' => '2026-10-12T10:00:00+07:00',
            ]);
        Event::assertDispatched(NotificationsRead::class, fn (NotificationsRead $e): bool => $e->userId === $this->rina->id);

        chat($this->rina, 'POST', "/api/chats/{$this->sari->id}/read")->assertOk();
        Event::assertDispatchedTimes(ChatMessagesRead::class, 1);
    });
});

it('is available to every role', function (string $role) {
    chat(User::factory()->{$role}()->create(), 'GET', '/api/chats')->assertOk();
})->with(['intern', 'mentor', 'admin']);

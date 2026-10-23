<?php

use App\Events\NotificationsChanged;
use App\Events\NotificationSent;
use App\Events\NotificationsRead;
use App\Models\Notification;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->rina = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Rina Wulandari']);
});

function bell(User $user, string $method, string $uri): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, [], ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function bellItem(User $user, string $text, string $at, ?string $readAt = null): Notification
{
    $notification = Notification::query()->create(['user_id' => $user->id, 'text' => $text, 'link_path' => '/', 'read_at' => $readAt]);
    $notification->forceFill(['created_at' => $at])->saveQuietly();

    return $notification;
}

it('lists my notifications newest first, twenty at a time, with the unread count', function () {
    foreach (range(1, 21) as $i) {
        bellItem($this->rina, "Notifikasi {$i}.", Carbon::parse('2026-10-01 08:00:00')->addMinutes($i)->toDateTimeString(), $i <= 5 ? '2026-10-02 08:00:00' : null);
    }
    bellItem(User::factory()->mentor()->create(), 'Milik orang lain.', '2026-10-12 09:00:00');

    $first = bell($this->rina, 'GET', '/api/notifications')
        ->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('data.0.text', 'Notifikasi 21.')
        ->assertJsonPath('data.0.read_at', null)
        ->assertJsonPath('meta.unread_count', 16);

    bell($this->rina, 'GET', '/api/notifications?cursor='.$first->json('meta.next_cursor'))
        ->assertJsonPath('data.*.text', ['Notifikasi 1.'])
        ->assertJsonPath('meta.next_cursor', null);
});

it('marks one notification read and tells my other tabs', function () {
    Event::fake([NotificationsRead::class]);
    $item = bellItem($this->rina, 'Izin Sakit 13-14 Okt disetujui.', '2026-10-12 09:00:00');
    bellItem($this->rina, 'Lain.', '2026-10-12 09:30:00');

    bell($this->rina, 'POST', "/api/notifications/{$item->id}/read")
        ->assertOk()
        ->assertJsonPath('data.read_at', '2026-10-12T10:00:00+07:00')
        ->assertJsonPath('meta.unread_count', 1);

    Event::assertDispatchedTimes(NotificationsRead::class, 1);
    Event::assertDispatched(NotificationsRead::class, fn (NotificationsRead $e): bool => $e->userId === $this->rina->id
        && $e->ids === [$item->id]
        && $e->broadcastOn()->name === "private-users.{$this->rina->id}"
        && $e->broadcastWith() === ['ids' => [$item->id], 'unread_count' => 1]);

    // Sudah dibaca: tidak ada event lagi.
    bell($this->rina, 'POST', "/api/notifications/{$item->id}/read")->assertOk();
    Event::assertDispatchedTimes(NotificationsRead::class, 1);
});

it('hides notifications of other users', function () {
    $other = bellItem(User::factory()->mentor()->create(), 'Rahasia.', '2026-10-12 09:00:00');

    bell($this->rina, 'POST', "/api/notifications/{$other->id}/read")->assertNotFound();
    expect($other->refresh()->read_at)->toBeNull();
});

it('marks everything read', function () {
    Event::fake([NotificationsRead::class]);
    bellItem($this->rina, 'Satu.', '2026-10-12 09:00:00');
    bellItem($this->rina, 'Dua.', '2026-10-12 09:30:00');

    bell($this->rina, 'POST', '/api/notifications/read-all')->assertOk()->assertJsonPath('meta.unread_count', 0);

    expect(Notification::query()->unread()->count())->toBe(0);
    Event::assertDispatched(NotificationsRead::class, fn (NotificationsRead $e): bool => $e->ids === null);

    bell($this->rina, 'POST', '/api/notifications/read-all')->assertOk();
    Event::assertDispatchedTimes(NotificationsRead::class, 1);
});

it('broadcasts every new notification to its owner', function () {
    Event::fake([NotificationSent::class]);
    $mentor = User::factory()->mentor()->create();

    app(Notifier::class)->send([$this->rina->id, $mentor->id], 'Mentor Anda sekarang Bu Sari.', '/');

    Event::assertDispatchedTimes(NotificationSent::class, 2);
    Event::assertDispatched(NotificationSent::class, function (NotificationSent $e): bool {
        $payload = $e->broadcastWith();

        return $e->userId === $this->rina->id
            && $e->broadcastAs() === 'notification.sent'
            && $e->broadcastOn()->name === "private-users.{$this->rina->id}"
            && $payload['notification']['text'] === 'Mentor Anda sekarang Bu Sari.'
            && $payload['notification']['read_at'] === null
            && $payload['unread_count'] === 1;
    });
});

it('refreshes the bell of announcement recipients when the announcement changes', function () {
    Event::fake([NotificationsChanged::class, NotificationSent::class]);
    $admin = User::factory()->admin()->create();
    $mentor = User::factory()->mentor()->create();

    $id = bell($admin, 'POST', '/api/admin/announcements?'.http_build_query(['title' => 'Libur', 'body' => 'Isi.', 'for_intern' => 1, 'for_mentor' => 1]))->json('data.id');
    Event::assertDispatched(NotificationSent::class, fn (NotificationSent $e): bool => $e->userId === $this->rina->id);

    $recipients = Notification::query()->where('announcement_id', $id)->count();

    bell($admin, 'PUT', "/api/admin/announcements/{$id}?".http_build_query(['title' => 'Libur Nasional', 'body' => 'Isi.', 'for_intern' => 1, 'for_mentor' => 1]))->assertOk();
    Event::assertDispatched(NotificationsChanged::class, fn (NotificationsChanged $e): bool => $e->userId === $mentor->id);
    Event::assertDispatchedTimes(NotificationsChanged::class, $recipients);

    bell($admin, 'DELETE', "/api/admin/announcements/{$id}")->assertOk();
    Event::assertDispatchedTimes(NotificationsChanged::class, $recipients * 2);
});

it('is available to every role', function (string $role) {
    bell(User::factory()->{$role}()->create(), 'GET', '/api/notifications')->assertOk();
})->with(['intern', 'mentor', 'admin']);

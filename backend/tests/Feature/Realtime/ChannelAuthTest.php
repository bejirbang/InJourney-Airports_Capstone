<?php

use App\Models\User;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Testing\TestResponse;

// Test memakai broadcaster "null" yang tidak memeriksa channel. Di sini driver Reverb dipasang dengan kunci uji
// (tanpa server), lalu channel didaftarkan ulang agar otorisasi /api/broadcasting/auth benar-benar diperiksa.
beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => '1',
    ]);
    app(BroadcastManager::class)->forgetDrivers();
    require base_path('routes/channels.php');

    $this->rina = User::factory()->intern()->create(['name' => 'Rina Wulandari']);
    $this->sari = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
});

function subscribe(?User $user, string $channel): TestResponse
{
    app('auth')->forgetGuards();
    $headers = $user === null ? [] : ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];

    return test()->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => $channel], $headers);
}

it('lets users listen only to their own channel', function () {
    subscribe($this->rina, "private-users.{$this->rina->id}")->assertOk()->assertJsonStructure(['auth']);
    subscribe($this->rina, "private-users.{$this->sari->id}")->assertForbidden();
});

it('lets only the two people in a conversation share typing events', function () {
    [$low, $high] = [min($this->rina->id, $this->sari->id), max($this->rina->id, $this->sari->id)];
    $outsider = User::factory()->admin()->create();

    subscribe($this->rina, "private-chats.{$low}.{$high}")->assertOk();
    subscribe($this->sari, "private-chats.{$low}.{$high}")->assertOk();
    subscribe($outsider, "private-chats.{$low}.{$high}")->assertForbidden();
    subscribe($this->rina, "private-chats.{$high}.{$low}")->assertForbidden();
});

it('shares who is online with every signed-in user', function () {
    $response = subscribe($this->rina, 'presence-online')->assertOk();

    expect(json_decode($response->json('channel_data'), true))->toBe([
        'user_id' => (string) $this->rina->id,
        'user_info' => ['id' => $this->rina->id, 'name' => 'Rina Wulandari'],
    ]);
});

it('requires a valid session that may use the app', function () {
    subscribe(null, "private-users.{$this->rina->id}")->assertUnauthorized();

    $this->rina->update(['must_change_password' => true]);
    subscribe($this->rina, "private-users.{$this->rina->id}")->assertForbidden();

    $inactive = User::factory()->mentor()->inactive()->create();
    subscribe($inactive, "private-users.{$inactive->id}")->assertForbidden();
});

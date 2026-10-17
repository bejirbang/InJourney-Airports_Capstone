<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
});

function profileAuth(User $user): array
{
    return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
}

it('updates name and phone for every role', function (string $role) {
    $user = User::factory()->{$role}()->create(['name' => 'Sari', 'phone' => null]);

    $this->putJson('/api/auth/profile', ['name' => 'Sari Wijaya', 'phone' => '0812-3456-7890'], profileAuth($user))
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan.')
        ->assertJsonPath('data.name', 'Sari Wijaya')
        ->assertJsonPath('data.phone', '0812-3456-7890')
        ->assertJsonPath('data.role', $role);

    expect($user->fresh())->name->toBe('Sari Wijaya')->phone->toBe('0812-3456-7890');
})->with(['mentor', 'intern', 'admin']);

it('clears the phone number when it is sent empty', function () {
    $user = User::factory()->mentor()->create(['phone' => '0812-3456-7890']);

    $this->putJson('/api/auth/profile', ['name' => $user->name, 'phone' => ''], profileAuth($user))
        ->assertOk()
        ->assertJsonPath('data.phone', null);
});

it('ignores fields that only an admin may change', function () {
    $user = User::factory()->mentor()->create(['email' => 'mentor@injourney.test', 'title' => 'Mentor']);

    $this->putJson('/api/auth/profile', [
        'name' => 'Sari Wijaya',
        'email' => 'lain@injourney.test',
        'role' => 'admin',
        'title' => 'Kepala',
        'is_active' => false,
    ], profileAuth($user))->assertOk();

    expect($user->fresh())
        ->email->toBe('mentor@injourney.test')
        ->role->value->toBe('mentor')
        ->title->toBe('Mentor')
        ->is_active->toBeTrue();
});

it('validates the profile form', function (array $input, string $field, string $message) {
    $user = User::factory()->mentor()->create();

    $this->putJson('/api/auth/profile', $input, profileAuth($user))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'nama kosong' => [['name' => '   '], 'name', 'Nama wajib diisi.'],
    'nama tidak dikirim' => [['phone' => '0812'], 'name', 'Nama wajib diisi.'],
    'telepon berisi huruf' => [['name' => 'Sari', 'phone' => '0812abc'], 'phone', 'Format nomor telepon tidak valid.'],
    'telepon terlalu pendek' => [['name' => 'Sari', 'phone' => '0812'], 'phone', 'Format nomor telepon tidak valid.'],
]);

it('uploads a profile photo and returns a signed photo url', function () {
    $user = User::factory()->mentor()->create();

    $response = $this->post('/api/auth/profile/photo', [
        'photo' => UploadedFile::fake()->image('foto.jpg', 200, 200),
    ], profileAuth($user) + ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan.');

    $path = $user->fresh()->photo_path;
    expect($path)->toStartWith("profile-photos/{$user->id}/");
    Storage::assertExists($path);

    $url = $response->json('data.photo_url');
    expect($url)->toContain("/api/users/{$user->id}/photo")->toContain('signature=');

    // Alamat foto dibuka tanpa token, seperti <img src>.
    $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
});

it('replaces the old photo and deletes its file', function () {
    $user = User::factory()->mentor()->create();
    $headers = profileAuth($user) + ['Accept' => 'application/json'];

    $this->post('/api/auth/profile/photo', ['photo' => UploadedFile::fake()->image('lama.png')], $headers)->assertOk();
    $old = $user->fresh()->photo_path;

    $this->post('/api/auth/profile/photo', ['photo' => UploadedFile::fake()->image('baru.webp')], $headers)->assertOk();

    Storage::assertMissing($old);
    Storage::assertExists($user->fresh()->photo_path);
});

it('removes the photo', function () {
    $user = User::factory()->mentor()->create();
    $headers = profileAuth($user) + ['Accept' => 'application/json'];

    $this->post('/api/auth/profile/photo', ['photo' => UploadedFile::fake()->image('foto.jpg')], $headers)->assertOk();
    $path = $user->fresh()->photo_path;

    $this->deleteJson('/api/auth/profile/photo', [], $headers)
        ->assertOk()
        ->assertJsonPath('data.photo_url', null);

    Storage::assertMissing($path);
    expect($user->fresh()->photo_path)->toBeNull();
});

it('validates the photo', function (Closure $file, string $message) {
    $user = User::factory()->mentor()->create();

    $this->post('/api/auth/profile/photo', ['photo' => $file()], profileAuth($user) + ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['photo' => $message]);

    expect($user->fresh()->photo_path)->toBeNull();
})->with([
    'bukan gambar' => [fn () => UploadedFile::fake()->create('cv.pdf', 100, 'application/pdf'), 'Foto harus berupa gambar JPG, PNG, atau WebP.'],
    'svg' => [fn () => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'), 'Foto harus berupa gambar JPG, PNG, atau WebP.'],
    'lebih dari 2 MB' => [fn () => UploadedFile::fake()->image('foto.jpg')->size(2049), 'Ukuran foto maksimal 2 MB.'],
    'tidak ada file' => [fn () => null, 'Pilih foto lebih dulu.'],
]);

it('returns a null photo url when there is no photo', function () {
    $user = User::factory()->mentor()->create();

    $this->getJson('/api/auth/me', profileAuth($user))->assertOk()->assertJsonPath('data.photo_url', null);
});

it('rejects a photo url without a valid signature', function () {
    $user = User::factory()->mentor()->create(['photo_path' => 'profile-photos/1/foto.jpg']);
    Storage::put('profile-photos/1/foto.jpg', 'x');

    $this->get("/api/users/{$user->id}/photo")->assertForbidden();
    $this->get($user->photoUrl().'x')->assertForbidden();
});

it('blocks profile changes until the temporary password is changed', function () {
    $user = User::factory()->mentor()->mustChangePassword()->create();

    $this->putJson('/api/auth/profile', ['name' => 'Sari'], profileAuth($user))
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});

it('rejects profile changes without a token', function () {
    $this->putJson('/api/auth/profile', ['name' => 'Sari'])->assertUnauthorized();
});

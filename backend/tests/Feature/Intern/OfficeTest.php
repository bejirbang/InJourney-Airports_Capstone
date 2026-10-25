<?php

use App\Models\Office;
use App\Models\User;

beforeEach(function () {
    $this->intern = User::factory()->intern()->create();
});

function officeList(User $user)
{
    return test()->getJson('/api/intern/offices', [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ]);
}

it('returns active offices with coordinates and both radii for the intern', function () {
    $office = Office::factory()->for($this->intern->internProfile->airport)->create(['name' => 'Kantor Pusat Terminal 3']);

    $data = officeList($this->intern)->assertOk()->json('data');

    expect($data)->toHaveCount(1)
        ->and($data[0]['id'])->toBe($office->id)
        ->and($data[0]['name'])->toBe('Kantor Pusat Terminal 3')
        ->and((float) $data[0]['latitude'])->toEqualWithDelta(-6.1256, 0.00001)
        ->and((float) $data[0]['longitude'])->toEqualWithDelta(106.6559, 0.00001)
        ->and($data[0]['clock_in_radius_meters'])->toBe(100)
        ->and($data[0]['clock_out_radius_meters'])->toBe(300);
});

it('excludes inactive offices', function () {
    Office::factory()->for($this->intern->internProfile->airport)->create(['name' => 'Kantor Aktif']);
    Office::factory()->for($this->intern->internProfile->airport)->inactive()->create(['name' => 'Kantor Tutup']);
    Office::factory()->create(['name' => 'Bandara Lain']);

    $names = array_column(officeList($this->intern)->assertOk()->json('data'), 'name');

    expect($names)->toBe(['Kantor Aktif']);
});

it('rejects mentors and admins', function () {
    Office::factory()->create();

    officeList(User::factory()->mentor()->create())->assertForbidden();
    officeList(User::factory()->admin()->create())->assertForbidden();
});

it('rejects requests without a token', function () {
    test()->getJson('/api/intern/offices')->assertUnauthorized();
});

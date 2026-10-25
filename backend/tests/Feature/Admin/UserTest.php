<?php

use App\Enums\RequestStatus;
use App\Exceptions\ActionRejected;
use App\Models\Airport;
use App\Models\AttendanceCorrection;
use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\MentorHistory;
use App\Models\Notification;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccountManagement;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Dedi Admin', 'email' => 'dedi@injourney.test']);
    $this->unit = Unit::factory()->create(['name' => 'Divisi IT']);
    $this->airport = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya', 'email' => 'sari@injourney.test', 'unit_id' => $this->unit->id]);
});

function asAdmin(User $admin, string $method, string $uri, array $data = []): TestResponse
{
    // Guard menyimpan user dari request sebelumnya; lupakan agar token akun ini yang dipakai.
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken]);
}

function internUnder(User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, ...$attributes]);
}

function newIntern(array $overrides = []): array
{
    return [
        'name' => 'Rina Wulandari',
        'email' => 'rina@injourney.test',
        'role' => 'intern',
        'unit_id' => test()->unit->id,
        'mentor_id' => test()->mentor->id,
        'airport_id' => test()->airport->id,
        'university' => 'Universitas Indonesia',
        'major' => 'Teknik Informatika',
        'start_date' => '2026-10-15',
        'end_date' => '2027-01-15',
        ...$overrides,
    ];
}

describe('daftar pengguna', function () {
    it('shows active accounts by default, sorted by name, including interns who have not started', function () {
        $andi = internUnder($this->mentor, 'Andi Pratama', ['airport_id' => $this->airport->id], ['email' => 'andi@injourney.test', 'unit_id' => $this->unit->id]);
        internUnder($this->mentor, 'Belum Mulai', ['start_date' => '2026-10-20']);
        internUnder($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);
        internUnder($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);
        User::factory()->mentor()->inactive()->create(['name' => 'Mentor Nonaktif']);

        asAdmin($this->admin, 'GET', '/api/admin/users')
            ->assertOk()
            ->assertJsonPath('data.*.name', ['Andi Pratama', 'Belum Mulai', 'Dedi Admin', 'Sari Wijaya'])
            ->assertJsonPath('data.0', [
                'id' => $andi->id,
                'name' => 'Andi Pratama',
                'email' => 'andi@injourney.test',
                'role' => 'intern',
                'unit' => ['id' => $this->unit->id, 'name' => 'Divisi IT'],
                'status' => 'active',
                'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
                'airport' => ['id' => $this->airport->id, 'name' => 'Soekarno-Hatta'],
                'university' => 'Universitas Indonesia',
                'major' => 'Teknik Informatika',
                'start_date' => '2026-09-01',
                'end_date' => '2026-12-31',
            ])
            ->assertJsonPath('data.1.status', 'not_started')
            ->assertJsonPath('data.2.mentor', null)
            ->assertJsonPath('data.2.unit', null)
            ->assertJsonPath('data.2.airport', null)
            ->assertJsonPath('data.2.start_date', null)
            ->assertJsonPath('meta', ['current_page' => 1, 'last_page' => 1, 'per_page' => 10, 'total' => 4]);
    });

    it('filters inactive accounts, including interns whose internship has ended', function () {
        internUnder($this->mentor, 'Andi Pratama');
        internUnder($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);
        internUnder($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);

        asAdmin($this->admin, 'GET', '/api/admin/users?status=inactive')
            ->assertOk()
            ->assertJsonPath('data.*.name', ['Dinonaktifkan', 'Sudah Selesai'])
            ->assertJsonPath('data.*.status', ['inactive', 'inactive']);

        asAdmin($this->admin, 'GET', '/api/admin/users?status=all')
            ->assertJsonPath('meta.total', 5);
    });

    it('searches by name or email without case and filters by role', function () {
        internUnder($this->mentor, 'Andi Pratama', attributes: ['email' => 'andi.p@injourney.test']);
        internUnder($this->mentor, 'Budi Kurniawan', attributes: ['email' => 'budi@injourney.test']);

        asAdmin($this->admin, 'GET', '/api/admin/users?q=ANDI')->assertJsonPath('data.*.name', ['Andi Pratama']);
        asAdmin($this->admin, 'GET', '/api/admin/users?q=budi@')->assertJsonPath('data.*.name', ['Budi Kurniawan']);
        asAdmin($this->admin, 'GET', '/api/admin/users?role=mentor')->assertJsonPath('data.*.name', ['Sari Wijaya']);
    });

    it('pages ten accounts at a time', function () {
        foreach (range(1, 10) as $i) {
            internUnder($this->mentor, sprintf('Intern %02d', $i));
        }

        asAdmin($this->admin, 'GET', '/api/admin/users?page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta', ['current_page' => 2, 'last_page' => 2, 'per_page' => 10, 'total' => 12]);
    });

    it('rejects an unknown filter', function () {
        asAdmin($this->admin, 'GET', '/api/admin/users?status=deleted')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'Filter pengguna tidak valid.']);
    });

    it('lists only active mentors as choices', function () {
        User::factory()->mentor()->inactive()->create(['name' => 'Mentor Nonaktif']);
        $ops = Unit::factory()->create(['name' => 'Operasional Bandara']);
        $budi = User::factory()->mentor()->create(['name' => 'Budi Santoso', 'unit_id' => $ops->id]);

        asAdmin($this->admin, 'GET', '/api/admin/mentors')
            ->assertOk()
            ->assertExactJson(['data' => [
                ['id' => $budi->id, 'name' => 'Budi Santoso', 'unit' => ['id' => $ops->id, 'name' => 'Operasional Bandara']],
                ['id' => $this->mentor->id, 'name' => 'Sari Wijaya', 'unit' => ['id' => $this->unit->id, 'name' => 'Divisi IT']],
            ]]);
    });
});

describe('tambah akun', function () {
    it('creates an intern with a one-time temporary password that must be changed', function () {
        $response = asAdmin($this->admin, 'POST', '/api/admin/users', newIntern(['email' => '  Rina@InJourney.test ']))
            ->assertCreated()
            ->assertJsonPath('data.name', 'Rina Wulandari')
            ->assertJsonPath('data.email', 'rina@injourney.test')
            ->assertJsonPath('data.role', 'intern')
            ->assertJsonPath('data.status', 'not_started')
            ->assertJsonPath('data.mentor', ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'])
            ->assertJsonPath('data.unit', ['id' => $this->unit->id, 'name' => 'Divisi IT'])
            ->assertJsonPath('data.airport', ['id' => $this->airport->id, 'name' => 'Soekarno-Hatta'])
            ->assertJsonPath('data.university', 'Universitas Indonesia')
            ->assertJsonPath('data.major', 'Teknik Informatika')
            ->assertJsonPath('data.start_date', '2026-10-15')
            ->assertJsonPath('data.end_date', '2027-01-15')
            ->assertJsonPath('data.must_change_password', true)
            ->assertJsonPath('data.former_mentors', []);

        $intern = User::query()->where('email', 'rina@injourney.test')->sole();
        $history = MentorHistory::query()->where('intern_id', $intern->id)->sole();

        expect($intern->internProfile->leave_quota_since->toDateString())->toBe('2026-10-15');

        expect($history->mentor_id)->toBe($this->mentor->id)
            ->and($history->started_at->toDateString())->toBe('2026-10-15')
            ->and($history->ended_at)->toBeNull();

        $log = AuditLog::sole();
        expect($log->admin_id)->toBe($this->admin->id)
            ->and($log->object)->toBe('Rina Wulandari')
            ->and($log->detail)->toBe('Tambah akun Intern.');

        $this->travelTo(Carbon::parse('2026-10-15 08:00:00'));
        $this->postJson('/api/auth/login', ['email' => 'rina@injourney.test', 'password' => $response->json('temporary_password')])
            ->assertOk()
            ->assertJsonPath('user.must_change_password', true);
    });

    it('creates a mentor with a unit and ignores intern fields', function () {
        asAdmin($this->admin, 'POST', '/api/admin/users', [
            'name' => 'Budi Santoso',
            'email' => 'budi@injourney.test',
            'role' => 'mentor',
            'unit_id' => $this->unit->id,
            'mentor_id' => $this->mentor->id,
            'airport_id' => $this->airport->id,
            'start_date' => '2026-10-15',
        ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'mentor')
            ->assertJsonPath('data.unit.id', $this->unit->id)
            ->assertJsonPath('data.airport', null)
            ->assertJsonPath('data.mentor', null)
            ->assertJsonPath('data.interns', []);

        $mentor = User::query()->where('email', 'budi@injourney.test')->sole();
        expect($mentor->internProfile)->toBeNull()
            ->and(AuditLog::sole()->detail)->toBe('Tambah akun Mentor.');
    });

    it('validates the form with the prototype messages', function (array $input, string $field, string $message) {
        User::factory()->mentor()->inactive()->create(['id' => 999]);
        Unit::factory()->inactive()->create(['id' => 777]);
        Airport::factory()->inactive()->create(['id' => 888]);

        asAdmin($this->admin, 'POST', '/api/admin/users', newIntern($input))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);

        expect(User::query()->where('email', 'rina@injourney.test')->exists())->toBeFalse();
    })->with([
        'nama kosong' => [['name' => '  '], 'name', 'Nama wajib diisi.'],
        'email kosong' => [['email' => ''], 'email', 'Email wajib diisi.'],
        'email salah' => [['email' => 'rina@'], 'email', 'Format email tidak valid.'],
        'email terpakai' => [['email' => 'SARI@injourney.test'], 'email', 'Email sudah terdaftar.'],
        'tanpa mentor' => [['mentor_id' => null], 'mentor_id', 'Pilih mentor untuk intern ini.'],
        'mentor nonaktif' => [['mentor_id' => 999], 'mentor_id', 'Pilih mentor untuk intern ini.'],
        'bukan mentor' => [['mentor_id' => 1], 'mentor_id', 'Pilih mentor untuk intern ini.'],
        'tanpa tanggal' => [['start_date' => null], 'start_date', 'Tanggal selesai harus sesudah tanggal mulai.'],
        'selesai sebelum mulai' => [['end_date' => '2026-10-14'], 'end_date', 'Tanggal selesai harus sesudah tanggal mulai.'],
        'role salah' => [['role' => 'superadmin'], 'role', 'Pilih role akun.'],
        'tanpa unit' => [['unit_id' => null], 'unit_id', 'Pilih unit.'],
        'unit nonaktif' => [['unit_id' => 777], 'unit_id', 'Pilih unit.'],
        'tanpa lokasi magang' => [['airport_id' => null], 'airport_id', 'Pilih lokasi magang.'],
        'bandara nonaktif' => [['airport_id' => 888], 'airport_id', 'Pilih lokasi magang.'],
        'tanpa universitas' => [['university' => ' '], 'university', 'Asal universitas wajib diisi.'],
        'tanpa jurusan' => [['major' => null], 'major', 'Jurusan wajib diisi.'],
    ]);

    it('creates an admin without a unit', function () {
        asAdmin($this->admin, 'POST', '/api/admin/users', [
            'name' => 'Admin Baru', 'email' => 'admin.baru@injourney.test', 'role' => 'admin', 'unit_id' => $this->unit->id,
        ])
            ->assertCreated()
            ->assertJsonPath('data.unit', null);
    });

    it('accepts an internship that ends on its start date', function () {
        asAdmin($this->admin, 'POST', '/api/admin/users', newIntern(['end_date' => '2026-10-15']))
            ->assertCreated()
            ->assertJsonPath('data.end_date', '2026-10-15');
    });

    it('lets a new account reuse the email of a deleted account', function () {
        User::factory()->create(['email' => 'rina@injourney.test'])->delete();

        asAdmin($this->admin, 'POST', '/api/admin/users', newIntern())->assertCreated();
    });
});

describe('detail dan ubah data', function () {
    it('shows an intern profile with former mentors', function () {
        $budi = User::factory()->mentor()->create(['name' => 'Budi Santoso']);
        $intern = internUnder($this->mentor, 'Andi Pratama', attributes: ['phone' => '0812-3456-7890']);
        MentorHistory::query()->create(['intern_id' => $intern->id, 'mentor_id' => $budi->id, 'started_at' => '2026-09-01', 'ended_at' => '2026-09-30']);
        MentorHistory::query()->create(['intern_id' => $intern->id, 'mentor_id' => $this->mentor->id, 'started_at' => '2026-09-30']);

        asAdmin($this->admin, 'GET', "/api/admin/users/{$intern->id}")
            ->assertOk()
            ->assertJsonPath('data.phone', '0812-3456-7890')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.mentor.name', 'Sari Wijaya')
            ->assertJsonPath('data.former_mentors', [['id' => $budi->id, 'name' => 'Budi Santoso']]);
    });

    it('shows the current interns of a mentor', function () {
        $andi = internUnder($this->mentor, 'Andi Pratama');
        $ended = internUnder($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);

        asAdmin($this->admin, 'GET', "/api/admin/users/{$this->mentor->id}")
            ->assertOk()
            ->assertJsonPath('data.interns', [
                ['id' => $andi->id, 'name' => 'Andi Pratama', 'status' => 'active'],
                ['id' => $ended->id, 'name' => 'Sudah Selesai', 'status' => 'inactive'],
            ]);
    });

    it('updates name, email, unit, airport, campus, and internship period but never role or mentor', function () {
        $intern = internUnder($this->mentor, 'Andi Pratama', attributes: ['email' => 'andi@injourney.test']);
        $budi = User::factory()->mentor()->create();
        $halim = Airport::factory()->create(['name' => 'Halim Perdanakusuma']);

        asAdmin($this->admin, 'PUT', "/api/admin/users/{$intern->id}", [
            'name' => 'Andi Pratama Putra',
            'email' => 'andi.putra@injourney.test',
            'unit_id' => $this->unit->id,
            'airport_id' => $halim->id,
            'university' => 'Universitas Gadjah Mada',
            'major' => 'Ilmu Komputer',
            'role' => 'admin',
            'mentor_id' => $budi->id,
            'start_date' => '2026-09-01',
            'end_date' => '2027-01-31',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan.')
            ->assertJsonPath('data.name', 'Andi Pratama Putra')
            ->assertJsonPath('data.email', 'andi.putra@injourney.test')
            ->assertJsonPath('data.unit.id', $this->unit->id)
            ->assertJsonPath('data.airport', ['id' => $halim->id, 'name' => 'Halim Perdanakusuma'])
            ->assertJsonPath('data.university', 'Universitas Gadjah Mada')
            ->assertJsonPath('data.major', 'Ilmu Komputer')
            ->assertJsonPath('data.role', 'intern')
            ->assertJsonPath('data.mentor.id', $this->mentor->id)
            ->assertJsonPath('data.end_date', '2027-01-31');

        expect(AuditLog::sole()->detail)->toBe('Ubah data akun.');
    });

    it('allows the same email and keeps a unit that was deactivated later', function () {
        $this->unit->update(['is_active' => false]);

        asAdmin($this->admin, 'PUT', "/api/admin/users/{$this->mentor->id}", [
            'name' => 'Sari W.',
            'email' => 'sari@injourney.test',
            'unit_id' => $this->unit->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.unit.id', $this->unit->id);
    });

    it('rejects moving an account to an inactive unit', function () {
        $closed = Unit::factory()->inactive()->create();

        asAdmin($this->admin, 'PUT', "/api/admin/users/{$this->mentor->id}", [
            'name' => 'Sari W.', 'email' => 'sari@injourney.test', 'unit_id' => $closed->id,
        ])
            ->assertJsonValidationErrors(['unit_id' => 'Pilih unit.']);
    });

    it('moves the leave quota start along with the start date until the internship is extended', function () {
        $intern = internUnder($this->mentor, 'Andi Pratama', ['start_date' => '2026-10-20']);

        asAdmin($this->admin, 'PUT', "/api/admin/users/{$intern->id}", [
            'name' => 'Andi Pratama', 'email' => $intern->email, 'unit_id' => $intern->unit_id,
            'airport_id' => $intern->internProfile->airport_id, 'university' => 'UI', 'major' => 'TI',
            'start_date' => '2026-10-19', 'end_date' => '2026-12-31',
        ])->assertOk();

        expect($intern->internProfile->refresh()->leave_quota_since->toDateString())->toBe('2026-10-19');
    });

    it('rejects an email used by another account and an invalid period', function () {
        $intern = internUnder($this->mentor, 'Andi Pratama');

        asAdmin($this->admin, 'PUT', "/api/admin/users/{$intern->id}", [
            'name' => 'Andi', 'email' => 'sari@injourney.test', 'start_date' => '2026-09-01', 'end_date' => '2026-08-31',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'Email sudah terdaftar.', 'end_date' => 'Tanggal selesai harus sesudah tanggal mulai.']);
    });
});

describe('ganti mentor', function () {
    beforeEach(function () {
        $this->intern = internUnder($this->mentor, 'Andi Pratama');
        $this->budi = User::factory()->mentor()->create(['name' => 'Budi Santoso']);
        MentorHistory::query()->create(['intern_id' => $this->intern->id, 'mentor_id' => $this->mentor->id, 'started_at' => '2026-09-01']);

        $this->waiting = AttendanceCorrection::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-08']);
        $this->forwarded = AttendanceCorrection::factory()->for($this->intern, 'intern')->pendingAdmin()->create(['date' => '2026-10-09']);
        LeaveRequest::factory()->for($this->intern, 'intern')->create(['status' => RequestStatus::Pending]);
        LeaveRequest::factory()->for($this->intern, 'intern')->approved()->create(['start_date' => '2026-10-01', 'end_date' => '2026-10-01']);
    });

    it('previews what will move to the new mentor', function () {
        asAdmin($this->admin, 'GET', "/api/admin/users/{$this->intern->id}/mentor-change")
            ->assertOk()
            ->assertExactJson(['data' => [
                'current_mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
                'pending_corrections' => 1,
                'pending_leaves' => 1,
            ]]);
    });

    it('moves corrections waiting for the mentor and pending leaves, keeps history, notifies, and logs', function () {
        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->intern->id}/mentor", ['mentor_id' => $this->budi->id])
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan. Mentor baru dan intern sudah diberi tahu.')
            ->assertJsonPath('data.mentor', ['id' => $this->budi->id, 'name' => 'Budi Santoso'])
            ->assertJsonPath('data.former_mentors', [['id' => $this->mentor->id, 'name' => 'Sari Wijaya']]);

        expect($this->waiting->refresh()->mentor_id)->toBe($this->budi->id)
            ->and($this->forwarded->refresh()->mentor_id)->toBe($this->mentor->id);

        $histories = MentorHistory::query()->where('intern_id', $this->intern->id)->orderBy('id')->get();
        expect($histories)->toHaveCount(2)
            ->and($histories[0]->mentor_id)->toBe($this->mentor->id)
            ->and($histories[0]->ended_at?->toDateString())->toBe('2026-10-12')
            ->and($histories[1]->mentor_id)->toBe($this->budi->id)
            ->and($histories[1]->started_at->toDateString())->toBe('2026-10-12')
            ->and($histories[1]->ended_at)->toBeNull();

        expect(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path'])->toArray())->toBe([
            ['user_id' => $this->intern->id, 'text' => 'Mentor Anda sekarang Budi Santoso.', 'link_path' => '/'],
            ['user_id' => $this->budi->id, 'text' => 'Intern Andi Pratama kini menjadi bimbingan Anda.', 'link_path' => '/intern-saya'],
            ['user_id' => $this->mentor->id, 'text' => 'Intern Andi Pratama tidak lagi menjadi bimbingan Anda.', 'link_path' => '/intern-saya'],
        ]);

        expect(AuditLog::sole()->detail)->toBe('Ganti mentor dari Sari Wijaya ke Budi Santoso.');

        // Koreksi yang menunggu mentor dan izin pending ikut pindah ke mentor baru.
        asAdmin($this->budi, 'GET', '/api/mentor/menu')->assertJsonPath('data.2.badge', 1)->assertJsonPath('data.3.badge', 1);
        asAdmin($this->mentor, 'GET', '/api/mentor/menu')->assertJsonPath('data.2.badge', 0)->assertJsonPath('data.3.badge', 0);
        asAdmin($this->mentor, 'GET', "/api/mentor/interns/{$this->intern->id}")->assertOk();
    });

    it('records the old mentor when an intern has no mentor history yet', function () {
        MentorHistory::query()->delete();

        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->intern->id}/mentor", ['mentor_id' => $this->budi->id])->assertOk();

        $old = MentorHistory::query()->where('mentor_id', $this->mentor->id)->sole();
        expect($old->started_at->toDateString())->toBe('2026-09-01')
            ->and($old->ended_at?->toDateString())->toBe('2026-10-12');

        asAdmin($this->mentor, 'GET', "/api/mentor/interns/{$this->intern->id}")->assertOk();
    });

    it('rejects the current mentor, an inactive mentor, and a non-intern account', function () {
        $inactive = User::factory()->mentor()->inactive()->create();

        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->intern->id}/mentor", ['mentor_id' => $this->mentor->id])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'same_mentor')
            ->assertJsonPath('message', 'Pilih mentor baru.');

        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->intern->id}/mentor", ['mentor_id' => $inactive->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['mentor_id' => 'Pilih mentor baru.']);

        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->budi->id}/mentor", ['mentor_id' => $this->mentor->id])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'not_intern');

        expect($this->waiting->refresh()->mentor_id)->toBe($this->mentor->id)
            ->and(AuditLog::query()->count())->toBe(0);
    });
});

describe('nonaktifkan dan aktifkan', function () {
    it('deactivates an account, ends its sessions, and logs it', function () {
        $intern = internUnder($this->mentor, 'Andi Pratama');
        $intern->createToken('api');

        asAdmin($this->admin, 'POST', "/api/admin/users/{$intern->id}/deactivate")
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.is_active', false);

        expect($intern->tokens()->count())->toBe(0)
            ->and(AuditLog::sole()->detail)->toBe('Nonaktifkan akun.');
    });

    it('rejects deactivating your own account', function () {
        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->admin->id}/deactivate")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'self')
            ->assertJsonPath('message', 'Anda tidak bisa menonaktifkan akun Anda sendiri.');

        expect($this->admin->refresh()->is_active)->toBeTrue();
    });

    it('lets an admin deactivate another admin while one stays active', function () {
        $other = User::factory()->admin()->create();

        asAdmin($this->admin, 'POST', "/api/admin/users/{$other->id}/deactivate")->assertOk();

        expect($other->refresh()->is_active)->toBeFalse();
    });

    it('keeps at least one active admin when two admins deactivate each other at once', function () {
        $other = User::factory()->admin()->create();

        // Permintaan pertama sudah selesai; permintaan kedua dari admin yang baru dinonaktifkan
        // sudah lolos middleware sebelumnya, jadi diuji langsung lewat service.
        app(AccountManagement::class)->deactivate($this->admin, $other, now());

        expect(fn () => app(AccountManagement::class)->deactivate($other, $this->admin, now()))
            ->toThrow(ActionRejected::class, 'Minimal harus ada satu admin aktif.');

        expect($this->admin->refresh()->is_active)->toBeTrue();
    });

    it('blocks deactivating a mentor who still has active or upcoming interns', function () {
        internUnder($this->mentor, 'Belum Mulai', ['start_date' => '2026-11-01']);

        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->mentor->id}/deactivate")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'mentor_has_interns')
            ->assertJsonPath('message', 'Mentor ini masih memiliki intern aktif. Pindahkan intern ke mentor lain lebih dulu.');
    });

    it('lets a mentor whose interns have all ended or been deactivated be deactivated', function () {
        internUnder($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);
        internUnder($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);

        asAdmin($this->admin, 'POST', "/api/admin/users/{$this->mentor->id}/deactivate")->assertOk();
    });

    it('rejects deactivating an account that is already inactive', function () {
        $intern = internUnder($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);

        asAdmin($this->admin, 'POST', "/api/admin/users/{$intern->id}/deactivate")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'already_inactive');
    });

    it('activates an account again and logs it', function () {
        $intern = internUnder($this->mentor, 'Andi Pratama', attributes: ['is_active' => false]);

        asAdmin($this->admin, 'POST', "/api/admin/users/{$intern->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        expect(AuditLog::sole()->detail)->toBe('Aktifkan akun.');

        asAdmin($this->admin, 'POST', "/api/admin/users/{$intern->id}/activate")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'already_active');
    });

    it('asks to extend the end date to activate an intern whose internship has ended', function () {
        $intern = internUnder($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11'], ['is_active' => false]);

        asAdmin($this->admin, 'POST', "/api/admin/users/{$intern->id}/activate")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'internship_ended')
            ->assertJsonPath('message', 'Aktifkan kembali intern dengan memperbarui tanggal selesai magang.');

        expect($intern->refresh()->is_active)->toBeFalse();
    });
});

it('rejects interns and mentors from account management', function (string $role, string $method, string $uri) {
    $actor = User::factory()->{$role}()->create();

    asAdmin($actor, $method, $uri)
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['intern', 'mentor'])->with([
    ['GET', '/api/admin/users'],
    ['POST', '/api/admin/users'],
    ['GET', '/api/admin/mentors'],
    ['PUT', '/api/admin/users/1'],
    ['POST', '/api/admin/users/1/deactivate'],
]);

it('returns 404 for a deleted account', function () {
    $gone = internUnder($this->mentor, 'Sudah Dihapus');
    $gone->delete();

    asAdmin($this->admin, 'GET', "/api/admin/users/{$gone->id}")->assertNotFound();
});

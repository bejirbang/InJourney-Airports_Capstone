<?php

use App\Models\Airport;
use App\Models\AirportSpecialSchedule;
use App\Models\AirportWeeklySchedule;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;
use App\Services\WorkSchedules;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
});

function airportRequest(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function weekDays(string $start = '08:00', string $end = '17:00'): array
{
    return array_map(fn (int $day): array => [
        'day_of_week' => $day,
        'is_workday' => $day <= 5,
        'start_time' => $day <= 5 ? $start : null,
        'end_time' => $day <= 5 ? $end : null,
    ], range(1, 7));
}

describe('bandara', function () {
    it('lists airports with active points, active interns, and the weekly schedule in force', function () {
        Office::factory()->for($this->soetta)->count(2)->create();
        Office::factory()->for($this->soetta)->create(['is_active' => false]);
        User::factory()->intern(['airport_id' => $this->soetta->id])->create();
        User::factory()->intern(['airport_id' => $this->soetta->id, 'end_date' => '2026-10-01', 'start_date' => '2026-07-01'])->create();
        $halim = Airport::factory()->inactive()->create(['name' => 'Halim Perdanakusuma']);

        airportRequest($this->admin, 'GET', '/api/admin/airports')
            ->assertOk()
            ->assertJsonPath('data.*.name', ['Halim Perdanakusuma', 'Soekarno-Hatta'])
            ->assertJsonPath('data.0.id', $halim->id)
            ->assertJsonPath('data.0.is_active', false)
            ->assertJsonPath('data.1.active_offices', 2)
            ->assertJsonPath('data.1.active_interns', 1)
            ->assertJsonPath('data.1.weekly_schedule.effective_from', '2020-01-01')
            ->assertJsonPath('data.1.weekly_schedule.summary', 'Sen-Jum 08:00-17:00, Sab-Min libur');
    });

    it('creates an airport together with its first weekly schedule and logs it', function () {
        $response = airportRequest($this->admin, 'POST', '/api/admin/airports', [
            'name' => ' Kualanamu ',
            'effective_from' => '2026-10-12',
            'days' => weekDays('07:30', '16:30'),
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Kualanamu')
            ->assertJsonPath('data.offices', [])
            ->assertJsonPath('data.weekly_schedule.summary', 'Sen-Jum 07:30-16:30, Sab-Min libur');

        $airport = Airport::query()->findOrFail($response->json('data.id'));

        expect(app(WorkSchedules::class)->forDate($airport->id, '2026-10-12')->hours())->toBe(['start' => '07:30', 'end' => '16:30'])
            ->and(AuditLog::sole()->only(['action', 'object', 'detail']))->toBe([
                'action' => 'Lokasi & Jadwal',
                'object' => 'Kualanamu',
                'detail' => 'Tambah bandara. Jadwal mingguan mulai 12 Okt 2026: Sen-Jum 07:30-16:30, Sab-Min libur.',
            ]);
    });

    it('validates the new airport', function (Closure $payload, string $field, string $message) {
        airportRequest($this->admin, 'POST', '/api/admin/airports', $payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);
    })->with([
        'nama kosong' => [fn () => ['name' => ' ', 'effective_from' => '2026-10-12', 'days' => weekDays()], 'name', 'Nama bandara wajib diisi.'],
        'nama dipakai' => [fn () => ['name' => 'soekarno-hatta', 'effective_from' => '2026-10-12', 'days' => weekDays()], 'name', 'Nama bandara sudah dipakai.'],
        'tanggal lampau' => [fn () => ['name' => 'Baru', 'effective_from' => '2026-10-11', 'days' => weekDays()], 'effective_from', 'Tanggal berlaku tidak boleh di masa lalu.'],
        'kurang dari 7 hari' => [fn () => ['name' => 'Baru', 'effective_from' => '2026-10-12', 'days' => array_slice(weekDays(), 0, 5)], 'days', 'Isi jadwal untuk ketujuh hari.'],
        'jam kosong' => [fn () => ['name' => 'Baru', 'effective_from' => '2026-10-12', 'days' => array_replace(weekDays(), [0 => ['day_of_week' => 1, 'is_workday' => true, 'start_time' => null, 'end_time' => null]])], 'days.0.start_time', 'Hari kerja wajib punya jam masuk dan jam pulang.'],
        'pulang sebelum masuk' => [fn () => ['name' => 'Baru', 'effective_from' => '2026-10-12', 'days' => weekDays('17:00', '08:00')], 'days.0.end_time', 'Jam pulang harus setelah jam masuk.'],
    ]);

    it('renames an airport', function () {
        airportRequest($this->admin, 'PUT', "/api/admin/airports/{$this->soetta->id}", ['name' => 'Soetta'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Soetta');

        expect(AuditLog::sole()->detail)->toBe('Ubah nama bandara dari "Soekarno-Hatta".');
    });

    it('cannot deactivate an airport that still hosts active or upcoming interns', function () {
        $intern = User::factory()->intern(['airport_id' => $this->soetta->id, 'start_date' => '2026-11-01', 'end_date' => '2027-01-31'])->create();

        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/deactivate")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'has_active_interns');

        $intern->update(['is_active' => false]);

        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/deactivate")
            ->assertOk()
            ->assertJsonPath('data.is_active', false);
        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/deactivate")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Bandara ini sudah nonaktif.');
        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/activate")->assertOk();
    });

    it('rejects a new account at an inactive airport', function () {
        $this->soetta->update(['is_active' => false]);

        airportRequest($this->admin, 'POST', '/api/admin/users', [
            'name' => 'Rizki', 'email' => 'rizki@injourney.test', 'role' => 'intern',
            'unit_id' => User::factory()->mentor()->create()->unit_id,
            'mentor_id' => User::factory()->mentor()->create()->id,
            'airport_id' => $this->soetta->id, 'university' => 'UI', 'major' => 'SI',
            'start_date' => '2026-10-12', 'end_date' => '2026-12-31',
        ])->assertUnprocessable()->assertJsonValidationErrors(['airport_id']);
    });

    it('lists points of one airport only', function () {
        $point = Office::factory()->for($this->soetta)->create();
        Office::factory()->create();

        airportRequest($this->admin, 'GET', "/api/admin/offices?airport_id={$this->soetta->id}")->assertJsonPath('data.*.id', [$point->id]);
    });
});

describe('jadwal mingguan', function () {
    it('changes selected days from a future date, copying the other days, without touching earlier days', function () {
        airportRequest($this->admin, 'PUT', "/api/admin/airports/{$this->soetta->id}/weekly-schedule", [
            'effective_from' => '2026-11-02',
            'days' => [['day_of_week' => 5, 'is_workday' => true, 'start_time' => '08:30', 'end_time' => '16:00']],
        ])
            ->assertOk()
            ->assertJsonPath('data.effective_from', '2026-11-02')
            ->assertJsonPath('data.summary', 'Sen-Kam 08:00-17:00, Jum 08:30-16:00, Sab-Min libur');

        $schedules = app(WorkSchedules::class);
        expect($schedules->forDate($this->soetta->id, '2026-10-30')->hours())->toBe(['start' => '08:00', 'end' => '17:00'])
            ->and($schedules->forDate($this->soetta->id, '2026-11-06')->hours())->toBe(['start' => '08:30', 'end' => '16:00'])
            ->and(AuditLog::sole()->detail)->toBe('Ubah jadwal mingguan mulai 2 Nov 2026: Sen-Kam 08:00-17:00, Jum 08:30-16:00, Sab-Min libur.');

        airportRequest($this->admin, 'GET', "/api/admin/airports/{$this->soetta->id}")
            ->assertJsonPath('data.weekly_schedule.effective_from', '2020-01-01')
            ->assertJsonPath('data.upcoming_weekly_schedules.*.effective_from', ['2026-11-02']);
        airportRequest($this->admin, 'GET', "/api/admin/airports/{$this->soetta->id}/weekly-schedules")
            ->assertJsonPath('data.*.effective_from', ['2026-11-02', '2020-01-01']);
    });

    it('replaces a set saved for the same date', function () {
        foreach (['09:00', '10:00'] as $start) {
            airportRequest($this->admin, 'PUT', "/api/admin/airports/{$this->soetta->id}/weekly-schedule", [
                'effective_from' => '2026-11-02',
                'days' => [['day_of_week' => 6, 'is_workday' => true, 'start_time' => $start, 'end_time' => '12:00']],
            ])->assertOk();
        }

        expect(AirportWeeklySchedule::query()->where('airport_id', $this->soetta->id)->whereDate('effective_from', '2026-11-02')->count())->toBe(7)
            ->and(app(WorkSchedules::class)->forDate($this->soetta->id, '2026-11-07')->hours())->toBe(['start' => '10:00', 'end' => '12:00']);
    });

    it('rejects a date in the past', function () {
        airportRequest($this->admin, 'PUT', "/api/admin/airports/{$this->soetta->id}/weekly-schedule", [
            'effective_from' => '2026-10-11',
            'days' => [['day_of_week' => 1, 'is_workday' => false]],
        ])->assertJsonValidationErrors(['effective_from' => 'Tanggal berlaku tidak boleh di masa lalu.']);
    });
});

describe('jadwal khusus', function () {
    it('adds a special schedule that applies on workdays only', function () {
        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/special-schedules", [
            'name' => 'Jam kerja Ramadan', 'start_date' => '2026-10-15', 'end_date' => '2026-10-20',
            'start_time' => '08:00', 'end_time' => '15:00',
        ])
            ->assertCreated()
            ->assertJsonPath('data.state', 'upcoming')
            ->assertJsonPath('data.can_edit', true);

        $schedules = app(WorkSchedules::class);
        expect($schedules->forDate($this->soetta->id, '2026-10-16')->hours())->toBe(['start' => '08:00', 'end' => '15:00'])
            ->and($schedules->forDate($this->soetta->id, '2026-10-17')->isWorkday)->toBeFalse()
            ->and(AuditLog::sole()->detail)->toBe('Tambah jadwal khusus "Jam kerja Ramadan" 15-20 Okt 08:00-15:00.');
    });

    it('rejects overlapping ranges, past dates, and reversed hours', function (array $data, string $field, string $message) {
        AirportSpecialSchedule::factory()->for($this->soetta)->create(['start_date' => '2026-10-20', 'end_date' => '2026-10-25']);

        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/special-schedules", [
            'name' => 'Jadwal', 'start_date' => '2026-10-14', 'end_date' => '2026-10-16', 'start_time' => '08:00', 'end_time' => '15:00', ...$data,
        ])->assertUnprocessable()->assertJsonValidationErrors([$field => $message]);
    })->with([
        'tumpang tindih' => [['end_date' => '2026-10-20'], 'start_date', 'Rentang tanggal bertabrakan dengan jadwal khusus lain.'],
        'lampau' => [['start_date' => '2026-10-11'], 'start_date', 'Jadwal khusus hanya untuk tanggal yang belum lewat.'],
        'jam terbalik' => [['end_time' => '07:00'], 'end_time', 'Jam pulang harus setelah jam masuk.'],
    ]);

    it('allows another airport to use the same range', function () {
        AirportSpecialSchedule::factory()->for(Airport::factory())->create(['start_date' => '2026-10-14', 'end_date' => '2026-10-16']);

        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/special-schedules", [
            'name' => 'Jadwal', 'start_date' => '2026-10-14', 'end_date' => '2026-10-16', 'start_time' => '08:00', 'end_time' => '15:00',
        ])->assertCreated();
    });

    it('edits only the end date of a running schedule, and locks a finished one', function () {
        $running = AirportSpecialSchedule::factory()->for($this->soetta)->create(['name' => 'Ramadan', 'start_date' => '2026-10-05', 'end_date' => '2026-10-20', 'start_time' => '08:00:00', 'end_time' => '15:00:00']);
        $finished = AirportSpecialSchedule::factory()->for($this->soetta)->create(['start_date' => '2026-09-01', 'end_date' => '2026-09-05']);
        $base = ['name' => 'Ramadan', 'start_date' => '2026-10-05', 'end_date' => '2026-10-20', 'start_time' => '08:00', 'end_time' => '15:00'];

        airportRequest($this->admin, 'PUT', "/api/admin/special-schedules/{$running->id}", [...$base, 'start_time' => '07:00'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'running');
        airportRequest($this->admin, 'PUT', "/api/admin/special-schedules/{$running->id}", [...$base, 'end_date' => '2026-10-15'])
            ->assertOk()
            ->assertJsonPath('data.end_date', '2026-10-15')
            ->assertJsonPath('data.state', 'running');
        airportRequest($this->admin, 'PUT', "/api/admin/special-schedules/{$finished->id}", [...$base, 'start_date' => '2026-09-01', 'end_date' => '2026-09-05'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'finished');
    });

    it('stops a running schedule from today instead of deleting it, and deletes an upcoming one', function () {
        $running = AirportSpecialSchedule::factory()->for($this->soetta)->create(['start_date' => '2026-10-05', 'end_date' => '2026-10-20']);
        $upcoming = AirportSpecialSchedule::factory()->for($this->soetta)->create(['start_date' => '2026-11-01', 'end_date' => '2026-11-05']);

        airportRequest($this->admin, 'DELETE', "/api/admin/special-schedules/{$running->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Jadwal khusus dihentikan mulai hari ini.');
        airportRequest($this->admin, 'DELETE', "/api/admin/special-schedules/{$upcoming->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Jadwal khusus dihapus.');

        expect($running->fresh()->end_date->toDateString())->toBe('2026-10-11')
            ->and(AirportSpecialSchedule::query()->whereKey($upcoming->id)->exists())->toBeFalse();
    });

    it('keeps the copied hours of attendance already recorded', function () {
        $intern = User::factory()->intern(['airport_id' => $this->soetta->id])->create();
        $attendance = Attendance::factory()->for($intern, 'intern')->create(['date' => '2026-10-12']);

        airportRequest($this->admin, 'POST', "/api/admin/airports/{$this->soetta->id}/special-schedules", [
            'name' => 'Darurat', 'start_date' => '2026-10-12', 'end_date' => '2026-10-12', 'start_time' => '10:00', 'end_time' => '15:00',
        ])->assertCreated();

        expect($attendance->fresh()->scheduled_start)->toBe('08:00:00');
    });
});

it('rejects interns and mentors', function (string $role) {
    airportRequest(User::factory()->{$role}()->create(), 'GET', '/api/admin/airports')->assertForbidden();
})->with(['intern', 'mentor']);

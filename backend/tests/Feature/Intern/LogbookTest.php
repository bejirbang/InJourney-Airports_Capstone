<?php

use App\Enums\LogbookStatus;
use App\Models\Attendance;
use App\Models\Logbook;
use App\Models\LogbookReview;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Andi Pratama']);
    $this->token = $this->intern->createToken('api')->plainTextToken;
    $this->today = Attendance::factory()->clockedIn()->for($this->intern, 'intern')->create(['date' => '2026-10-12', 'clock_in_at' => '08:02:00']);
});

function logbookRequest(string $method, string $uri, array $data = []): TestResponse
{
    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.test()->token]);
}

function pastDay(User $intern, string $date, array $attributes = []): Attendance
{
    return Attendance::factory()->for($intern, 'intern')->create(['date' => $date, ...$attributes]);
}

describe('logbook hari ini', function () {
    it('saves a draft after clock in and lets the intern change it until clock out', function () {
        logbookRequest('PUT', '/api/intern/logbooks/2026-10-12', ['work' => 'Menyusun ERD.', 'notes' => 'Menunggu data.'])
            ->assertCreated()
            ->assertJsonPath('message', 'Logbook tersimpan.')
            ->assertJsonPath('data.logbook_state', 'draft')
            ->assertJsonPath('data.logbook.work', 'Menyusun ERD.')
            ->assertJsonPath('data.logbook.notes', 'Menunggu data.')
            ->assertJsonPath('data.logbook.submitted_at', null)
            ->assertJsonPath('data.action', 'save');

        $this->travelTo(Carbon::parse('2026-10-12 16:10:00'));

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-12', ['work' => 'Menyusun ERD tahap 2.'])
            ->assertOk()
            ->assertJsonPath('data.logbook.work', 'Menyusun ERD tahap 2.')
            ->assertJsonPath('data.logbook.notes', null);

        expect(Logbook::sole()->status)->toBe(LogbookStatus::Draft);
    });

    it('turns off the dashboard reminder once the logbook is filled', function () {
        logbookRequest('GET', '/api/intern/dashboard')->assertJsonPath('data.logbook_reminder', true);

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-12', ['work' => 'Rapat dengan mentor.'])->assertCreated();

        logbookRequest('GET', '/api/intern/dashboard')
            ->assertJsonPath('data.logbook_reminder', false)
            ->assertJsonPath('data.today.logbook.work', 'Rapat dengan mentor.');
    });

    it('requires the work field', function (array $payload) {
        logbookRequest('PUT', '/api/intern/logbooks/2026-10-12', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['work' => 'Isi apa yang Anda kerjakan hari ini.']);

        expect(Logbook::count())->toBe(0);
    })->with([
        'kosong' => [['work' => '']],
        'hanya spasi' => [['work' => '   ']],
        'tidak dikirim' => [['notes' => 'Catatan saja.']],
    ]);

    it('asks to clock in first', function () {
        $this->today->delete();

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-12', ['work' => 'Isi.'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Clock in dulu untuk mengisi logbook.', 'reason' => 'not_clocked_in']);
    });

    it('locks the logbook after clock out', function () {
        $this->today->update(['clock_out_at' => '17:00:00']);
        Logbook::factory()->pendingReview()->for($this->today)->create();

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-12', ['work' => 'Diubah.'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Logbook ini sedang menunggu review mentor.', 'reason' => 'pending_review']);
    });
});

describe('revisi', function () {
    beforeEach(function () {
        $this->day = pastDay($this->intern, '2026-10-08');
        $this->logbook = Logbook::factory()->revision()->for($this->day)->create(['work' => 'Rapat.']);
        LogbookReview::factory()->for($this->logbook)->create([
            'mentor_id' => $this->mentor->id,
            'comment' => 'Tambahkan hasil rapat dengan unit keuangan.',
            'created_at' => '2026-10-09 10:00:00',
        ]);
    });

    it('shows the mentor comment and the review history', function () {
        logbookRequest('GET', '/api/intern/logbooks/2026-10-08')
            ->assertOk()
            ->assertJsonPath('data.logbook_state', 'revision')
            ->assertJsonPath('data.action', 'resubmit')
            ->assertJsonPath('data.reviews', [[
                'action' => 'revision',
                'comment' => 'Tambahkan hasil rapat dengan unit keuangan.',
                'mentor' => 'Sari Wijaya',
                'created_at' => '2026-10-09T10:00:00+07:00',
            ]]);
    });

    it('resubmits the fixed logbook and notifies the mentor', function () {
        logbookRequest('PUT', '/api/intern/logbooks/2026-10-08', ['work' => 'Rapat dengan unit keuangan: anggaran disetujui.'])
            ->assertOk()
            ->assertJsonPath('message', 'Logbook terkirim ulang ke mentor.')
            ->assertJsonPath('data.logbook_state', 'pending_review')
            ->assertJsonPath('data.logbook.submitted_at', '2026-10-12T14:39:00+07:00')
            ->assertJsonPath('data.action', null)
            ->assertJsonCount(1, 'data.reviews');

        expect(Notification::sole()->only(['user_id', 'text', 'link_path', 'link_params']))->toBe([
            'user_id' => $this->mentor->id,
            'text' => 'Andi P. memperbaiki logbook 8 Okt.',
            'link_path' => '/logbook',
            'link_params' => ['open' => $this->logbook->id],
        ]);
    });

    it('cannot change an approved logbook', function () {
        $this->logbook->update(['status' => LogbookStatus::Approved]);

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-08', ['work' => 'Diubah.'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Logbook yang sudah disetujui tidak bisa diubah.', 'reason' => 'approved']);
    });
});

describe('hari yang dikoreksi', function () {
    it('lets the intern fill a corrected day without a logbook and sends it right away', function () {
        pastDay($this->intern, '2026-10-06', ['is_corrected' => true]);

        logbookRequest('GET', '/api/intern/logbooks/2026-10-06')
            ->assertJsonPath('data.logbook_state', 'missing')
            ->assertJsonPath('data.action', 'submit');

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-06', ['work' => 'Rapat koordinasi.'])
            ->assertCreated()
            ->assertJsonPath('message', 'Logbook terkirim ke mentor.')
            ->assertJsonPath('data.logbook_state', 'pending_review');

        expect(Notification::count())->toBe(0);
    });

    it('sends the draft left by a missed clock out once the day is corrected', function () {
        $day = pastDay($this->intern, '2026-10-06', ['clock_out_at' => null]);
        Logbook::factory()->for($day)->create(['work' => 'Draft lama.']);

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-06', ['work' => 'Draft lama, lengkap.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'needs_correction')
            ->assertJsonPath('message', 'Ajukan koreksi presensi untuk tanggal ini dulu. Logbook bisa dikirim setelah koreksi disetujui.');

        $day->update(['is_corrected' => true, 'clock_out_at' => '17:00:00']);

        logbookRequest('PUT', '/api/intern/logbooks/2026-10-06', ['work' => 'Draft lama, lengkap.'])
            ->assertOk()
            ->assertJsonPath('data.logbook_state', 'pending_review');
    });

    it('has no logbook on a day without attendance', function () {
        logbookRequest('PUT', '/api/intern/logbooks/2026-10-05', ['work' => 'Isi.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'no_attendance');
    });
});

describe('daftar logbook', function () {
    beforeEach(function () {
        Logbook::factory()->for($this->today)->create(['work' => 'Hari ini.']);
        Logbook::factory()->pendingReview()->for(pastDay($this->intern, '2026-10-09'))->create(['work' => 'Menyusun ERD tahap 1.']);
        $revision = Logbook::factory()->revision()->for(pastDay($this->intern, '2026-10-08'))->create();
        LogbookReview::factory()->for($revision)->create(['comment' => 'Tambahkan hasil rapat.']);
        Logbook::factory()->approved($this->mentor)->for(pastDay($this->intern, '2026-10-05'))->create(['work' => 'Rapat kebutuhan.']);
        pastDay($this->intern, '2026-10-06', ['is_corrected' => true]);
        Logbook::factory()->approved()->for(pastDay($this->intern, '2026-09-30'))->create();
    });

    it('lists the month newest first with the items that need action on top', function () {
        $response = logbookRequest('GET', '/api/intern/logbooks?month=2026-10')
            ->assertOk()
            ->assertJsonPath('data.month', '2026-10')
            ->assertJsonPath('data.action_needed', [
                ['date' => '2026-10-06', 'logbook_state' => 'missing', 'comment' => null],
                ['date' => '2026-10-08', 'logbook_state' => 'revision', 'comment' => 'Tambahkan hasil rapat.'],
            ]);

        $days = collect($response->json('data.days'))->keyBy('date');

        expect($days->keys()->all())->toBe(['2026-10-12', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-02', '2026-10-01'])
            ->and($days['2026-10-12'])->toMatchArray(['logbook_state' => 'draft', 'action' => 'save', 'work' => 'Hari ini.'])
            ->and($days['2026-10-09'])->toMatchArray(['logbook_state' => 'pending_review', 'action' => null])
            ->and($days['2026-10-08'])->toMatchArray(['logbook_state' => 'revision', 'action' => 'resubmit'])
            ->and($days['2026-10-07'])->toMatchArray(['attendance_status' => 'absent', 'logbook_state' => null, 'action' => null])
            ->and($days['2026-10-06'])->toMatchArray(['logbook_state' => 'missing', 'action' => 'submit'])
            ->and($days['2026-10-05'])->toMatchArray(['logbook_state' => 'approved', 'work' => 'Rapat kebutuhan.']);
    });

    it('filters by logbook status', function (string $status, array $dates) {
        $response = logbookRequest('GET', "/api/intern/logbooks?month=2026-10&status={$status}")->assertOk();

        expect(array_column($response->json('data.days'), 'date'))->toBe($dates);
    })->with([
        ['revision', ['2026-10-08']],
        ['missing', ['2026-10-06']],
        ['approved', ['2026-10-05']],
    ]);

    it('rejects an unknown filter', function () {
        logbookRequest('GET', '/api/intern/logbooks?status=rejected')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'Filter status tidak valid.']);
    });

    it('shows the number that needs action on the menu and the dashboard', function () {
        logbookRequest('GET', '/api/intern/menu')->assertJsonPath('data.2', ['key' => 'logbooks', 'path' => '/intern/logbooks', 'badge' => 2]);
        logbookRequest('GET', '/api/intern/dashboard')->assertJsonCount(2, 'data.action_needed.logbooks');
    });
});

it('rejects dates outside the internship or in the future', function (string $date) {
    logbookRequest('GET', "/api/intern/logbooks/{$date}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['date' => 'Tanggal di luar periode magang atau belum berjalan.']);
})->with(['2026-08-31', '2026-10-13', '2026-02-30', 'kemarin']);

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    test()->getJson('/api/intern/logbooks', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken])->assertForbidden();
})->with(['mentor', 'admin']);

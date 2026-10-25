<?php

use App\Enums\LogbookReviewAction;
use App\Enums\LogbookStatus;
use App\Events\NotificationSent;
use App\Models\Attendance;
use App\Models\Logbook;
use App\Models\LogbookReview;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->rizki = mentee($this->mentor, 'Rizki Pratama');
    $this->dimas = mentee($this->mentor, 'Dimas Aji');

    $this->rizki9 = submitted($this->rizki, '2026-10-09', ['work' => 'Menyusun ERD modul presensi.', 'notes' => 'Akses server belum ada.']);
    $this->dimas9 = submitted($this->dimas, '2026-10-09');
    $this->rizki8 = submitted($this->rizki, '2026-10-08');
});

function mentee(User $mentor, string $name, array $profile = []): User
{
    return User::factory()->intern(['mentor_id' => $mentor->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31', ...$profile])->create(['name' => $name]);
}

function submitted(User $intern, string $date, array $attributes = [], array $attendance = []): Logbook
{
    return Logbook::factory()->pendingReview()
        ->for(Attendance::factory()->for($intern, 'intern')->create(['date' => $date, ...$attendance]))
        ->create(['submitted_at' => "{$date} 17:00:00", ...$attributes]);
}

function mentorLogbooks(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

describe('antrean', function () {
    it('lists logbooks waiting for review, oldest date first, with the counts per tab', function () {
        Logbook::factory()->revision()->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-10-07']))->create();
        Logbook::factory()->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-10-12']))->create();
        submitted(mentee(User::factory()->mentor()->create(), 'Bukan Bimbingan'), '2026-10-05');

        mentorLogbooks($this->mentor, 'GET', '/api/mentor/logbooks')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$this->rizki8->id, $this->dimas9->id, $this->rizki9->id])
            ->assertJsonPath('data.2', [
                'id' => $this->rizki9->id,
                'intern' => ['id' => $this->rizki->id, 'name' => 'Rizki Pratama', 'short_name' => 'Rizki P.'],
                'date' => '2026-10-09',
                'work' => 'Menyusun ERD modul presensi.',
                'status' => 'pending_review',
                'submitted_at' => '2026-10-09T17:00:00+07:00',
                'is_corrected' => false,
                'revision_count' => 0,
            ])
            ->assertJsonPath('meta', ['pending_review' => 3, 'revision' => 1]);
    });

    it('shows the revision tab, the all tab without drafts, and filters by intern', function () {
        $revision = Logbook::factory()->revision()->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-10-07']))->create();
        Logbook::factory()->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-10-12']))->create();

        mentorLogbooks($this->mentor, 'GET', '/api/mentor/logbooks?tab=revision')->assertJsonPath('data.*.id', [$revision->id]);
        mentorLogbooks($this->mentor, 'GET', '/api/mentor/logbooks?tab=all')
            ->assertJsonPath('data.*.id', [$this->dimas9->id, $this->rizki9->id, $this->rizki8->id, $revision->id]);
        mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks?intern_id={$this->dimas->id}")->assertJsonPath('data.*.id', [$this->dimas9->id]);
    });

    it('shows the count on the menu', function () {
        mentorLogbooks($this->mentor, 'GET', '/api/mentor/menu')
            ->assertJsonPath('data.2', ['key' => 'logbooks', 'path' => '/mentor/logbooks', 'badge' => 3]);
    });

    it('follows the intern to the new mentor', function () {
        $budi = User::factory()->mentor()->create();
        $this->rizki->internProfile->update(['mentor_id' => $budi->id]);

        mentorLogbooks($budi, 'GET', '/api/mentor/logbooks')->assertJsonPath('data.*.id', [$this->rizki8->id, $this->rizki9->id]);
        mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks/{$this->rizki9->id}")->assertForbidden();
    });
});

describe('detail', function () {
    it('shows the logbook with attendance, review history, and the next and previous logbooks', function () {
        LogbookReview::factory()->for($this->rizki9)->create(['mentor_id' => $this->mentor->id, 'comment' => 'Lengkapi hasil rapat.', 'created_at' => '2026-10-10 09:00:00']);

        mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks/{$this->dimas9->id}")
            ->assertOk()
            ->assertJsonPath('data.previous_id', $this->rizki8->id)
            ->assertJsonPath('data.next_id', $this->rizki9->id);

        mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks/{$this->rizki9->id}")
            ->assertOk()
            ->assertJsonPath('data.notes', 'Akses server belum ada.')
            ->assertJsonPath('data.attendance', ['status' => 'present', 'clock_in_at' => '08:00', 'clock_out_at' => '17:00'])
            ->assertJsonPath('data.revision_count', 1)
            ->assertJsonPath('data.reviews', [[
                'action' => 'revision',
                'comment' => 'Lengkapi hasil rapat.',
                'mentor' => 'Sari Wijaya',
                'created_at' => '2026-10-10T09:00:00+07:00',
            ]])
            ->assertJsonPath('data.can_approve', true)
            ->assertJsonPath('data.can_request_revision', true)
            ->assertJsonPath('data.previous_id', $this->dimas9->id)
            ->assertJsonPath('data.next_id', null);
    });

    it('labels a logbook filled after an attendance correction', function () {
        $corrected = submitted($this->dimas, '2026-10-06', attendance: ['is_corrected' => true]);

        mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks/{$corrected->id}")->assertJsonPath('data.is_corrected', true);
    });

    it('hides drafts and logbooks of interns mentored by someone else', function () {
        $draft = Logbook::factory()->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-10-12']))->create();
        $other = submitted(mentee(User::factory()->mentor()->create(), 'Bukan Bimbingan'), '2026-10-05');

        foreach ([$draft, $other] as $logbook) {
            mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks/{$logbook->id}")
                ->assertForbidden()
                ->assertJsonPath('message', 'Anda tidak memiliki akses ke logbook ini.');
            mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$logbook->id}/approve")->assertForbidden();
        }
    });
});

describe('setujui', function () {
    it('approves with an optional comment, locks it, and keeps a review entry without notifying the intern', function () {
        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki9->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Logbook disetujui.')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_at', '2026-10-12T10:00:00+07:00')
            ->assertJsonPath('data.can_approve', false)
            ->assertJsonPath('data.can_request_revision', false);

        $logbook = $this->rizki9->refresh();
        expect($logbook->approved_by)->toBe($this->mentor->id)
            ->and(LogbookReview::sole()->only(['logbook_id', 'mentor_id', 'action', 'comment']))->toBe([
                'logbook_id' => $logbook->id,
                'mentor_id' => $this->mentor->id,
                'action' => LogbookReviewAction::Approved,
                'comment' => null,
            ])
            ->and(Notification::count())->toBe(0);

        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki9->id}/approve")
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Logbook ini sudah disetujui.', 'reason' => 'already_approved']);

        mentorLogbooks($this->rizki, 'PUT', '/api/intern/logbooks/2026-10-09', ['work' => 'Diubah.'])->assertJsonPath('reason', 'approved');
    });

    it('approves many at once and skips the ones no longer waiting', function () {
        $this->rizki8->update(['status' => LogbookStatus::Revision]);
        $other = submitted(mentee(User::factory()->mentor()->create(), 'Bukan Bimbingan'), '2026-10-05');

        mentorLogbooks($this->mentor, 'POST', '/api/mentor/logbooks/approve', ['ids' => [$this->rizki9->id, $this->dimas9->id, $this->rizki8->id, $other->id]])
            ->assertOk()
            ->assertJsonPath('message', '2 logbook disetujui. 2 logbook dilewati karena sudah tidak menunggu review.')
            ->assertJsonPath('data', ['approved' => [$this->rizki9->id, $this->dimas9->id], 'skipped' => [$this->rizki8->id, $other->id]]);

        expect(LogbookReview::count())->toBe(2)
            ->and($other->refresh()->status)->toBe(LogbookStatus::PendingReview)
            ->and($this->rizki8->refresh()->status)->toBe(LogbookStatus::Revision);
    });

    it('validates the bulk selection', function (array $payload) {
        mentorLogbooks($this->mentor, 'POST', '/api/mentor/logbooks/approve', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);
    })->with([
        'kosong' => [['ids' => []]],
        'tidak dikirim' => [[]],
    ]);

    it('lets the mentor approve a revision directly once the intern is inactive', function () {
        $this->rizki8->update(['status' => LogbookStatus::Revision]);

        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki8->id}/approve")
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'in_revision');

        $this->rizki->update(['is_active' => false]);

        mentorLogbooks($this->mentor, 'GET', "/api/mentor/logbooks/{$this->rizki8->id}")
            ->assertJsonPath('data.intern_inactive', true)
            ->assertJsonPath('data.warning', 'Intern sudah nonaktif dan tidak dapat memperbaiki logbook.')
            ->assertJsonPath('data.can_approve', true)
            ->assertJsonPath('data.can_request_revision', false);

        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki8->id}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
    });
});

describe('minta revisi', function () {
    it('requires a comment, sends it back to the intern, and notifies the intern over the websocket', function () {
        Event::fake([NotificationSent::class]);

        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki8->id}/revise")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comment' => 'Tulis komentar revisi.']);

        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki8->id}/revise", ['comment' => 'Tambahkan hasil rapat dengan unit keuangan.'])
            ->assertOk()
            ->assertJsonPath('message', 'Permintaan revisi terkirim ke intern.')
            ->assertJsonPath('data.status', 'revision')
            ->assertJsonPath('data.reviews.0.comment', 'Tambahkan hasil rapat dengan unit keuangan.');

        $notification = Notification::sole();
        expect($notification->only(['user_id', 'text', 'link_path', 'link_params']))->toBe([
            'user_id' => $this->rizki->id,
            'text' => 'Logbook 8 Okt perlu direvisi.',
            'link_path' => '/logbook',
            'link_params' => ['date' => '2026-10-08'],
        ]);

        Event::assertDispatched(NotificationSent::class, fn (NotificationSent $e): bool => $e->broadcastOn()->name === "private-users.{$this->rizki->id}");

        mentorLogbooks($this->rizki, 'GET', '/api/intern/logbooks/2026-10-08')
            ->assertJsonPath('data.logbook_state', 'revision')
            ->assertJsonPath('data.reviews.0.comment', 'Tambahkan hasil rapat dengan unit keuangan.');
    });

    it('only works on logbooks waiting for review', function () {
        $this->rizki8->update(['status' => LogbookStatus::Revision]);

        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki8->id}/revise", ['comment' => 'Lagi.'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Logbook ini sedang diperbaiki intern.', 'reason' => 'in_revision']);
    });

    it('notifies the mentor over the websocket when the intern resubmits', function () {
        mentorLogbooks($this->mentor, 'POST', "/api/mentor/logbooks/{$this->rizki8->id}/revise", ['comment' => 'Lengkapi.'])->assertOk();
        Event::fake([NotificationSent::class]);

        mentorLogbooks($this->rizki, 'PUT', '/api/intern/logbooks/2026-10-08', ['work' => 'Sudah dilengkapi.'])->assertOk();

        Event::assertDispatched(NotificationSent::class, fn (NotificationSent $e): bool => $e->broadcastOn()->name === "private-users.{$this->mentor->id}");
        mentorLogbooks($this->mentor, 'GET', '/api/mentor/logbooks')->assertJsonPath('data.0.revision_count', 1);
    });
});

it('rejects interns and admins', function (string $role) {
    mentorLogbooks(User::factory()->{$role}()->create(), 'GET', '/api/mentor/logbooks')->assertForbidden();
})->with(['intern', 'admin']);

<?php

use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern(['mentor_id' => $this->mentor->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create();
});

function announcementRequest(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function announcementForm(array $overrides = []): array
{
    return ['title' => 'Libur 17 Agustus', 'body' => 'Kantor tutup pada 17 Agustus.', 'for_intern' => true, 'for_mentor' => false, ...$overrides];
}

/**
 * @return list<int>
 */
function notifiedUsers(Announcement $announcement): array
{
    return Notification::query()->where('announcement_id', $announcement->id)->orderBy('user_id')->pluck('user_id')->all();
}

it('lists announcements newest first with their recipients', function () {
    $old = Announcement::factory()->create(['author_id' => $this->admin->id, 'title' => 'Batas laporan akhir', 'for_mentor' => false, 'created_at' => '2026-10-05 09:00:00']);
    $new = Announcement::factory()->create(['author_id' => $this->admin->id, 'title' => 'Libur 17 Agustus', 'created_at' => '2026-10-10 09:00:00']);

    announcementRequest($this->admin, 'GET', '/api/admin/announcements')
        ->assertOk()
        ->assertJsonPath('data.*.id', [$new->id, $old->id])
        ->assertJsonPath('data.1.title', 'Batas laporan akhir')
        ->assertJsonPath('data.1.author_name', 'Admin Sinta')
        ->assertJsonPath('data.1.for_intern', true)
        ->assertJsonPath('data.1.for_mentor', false);
});

it('sends a new announcement to the bell of active recipients and logs it', function () {
    $mentorId = $this->mentor->id;
    $notStarted = User::factory()->intern(['mentor_id' => $mentorId, 'start_date' => '2026-11-01', 'end_date' => '2027-01-31'])->create();
    User::factory()->intern(['mentor_id' => $mentorId, 'start_date' => '2026-07-01', 'end_date' => '2026-10-11'])->create();
    User::factory()->intern(['mentor_id' => $mentorId, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->inactive()->create();
    User::factory()->mentor()->inactive()->create();

    $response = announcementRequest($this->admin, 'POST', '/api/admin/announcements', announcementForm(['title' => '  Libur 17 Agustus ', 'for_mentor' => true]))
        ->assertCreated()
        ->assertJsonPath('message', 'Pengumuman terkirim ke bell icon penerima.')
        ->assertJsonPath('data.title', 'Libur 17 Agustus')
        ->assertJsonPath('data.author_name', 'Admin Sinta');

    $announcement = Announcement::query()->findOrFail($response->json('data.id'));

    expect(notifiedUsers($announcement))->toBe([$this->mentor->id, $this->intern->id, $notStarted->id])
        ->and(Notification::query()->where('user_id', $this->intern->id)->first()->only(['text', 'link_path', 'link_params']))->toBe([
            'text' => 'Libur 17 Agustus',
            'link_path' => '/',
            'link_params' => ['announcement' => $announcement->id],
        ])
        ->and(AuditLog::sole()->only(['action', 'object', 'detail']))->toBe([
            'action' => 'Pengumuman',
            'object' => 'Libur 17 Agustus',
            'detail' => 'Buat pengumuman untuk Intern dan Mentor.',
        ]);
});

it('validates the form', function (array $overrides, string $field, string $message) {
    announcementRequest($this->admin, 'POST', '/api/admin/announcements', announcementForm($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect(Announcement::query()->count())->toBe(0)
        ->and(Notification::query()->count())->toBe(0);
})->with([
    'tanpa judul' => [['title' => ' '], 'title', 'Judul wajib diisi.'],
    'tanpa isi' => [['body' => ''], 'body', 'Isi pengumuman wajib diisi.'],
    'tanpa penerima' => [['for_intern' => false, 'for_mentor' => false], 'recipients', 'Pilih minimal satu penerima.'],
    'judul terlalu panjang' => [['title' => str_repeat('a', 256)], 'title', 'Judul maksimal 255 karakter.'],
]);

describe('ubah pengumuman', function () {
    beforeEach(function () {
        $this->announcement = announcementRequest($this->admin, 'POST', '/api/admin/announcements', announcementForm())->json('data.id');
        $this->announcement = Announcement::query()->findOrFail($this->announcement);
        AuditLog::query()->delete();
    });

    it('updates the bell text of every recipient and keeps their read status', function () {
        Notification::query()->where('user_id', $this->intern->id)->update(['read_at' => now()]);

        announcementRequest($this->admin, 'PUT', "/api/admin/announcements/{$this->announcement->id}", announcementForm(['title' => 'Libur Hari Kemerdekaan']))
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan.')
            ->assertJsonPath('data.title', 'Libur Hari Kemerdekaan');

        $notification = Notification::query()->where('announcement_id', $this->announcement->id)->sole();
        expect($notification->text)->toBe('Libur Hari Kemerdekaan')
            ->and($notification->read_at)->not->toBeNull()
            ->and(AuditLog::sole()->detail)->toBe('Ubah pengumuman.');
    });

    it('notifies a role that is added and removes notifications of a role that is taken out', function () {
        announcementRequest($this->admin, 'PUT', "/api/admin/announcements/{$this->announcement->id}", announcementForm(['for_intern' => false, 'for_mentor' => true]))
            ->assertOk();

        expect(notifiedUsers($this->announcement))->toBe([$this->mentor->id])
            ->and(AuditLog::sole()->detail)->toBe('Ubah pengumuman, penerima kini Mentor.');
    });

    it('does not log saving without changes', function () {
        announcementRequest($this->admin, 'PUT', "/api/admin/announcements/{$this->announcement->id}", announcementForm())->assertOk();

        expect(AuditLog::query()->count())->toBe(0)
            ->and(notifiedUsers($this->announcement))->toBe([$this->intern->id]);
    });

    it('deletes the announcement together with its notifications', function () {
        Notification::query()->create(['user_id' => $this->intern->id, 'text' => 'Notifikasi lain.', 'link_path' => '/']);

        announcementRequest($this->admin, 'DELETE', "/api/admin/announcements/{$this->announcement->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Pengumuman dihapus.');

        expect(Announcement::query()->count())->toBe(0)
            ->and(Notification::query()->pluck('text')->all())->toBe(['Notifikasi lain.'])
            ->and(AuditLog::sole()->only(['object', 'detail']))->toBe(['object' => 'Libur 17 Agustus', 'detail' => 'Hapus pengumuman.']);
    });
});

describe('isi pengumuman dari lonceng', function () {
    it('opens an announcement for the recipient role', function () {
        $announcement = Announcement::factory()->create(['author_id' => $this->admin->id, 'title' => 'Libur 17 Agustus', 'body' => 'Kantor tutup.', 'for_mentor' => false]);

        announcementRequest($this->intern, 'GET', "/api/announcements/{$announcement->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Libur 17 Agustus')
            ->assertJsonPath('data.body', 'Kantor tutup.')
            ->assertJsonPath('data.author_name', 'Admin Sinta');

        announcementRequest($this->admin, 'GET', "/api/announcements/{$announcement->id}")->assertOk();

        announcementRequest($this->mentor, 'GET', "/api/announcements/{$announcement->id}")
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak memiliki akses ke pengumuman ini.');
    });

    it('returns 404 after the announcement is deleted', function () {
        $announcement = Announcement::factory()->create();
        $announcement->delete();

        announcementRequest($this->intern, 'GET', "/api/announcements/{$announcement->id}")->assertNotFound();
    });
});

it('rejects interns and mentors from managing announcements', function (string $role) {
    $actor = User::factory()->{$role}()->create();
    $announcement = Announcement::factory()->create();

    announcementRequest($actor, 'GET', '/api/admin/announcements')->assertForbidden();
    announcementRequest($actor, 'POST', '/api/admin/announcements', announcementForm())->assertForbidden();
    announcementRequest($actor, 'DELETE', "/api/admin/announcements/{$announcement->id}")->assertForbidden();
})->with(['intern', 'mentor']);

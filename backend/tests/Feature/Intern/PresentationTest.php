<?php

use App\Enums\PresentationStatus;
use App\Models\FinalPresentation;
use App\Models\Notification;
use App\Models\User;
use App\Rules\GoogleDriveLink;
use App\Services\SystemSettings;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

const PRESENTATION_LINK = 'https://drive.google.com/drive/folders/presentasi-rizki';

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-12-24 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->rizki = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Rizki Pratama']);
});

function presentationRequest(User $intern, string $method, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, '/api/intern/presentation', $data, ['Authorization' => 'Bearer '.$intern->createToken('api')->plainTextToken]);
}

it('keeps the form closed before H-7 and shows when it opens', function () {
    $this->travelTo(Carbon::parse('2026-12-23 23:00:00'));

    presentationRequest($this->rizki, 'GET')
        ->assertOk()
        ->assertJsonPath('data.state', 'not_open')
        ->assertJsonPath('data.opens_on', '2026-12-24')
        ->assertJsonPath('data.message', 'Presentasi akhir dapat dikirim mulai 24 Des 2026.')
        ->assertJsonPath('data.can_submit', false);

    presentationRequest($this->rizki, 'PUT', ['evidence_url' => PRESENTATION_LINK])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'not_open')
        ->assertJsonPath('message', 'Presentasi akhir dapat dikirim mulai 24 Des 2026.');

    expect(FinalPresentation::count())->toBe(0);
});

it('opens the form at H-7', function () {
    presentationRequest($this->rizki, 'GET')
        ->assertJsonPath('data', [
            'state' => 'not_submitted',
            'end_date' => '2026-12-31',
            'days_left' => 7,
            'opens_on' => '2026-12-24',
            'message' => null,
            'evidence_url' => null,
            'submitted_at' => null,
            'decision_note' => null,
            'decided_at' => null,
            'can_submit' => true,
        ]);
});

it('uses the reminder days from the settings', function () {
    app(SystemSettings::class)->set(SystemSettings::END_REMINDER_DAYS, '5');

    presentationRequest($this->rizki, 'GET')->assertJsonPath('data.state', 'not_open')->assertJsonPath('data.opens_on', '2026-12-26');
});

it('sends the link, waits for the admin, and notifies active admins once per submission', function () {
    User::factory()->admin()->inactive()->create();

    presentationRequest($this->rizki, 'PUT', ['evidence_url' => PRESENTATION_LINK])
        ->assertOk()
        ->assertJsonPath('message', 'Bukti presentasi terkirim. Menunggu verifikasi admin.')
        ->assertJsonPath('data.state', 'pending')
        ->assertJsonPath('data.evidence_url', PRESENTATION_LINK)
        ->assertJsonPath('data.submitted_at', '2026-12-24T10:00:00+07:00')
        ->assertJsonPath('data.can_submit', true);

    $notification = Notification::sole();
    expect($notification->user_id)->toBe($this->admin->id)
        ->and($notification->text)->toBe('Rizki P. mengirim bukti presentasi akhir.')
        ->and($notification->link_path)->toBe('/presentasi')
        ->and($notification->link_params)->toBe(['open' => FinalPresentation::sole()->id]);

    $this->travelTo(Carbon::parse('2026-12-24 11:00:00'));

    presentationRequest($this->rizki, 'PUT', ['evidence_url' => 'https://docs.google.com/document/d/baru'])
        ->assertOk()
        ->assertJsonPath('data.evidence_url', 'https://docs.google.com/document/d/baru')
        ->assertJsonPath('data.submitted_at', '2026-12-24T11:00:00+07:00');

    expect(FinalPresentation::count())->toBe(1)->and(Notification::count())->toBe(1);
});

it('validates the link like the leave evidence link', function (array $data, string $message) {
    presentationRequest($this->rizki, 'PUT', $data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['evidence_url' => $message]);
})->with([
    'kosong' => [[], 'Link bukti wajib diisi.'],
    'bukan google' => [['evidence_url' => 'https://drive.google.com.situs-jahat.com/x'], GoogleDriveLink::MESSAGE],
    'http' => [['evidence_url' => 'http://drive.google.com/x'], GoogleDriveLink::MESSAGE],
]);

it('replaces the link after a revision request and clears the old note', function () {
    FinalPresentation::factory()->revision($this->admin)->create(['intern_id' => $this->rizki->id]);

    presentationRequest($this->rizki, 'GET')
        ->assertJsonPath('data.state', 'revision')
        ->assertJsonPath('data.decision_note', 'Link tidak bisa dibuka.')
        ->assertJsonPath('data.can_submit', true);

    presentationRequest($this->rizki, 'PUT', ['evidence_url' => PRESENTATION_LINK])
        ->assertOk()
        ->assertJsonPath('data.state', 'pending')
        ->assertJsonPath('data.decision_note', null)
        ->assertJsonPath('data.decided_at', null);

    expect(Notification::sole()->text)->toBe('Rizki P. mengirim bukti presentasi akhir.');
});

it('locks the presentation once approved, even after the internship is extended', function () {
    FinalPresentation::factory()->approved($this->admin)->create(['intern_id' => $this->rizki->id, 'evidence_url' => PRESENTATION_LINK]);
    $this->rizki->internProfile->update(['end_date' => '2027-03-31']);

    presentationRequest($this->rizki, 'GET')
        ->assertJsonPath('data.state', 'approved')
        ->assertJsonPath('data.can_submit', false);

    presentationRequest($this->rizki, 'PUT', ['evidence_url' => 'https://docs.google.com/document/d/baru'])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'already_approved')
        ->assertJsonPath('message', 'Presentasi akhir sudah disetujui.');

    expect(FinalPresentation::sole()->evidence_url)->toBe(PRESENTATION_LINK)
        ->and(FinalPresentation::sole()->status)->toBe(PresentationStatus::Approved);
});

it('shows the dashboard banner from H-7 until the presentation is approved', function () {
    $dashboard = function (): TestResponse {
        app('auth')->forgetGuards();

        return test()->getJson('/api/intern/dashboard', ['Authorization' => 'Bearer '.$this->rizki->createToken('api')->plainTextToken]);
    };

    $this->travelTo(Carbon::parse('2026-12-23 10:00:00'));
    $dashboard()->assertJsonPath('data.presentation_banner', null);

    $this->travelTo(Carbon::parse('2026-12-24 10:00:00'));
    $dashboard()->assertJsonPath('data.presentation_banner', ['state' => 'not_submitted', 'end_date' => '2026-12-31', 'days_left' => 7]);

    $presentation = FinalPresentation::factory()->revision()->create(['intern_id' => $this->rizki->id]);
    $dashboard()->assertJsonPath('data.presentation_banner.state', 'revision');

    $presentation->update(['status' => PresentationStatus::Approved]);
    $dashboard()->assertJsonPath('data.presentation_banner', null);
});

it('rejects mentors and admins', function (string $role) {
    presentationRequest(User::factory()->{$role}()->create(), 'GET')->assertForbidden();
})->with(['mentor', 'admin']);

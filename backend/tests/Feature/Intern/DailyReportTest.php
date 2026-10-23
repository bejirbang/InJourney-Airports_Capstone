<?php

use App\Models\Attendance;
use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->token = $this->intern->createToken('api')->plainTextToken;
    $this->attendance = Attendance::factory()->clockedIn()->for($this->intern, 'intern')->create([
        'date' => '2026-10-12',
        'clock_in_at' => '08:02:00',
    ]);
});

function saveReport(array $payload)
{
    return test()->putJson('/api/intern/attendance/daily-report', $payload, [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

function showReport()
{
    return test()->getJson('/api/intern/attendance/daily-report', [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

it('sends the daily report for today after clock in', function () {
    saveReport(['work' => 'Menyusun ERD absensi.', 'notes' => 'Menunggu data jam kerja.'])
        ->assertCreated()
        ->assertJsonPath('message', 'Daily Report terkirim.')
        ->assertJsonPath('data.date', '2026-10-12')
        ->assertJsonPath('data.work', 'Menyusun ERD absensi.')
        ->assertJsonPath('data.notes', 'Menunggu data jam kerja.')
        ->assertJsonPath('data.sent_at', '2026-10-12T14:39:00+07:00')
        ->assertJsonPath('data.editable', true);

    expect(DailyReport::sole()->attendance_id)->toBe($this->attendance->id);
});

it('treats notes as optional', function () {
    saveReport(['work' => 'Rapat dengan mentor.'])
        ->assertCreated()
        ->assertJsonPath('data.notes', null);
});

it('removes the dashboard banner once the report is sent', function () {
    saveReport(['work' => 'Rapat dengan mentor.'])->assertCreated();

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.daily_report_sent', true)
        ->assertJsonPath('data.daily_report_reminder', false);
});

it('updates the same report until clock out', function () {
    saveReport(['work' => 'Draf awal.', 'notes' => 'Ada kendala.'])->assertCreated();

    $this->travelTo(Carbon::parse('2026-10-12 16:10:00'));

    saveReport(['work' => 'Draf final.', 'notes' => ''])
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan.')
        ->assertJsonPath('data.work', 'Draf final.')
        ->assertJsonPath('data.notes', null)
        ->assertJsonPath('data.sent_at', '2026-10-12T16:10:00+07:00');

    expect(DailyReport::count())->toBe(1);
});

it('rejects an empty or whitespace-only work field', function (array $payload) {
    saveReport($payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['work' => 'Isi apa yang Anda kerjakan hari ini.']);

    expect(DailyReport::count())->toBe(0);
})->with([
    'tanpa isian' => [[]],
    'kosong' => [['work' => '']],
    'hanya spasi' => [['work' => '   ']],
]);

it('trims the saved text', function () {
    saveReport(['work' => '  Membuat laporan.  '])->assertJsonPath('data.work', 'Membuat laporan.');
});

it('rejects the report before clock in', function () {
    $this->attendance->delete();

    saveReport(['work' => 'Belum clock in.'])
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Clock in dulu untuk mengisi Daily Report.',
            'reason' => 'not_clocked_in',
        ]);
});

it('locks the report after clock out', function () {
    DailyReport::factory()->for($this->attendance)->create(['work' => 'Laporan awal.']);
    $this->attendance->update(['clock_out_at' => '17:03:00']);

    saveReport(['work' => 'Diubah setelah clock out.'])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Laporan terkunci setelah clock out.')
        ->assertJsonPath('reason', 'clocked_out');

    showReport()
        ->assertJsonPath('data.work', 'Laporan awal.')
        ->assertJsonPath('data.editable', false);
});

it('locks a forgotten clock out day after 23:59', function () {
    $this->travelTo(Carbon::parse('2026-10-13 07:30:00'));

    saveReport(['work' => 'Laporan untuk kemarin.'])->assertJsonPath('reason', 'not_clocked_in');

    expect(DailyReport::count())->toBe(0);
});

it('shows today’s report, or null when it has not been sent', function () {
    showReport()->assertOk()->assertExactJson(['data' => null]);

    saveReport(['work' => 'Menulis dokumentasi.'])->assertCreated();

    showReport()
        ->assertOk()
        ->assertJsonPath('data.work', 'Menulis dokumentasi.')
        ->assertJsonPath('data.editable', true);
});

it('never touches another intern’s attendance', function () {
    $other = User::factory()->intern()->create();
    $otherAttendance = Attendance::factory()->clockedIn()->for($other, 'intern')->create(['date' => '2026-10-12']);

    saveReport(['work' => 'Laporan saya.'])->assertCreated();

    expect($otherAttendance->dailyReport()->exists())->toBeFalse();
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->putJson('/api/intern/attendance/daily-report', ['work' => 'x'], [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ])->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->putJson('/api/intern/attendance/daily-report', ['work' => 'x'])->assertUnauthorized();
    $this->getJson('/api/intern/attendance/daily-report')->assertUnauthorized();
});

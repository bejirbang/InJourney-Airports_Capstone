<?php

use App\Models\Airport;
use App\Models\Assessment;
use App\Models\AssessmentIndicator;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\FinalPresentation;
use App\Models\Logbook;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-12-28 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
    $this->halim = Airport::factory()->create(['name' => 'Halim Perdanakusuma']);
    $this->attendance = AssessmentIndicator::factory()->create(['name' => 'Kehadiran', 'sort_order' => 1]);
    $this->quality = AssessmentIndicator::factory()->create(['name' => 'Kualitas kerja', 'sort_order' => 2]);

    // Putri: sudah dinilai. Rizki: siap dinilai, draft tersimpan. Nabila: belum bisa, di Halim.
    $this->putri = recapIntern($this, 'Putri Ayu', '2026-12-29');
    FinalPresentation::factory()->approved()->create(['intern_id' => $this->putri->id]);
    $this->putriAssessment = Assessment::factory()->submitted('87.50')->create([
        'intern_id' => $this->putri->id,
        'mentor_id' => $this->mentor->id,
        'submitted_at' => '2026-12-19 15:00:00',
    ]);
    AssessmentScore::query()->create(['assessment_id' => $this->putriAssessment->id, 'indicator_id' => $this->quality->id, 'score' => 85]);
    AssessmentScore::query()->create(['assessment_id' => $this->putriAssessment->id, 'indicator_id' => $this->attendance->id, 'score' => 90]);

    $this->rizki = recapIntern($this, 'Rizki Pratama', '2026-12-31');
    FinalPresentation::factory()->approved()->create(['intern_id' => $this->rizki->id]);
    $draft = Assessment::factory()->create(['intern_id' => $this->rizki->id, 'mentor_id' => $this->mentor->id]);
    AssessmentScore::query()->create(['assessment_id' => $draft->id, 'indicator_id' => $this->attendance->id, 'score' => 70]);

    $this->nabila = recapIntern($this, 'Nabila Putri', '2026-12-30', ['airport_id' => $this->halim->id]);
    Logbook::factory()->revision()->for(Attendance::factory()->for($this->nabila, 'intern')->create(['date' => '2026-12-23']))->create();
});

function recapIntern($test, string $name, string $endDate, array $profile = []): User
{
    return User::factory()->intern([
        'mentor_id' => $test->mentor->id,
        'airport_id' => $test->soetta->id,
        'start_date' => '2026-09-01',
        'end_date' => $endDate,
        ...$profile,
    ])->create(['name' => $name]);
}

function assessmentRecap(User $user, string $uri): TestResponse
{
    app('auth')->forgetGuards();

    return test()->getJson($uri, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('lists every intern with the assessment status and the counts per status', function () {
    assessmentRecap($this->admin, '/api/admin/assessments')
        ->assertOk()
        ->assertJsonPath('data.*.intern.name', ['Putri Ayu', 'Nabila Putri', 'Rizki Pratama'])
        ->assertJsonPath('data.0', [
            'intern' => ['id' => $this->putri->id, 'name' => 'Putri Ayu', 'short_name' => 'Putri A.'],
            'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
            'airport' => ['id' => $this->soetta->id, 'name' => 'Soekarno-Hatta'],
            'end_date' => '2026-12-29',
            'presentation_status' => 'approved',
            'unapproved_logbooks' => 0,
            'status' => 'submitted',
            'blockers' => [],
            'can_assess' => false,
            'final_score' => 87.5,
            'submitted_at' => '2026-12-19T15:00:00+07:00',
            'assessed_by' => 'Sari Wijaya',
        ])
        ->assertJsonPath('data.1.status', 'blocked')
        ->assertJsonPath('data.1.blockers.*.code', ['presentation', 'logbooks'])
        ->assertJsonPath('data.2.status', 'draft')
        ->assertJsonPath('data.2.final_score', null)
        ->assertJsonPath('meta', ['ready' => 0, 'blocked' => 1, 'draft' => 1, 'submitted' => 1]);
});

it('filters by status and airport', function () {
    assessmentRecap($this->admin, '/api/admin/assessments?status=submitted')->assertJsonPath('data.*.intern.id', [$this->putri->id]);
    assessmentRecap($this->admin, "/api/admin/assessments?airport_id={$this->halim->id}")
        ->assertJsonPath('data.*.intern.id', [$this->nabila->id])
        ->assertJsonPath('meta', ['ready' => 0, 'blocked' => 1, 'draft' => 0, 'submitted' => 0]);
    assessmentRecap($this->admin, '/api/admin/assessments?status=lain')->assertUnprocessable();
});

it('shows the submitted scores per indicator without letting the admin edit', function () {
    $this->attendance->update(['is_active' => false]);

    assessmentRecap($this->admin, "/api/admin/assessments/{$this->putri->id}")
        ->assertOk()
        ->assertJsonPath('data.indicators', [
            ['id' => $this->attendance->id, 'category' => null, 'name' => 'Kehadiran', 'description' => null, 'weight' => null, 'score' => 90],
            ['id' => $this->quality->id, 'category' => null, 'name' => 'Kualitas kerja', 'description' => null, 'weight' => null, 'score' => 85],
        ])
        ->assertJsonPath('data.final_score', 87.5)
        ->assertJsonPath('data.predicate', 'Baik Sekali')
        ->assertJsonPath('data.assessed_by', 'Sari Wijaya')
        ->assertJsonPath('data.can_edit', false);
});

it('hides draft scores from the admin', function () {
    assessmentRecap($this->admin, "/api/admin/assessments/{$this->rizki->id}")
        ->assertOk()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.indicators.*.score', [null, null])
        ->assertJsonPath('data.final_score', null)
        ->assertJsonPath('data.predicate', null)
        ->assertJsonPath('data.notes', null);
});

it('rejects accounts that are not interns', function () {
    assessmentRecap($this->admin, "/api/admin/assessments/{$this->mentor->id}")
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'not_intern');
});

it('shows the intern their scores only after submission', function () {
    assessmentRecap($this->rizki, '/api/intern/assessment')
        ->assertOk()
        ->assertExactJson(['data' => [
            'available' => false,
            'message' => 'Penilaian akan tersedia setelah presentasi disetujui, semua logbook disetujui, dan mentor menyelesaikan penilaian.',
        ]]);

    assessmentRecap($this->putri, '/api/intern/assessment')
        ->assertOk()
        ->assertJsonPath('data.available', true)
        ->assertJsonPath('data.final_score', 87.5)
        ->assertJsonPath('data.predicate', 'Baik Sekali')
        ->assertJsonPath('data.assessed_by', 'Sari Wijaya')
        ->assertJsonPath('data.indicators.*.score', [90, 85]);
});

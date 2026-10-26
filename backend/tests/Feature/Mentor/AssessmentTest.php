<?php

use App\Enums\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AssessmentIndicator;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\FinalPresentation;
use App\Models\Logbook;
use App\Models\Notification;
use App\Models\User;
use App\Services\Assessments;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-12-28 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->attendance = AssessmentIndicator::factory()->create(['name' => 'Kehadiran', 'sort_order' => 1]);
    $this->discipline = AssessmentIndicator::factory()->create(['name' => 'Kedisiplinan', 'sort_order' => 2]);
    $this->quality = AssessmentIndicator::factory()->create(['name' => 'Kualitas kerja', 'sort_order' => 3]);
    $this->retired = AssessmentIndicator::factory()->inactive()->create(['name' => 'Lama', 'sort_order' => 4]);

    // Rizki: presentasi disetujui, semua logbook disetujui.
    $this->rizki = assessee($this->mentor, 'Rizki Pratama', '2026-12-31');
    FinalPresentation::factory()->approved($this->admin)->create(['intern_id' => $this->rizki->id]);
    logbookOn($this->rizki, '2026-12-23', 'approved');
    logbookOn($this->rizki, '2026-12-24', 'approved');
});

function assessee(User $mentor, string $name, string $endDate): User
{
    return User::factory()->intern(['mentor_id' => $mentor->id, 'start_date' => '2026-09-01', 'end_date' => $endDate])->create(['name' => $name]);
}

/**
 * Status null = hari presensi tanpa logbook.
 */
function logbookOn(User $intern, string $date, ?string $status, array $attendance = []): Attendance
{
    $day = Attendance::factory()->for($intern, 'intern')->create(['date' => $date, ...$attendance]);

    if ($status !== null) {
        Logbook::factory()->for($day)->create(['status' => $status]);
    }

    return $day;
}

function scoresPayload(array $scores, array $extra = []): array
{
    return ['scores' => array_map(fn (int $id, $score): array => ['indicator_id' => $id, 'score' => $score], array_keys($scores), $scores), ...$extra];
}

function mentorAssessments(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

describe('daftar', function () {
    it('lists mentees with the requirement status, ending soonest first', function () {
        $nabila = assessee($this->mentor, 'Nabila Putri', '2026-12-30');
        FinalPresentation::factory()->create(['intern_id' => $nabila->id]);
        logbookOn($nabila, '2026-12-23', 'pending_review');
        logbookOn($nabila, '2026-12-24', null);
        logbookOn($nabila, '2026-12-22', 'approved');

        $putri = assessee($this->mentor, 'Putri Ayu', '2026-12-29');
        Assessment::factory()->submitted('87.50')->create(['intern_id' => $putri->id, 'mentor_id' => $this->mentor->id, 'submitted_at' => '2026-12-27 15:00:00']);

        assessee(User::factory()->mentor()->create(), 'Bukan Bimbingan', '2026-12-29');

        mentorAssessments($this->mentor, 'GET', '/api/mentor/assessments')
            ->assertOk()
            ->assertJsonPath('data.*.intern.name', ['Putri Ayu', 'Nabila Putri', 'Rizki Pratama'])
            ->assertJsonPath('data.1', [
                'intern' => ['id' => $nabila->id, 'name' => 'Nabila Putri', 'short_name' => 'Nabila P.'],
                'end_date' => '2026-12-30',
                'presentation_status' => 'pending',
                'unapproved_logbooks' => 2,
                'status' => 'blocked',
                'blockers' => [
                    ['code' => 'presentation', 'text' => 'presentasi akhir belum disetujui'],
                    ['code' => 'logbooks', 'text' => '2 logbook belum disetujui'],
                ],
                'can_assess' => false,
                'final_score' => null,
                'submitted_at' => null,
                'assessed_by' => null,
            ])
            ->assertJsonPath('data.2.status', 'ready')
            ->assertJsonPath('data.2.blockers', [])
            ->assertJsonPath('data.0.status', 'submitted')
            ->assertJsonPath('data.0.final_score', 87.5)
            ->assertJsonPath('data.0.assessed_by', 'Sari Wijaya');
    });

    it('counts a missing presentation and an uncorrected missed clock out as blockers', function () {
        $dimas = assessee($this->mentor, 'Dimas Aji', '2026-12-31');
        logbookOn($dimas, '2026-12-24', 'draft', ['clock_out_at' => null]);

        mentorAssessments($this->mentor, 'GET', "/api/mentor/assessments/{$dimas->id}")
            ->assertOk()
            ->assertJsonPath('data.blockers', [
                ['code' => 'presentation', 'text' => 'presentasi akhir belum dikirim'],
                ['code' => 'logbooks', 'text' => '1 logbook belum disetujui'],
            ])
            ->assertJsonPath('data.unapproved_logbook_days', [['date' => '2026-12-24', 'status' => 'draft', 'logbook_id' => null]])
            ->assertJsonPath('data.can_edit', false);
    });

    it('shows the number of mentees ready to be assessed on the menu', function () {
        assessee($this->mentor, 'Belum Siap', '2026-12-31');

        mentorAssessments($this->mentor, 'GET', '/api/mentor/menu')
            ->assertJsonPath('data.7', ['key' => 'assessments', 'path' => '/mentor/assessments', 'badge' => 1]);
    });
});

describe('formulir', function () {
    it('shows the active indicators in order with an empty form', function () {
        mentorAssessments($this->mentor, 'GET', "/api/mentor/assessments/{$this->rizki->id}")
            ->assertOk()
            ->assertJsonPath('data.intern.name', 'Rizki Pratama')
            ->assertJsonPath('data.start_date', '2026-09-01')
            ->assertJsonPath('data.end_date', '2026-12-31')
            ->assertJsonPath('data.presentation.status', 'approved')
            ->assertJsonPath('data.status', 'ready')
            ->assertJsonPath('data.can_edit', true)
            ->assertJsonPath('data.indicators.*.name', ['Kehadiran', 'Kedisiplinan', 'Kualitas kerja'])
            ->assertJsonPath('data.indicators.0', ['id' => $this->attendance->id, 'category' => null, 'name' => 'Kehadiran', 'description' => null, 'weight' => null, 'score' => null])
            ->assertJsonPath('data.final_score', null)
            ->assertJsonPath('data.predicate', null)
            ->assertJsonPath('data.notes', null);
    });

    it('saves a partial draft and computes the final score once every score is filled', function () {
        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", scoresPayload([
            $this->attendance->id => 90,
            $this->discipline->id => null,
            $this->quality->id => 80,
        ], ['notes' => '  Teliti.  ']))
            ->assertOk()
            ->assertJsonPath('message', 'Draft penilaian tersimpan.')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.indicators.*.score', [90, null, 80])
            ->assertJsonPath('data.final_score', null)
            ->assertJsonPath('data.notes', 'Teliti.')
            ->assertJsonPath('data.can_edit', true);

        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", scoresPayload([
            $this->attendance->id => 90,
            $this->discipline->id => 85,
            $this->quality->id => 80,
        ], ['notes' => 'Teliti.']))
            ->assertJsonPath('data.final_score', 85)
            ->assertJsonPath('data.predicate', 'Baik');

        expect(Assessment::sole()->status)->toBe(AssessmentStatus::Draft)
            ->and(Assessment::sole()->final_score)->toBeNull()
            ->and(Assessment::sole()->notes)->toBe('Teliti.')
            ->and(AssessmentScore::count())->toBe(3)
            ->and(Notification::count())->toBe(0)
            ->and(AuditLog::query()->orderBy('id')->get(['admin_id', 'admin_name', 'action', 'object', 'detail'])->toArray())->toBe([
                ['admin_id' => $this->mentor->id, 'admin_name' => 'Sari Wijaya', 'action' => 'Penilaian', 'object' => 'Rizki Pratama', 'detail' => 'Simpan draft penilaian. Nilai: Kehadiran 90, Kualitas kerja 80. Catatan diubah.'],
                ['admin_id' => $this->mentor->id, 'admin_name' => 'Sari Wijaya', 'action' => 'Penilaian', 'object' => 'Rizki Pratama', 'detail' => 'Simpan draft penilaian. Nilai: Kehadiran 90, Kedisiplinan 85, Kualitas kerja 80.'],
            ]);
    });

    it('does not log a draft save that changes nothing', function () {
        $payload = scoresPayload([$this->attendance->id => 90], ['notes' => 'Baik.']);

        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", $payload)->assertOk();
        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", $payload)->assertOk();

        expect(AuditLog::count())->toBe(1);
    });

    it('submits, stores the final score, locks the assessment, and notifies the admin and the intern', function () {
        User::factory()->admin()->inactive()->create();

        mentorAssessments($this->mentor, 'POST', "/api/mentor/assessments/{$this->rizki->id}/submit", scoresPayload([
            $this->attendance->id => 90,
            $this->discipline->id => 85,
            $this->quality->id => 82,
        ], ['notes' => 'Rajin dan teliti.']))
            ->assertOk()
            ->assertJsonPath('message', 'Penilaian disubmit dan dikirim ke admin.')
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.final_score', 85.67)
            ->assertJsonPath('data.predicate', 'Baik')
            ->assertJsonPath('data.notes', 'Rajin dan teliti.')
            ->assertJsonPath('data.submitted_at', '2026-12-28T10:00:00+07:00')
            ->assertJsonPath('data.assessed_by', 'Sari Wijaya')
            ->assertJsonPath('data.can_edit', false);

        expect(Assessment::sole()->final_score)->toBe('85.67')
            ->and(AuditLog::sole()->detail)->toBe('Submit penilaian. Nilai: Kehadiran 90, Kedisiplinan 85, Kualitas kerja 82. Nilai akhir 85,67 (Baik). Catatan diubah.')
            ->and(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path', 'link_params'])->toArray())->toBe([
                ['user_id' => $this->admin->id, 'text' => 'Penilaian Rizki P. sudah disubmit.', 'link_path' => '/penilaian', 'link_params' => ['open' => $this->rizki->id]],
                ['user_id' => $this->rizki->id, 'text' => 'Penilaian akhir Anda sudah tersedia.', 'link_path' => '/catatan', 'link_params' => null],
            ]);

        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", scoresPayload([$this->attendance->id => 50]))
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'already_submitted')
            ->assertJsonPath('message', 'Penilaian ini sudah disubmit dan tidak bisa diubah.');

        expect(AssessmentScore::query()->where('indicator_id', $this->attendance->id)->value('score'))->toBe('90.00')
            ->and(AuditLog::count())->toBe(1);

        mentorAssessments($this->rizki, 'GET', '/api/intern/assessment')
            ->assertJsonPath('data.predicate', 'Baik')
            ->assertJsonPath('data.notes', 'Rajin dan teliti.');
    });

    it('keeps the submitted scores even after an indicator is deactivated', function () {
        mentorAssessments($this->mentor, 'POST', "/api/mentor/assessments/{$this->rizki->id}/submit", scoresPayload([
            $this->attendance->id => 90,
            $this->discipline->id => 80,
            $this->quality->id => 70,
        ]))->assertOk();

        $this->quality->update(['is_active' => false]);

        mentorAssessments($this->mentor, 'GET', "/api/mentor/assessments/{$this->rizki->id}")
            ->assertJsonPath('data.indicators.*.name', ['Kehadiran', 'Kedisiplinan', 'Kualitas kerja'])
            ->assertJsonPath('data.final_score', 80);
    });

    it('rejects an incomplete submission', function () {
        mentorAssessments($this->mentor, 'POST', "/api/mentor/assessments/{$this->rizki->id}/submit", scoresPayload([
            $this->attendance->id => 90,
            $this->discipline->id => null,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['scores' => 'Isi semua nilai sebelum submit.']);

        expect(Assessment::count())->toBe(0);
    });

    it('validates each score and indicator', function (Closure $payload, string $field, string $message) {
        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", $payload->call($this))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);
    })->with([
        'di atas 100' => [fn () => scoresPayload([$this->attendance->id => 101]), 'scores.0.score', 'Nilai harus antara 0 dan 100.'],
        'negatif' => [fn () => scoresPayload([$this->attendance->id => -1]), 'scores.0.score', 'Nilai harus antara 0 dan 100.'],
        'bukan angka' => [fn () => scoresPayload([$this->attendance->id => 'baik']), 'scores.0.score', 'Nilai harus berupa bilangan bulat.'],
        'desimal' => [fn () => scoresPayload([$this->attendance->id => 80.5]), 'scores.0.score', 'Nilai harus berupa bilangan bulat.'],
        'catatan terlalu panjang' => [fn () => scoresPayload([$this->attendance->id => 80], ['notes' => str_repeat('a', 1001)]), 'notes', 'Catatan maksimal 1000 karakter.'],
        'indikator nonaktif' => [fn () => scoresPayload([$this->retired->id => 80]), 'scores.0.indicator_id', 'Indikator tidak valid.'],
        'tanpa scores' => [fn () => [], 'scores', 'Isi nilai penilaian.'],
    ]);

    it('rechecks the requirements on the server', function () {
        $nabila = assessee($this->mentor, 'Nabila Putri', '2026-12-30');
        FinalPresentation::factory()->create(['intern_id' => $nabila->id]);
        logbookOn($nabila, '2026-12-23', 'pending_review');
        logbookOn($nabila, '2026-12-24', null);

        mentorAssessments($this->mentor, 'PUT', "/api/mentor/assessments/{$nabila->id}", scoresPayload([$this->attendance->id => 80]))
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'not_eligible')
            ->assertJsonPath('message', 'Penilaian belum bisa dilakukan: presentasi akhir belum disetujui, 2 logbook belum disetujui.')
            ->assertJsonCount(2, 'blockers');

        expect(Assessment::count())->toBe(0);
    });

    it('rejects a submission while there are no active indicators', function () {
        AssessmentIndicator::query()->update(['is_active' => false]);

        mentorAssessments($this->mentor, 'POST', "/api/mentor/assessments/{$this->rizki->id}/submit", ['scores' => []])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'no_indicators');
    });

    it('lets only the current mentor assess', function () {
        $newMentor = User::factory()->mentor()->create();
        $other = User::factory()->mentor()->create();

        $this->rizki->internProfile->update(['mentor_id' => $newMentor->id]);

        mentorAssessments($this->mentor, 'GET', "/api/mentor/assessments/{$this->rizki->id}")->assertForbidden();
        mentorAssessments($other, 'PUT', "/api/mentor/assessments/{$this->rizki->id}", scoresPayload([$this->attendance->id => 80]))->assertForbidden();
        mentorAssessments($newMentor, 'GET', "/api/mentor/assessments/{$this->rizki->id}")->assertOk();
    });
});

describe('siap dinilai', function () {
    beforeEach(function () {
        $this->dimas = assessee($this->mentor, 'Dimas Aji', '2026-12-31');
        FinalPresentation::factory()->approved($this->admin)->create(['intern_id' => $this->dimas->id]);
        logbookOn($this->dimas, '2026-12-23', 'approved');
    });

    it('tells the mentor when approving the last logbook opens the assessment', function () {
        $first = logbookOn($this->dimas, '2026-12-24', 'pending_review')->logbook;
        $last = logbookOn($this->dimas, '2026-12-25', 'pending_review')->logbook;

        mentorAssessments($this->mentor, 'POST', "/api/mentor/logbooks/{$first->id}/approve")->assertOk();
        expect(Notification::count())->toBe(0);

        mentorAssessments($this->mentor, 'POST', "/api/mentor/logbooks/{$last->id}/approve")->assertOk();

        expect(Notification::sole()->only(['user_id', 'text', 'link_path', 'link_params']))->toBe([
            'user_id' => $this->mentor->id,
            'text' => 'Dimas A. siap dinilai.',
            'link_path' => '/penilaian',
            'link_params' => ['open' => $this->dimas->id],
        ]);
    });

    it('also checks after approving many logbooks at once', function () {
        $ids = [
            logbookOn($this->dimas, '2026-12-24', 'pending_review')->logbook->id,
            logbookOn($this->dimas, '2026-12-25', 'pending_review')->logbook->id,
        ];

        mentorAssessments($this->mentor, 'POST', '/api/mentor/logbooks/approve', ['ids' => $ids])->assertOk();

        expect(Notification::sole()->text)->toBe('Dimas A. siap dinilai.');
    });

    it('stays quiet once the assessment is submitted', function () {
        Assessment::factory()->submitted()->create(['intern_id' => $this->dimas->id, 'mentor_id' => $this->mentor->id]);
        $last = logbookOn($this->dimas, '2026-12-24', 'pending_review')->logbook;

        mentorAssessments($this->mentor, 'POST', "/api/mentor/logbooks/{$last->id}/approve")->assertOk();

        expect(Notification::count())->toBe(0);
    });
});

describe('nilai akhir', function () {
    it('uses a weighted average when weights exist, treating a missing weight as zero', function () {
        $indicators = new Collection([
            AssessmentIndicator::factory()->make(['id' => 1, 'weight' => '30']),
            AssessmentIndicator::factory()->make(['id' => 2, 'weight' => '70']),
            AssessmentIndicator::factory()->make(['id' => 3, 'weight' => null]),
        ]);

        expect(Assessments::finalScore($indicators, [1 => 80, 2 => 90, 3 => 10]))->toBe(87.0)
            ->and(Assessments::finalScore($indicators, [1 => 80, 2 => 90]))->toBeNull();
    });

    it('uses a plain average without weights, rounded to two decimals', function () {
        $indicators = new Collection([
            AssessmentIndicator::factory()->make(['id' => 1]),
            AssessmentIndicator::factory()->make(['id' => 2]),
            AssessmentIndicator::factory()->make(['id' => 3]),
        ]);

        expect(Assessments::finalScore($indicators, [1 => 80, 2 => 85, 3 => 86]))->toBe(83.67)
            ->and(Assessments::finalScore(new Collection, []))->toBeNull();
    });
});

it('derives the predicate from the final score', function (float $score, string $predicate) {
    expect(Assessments::predicate($score))->toBe($predicate);
})->with([
    [100.0, 'Baik Sekali'],
    [86.0, 'Baik Sekali'],
    [85.99, 'Baik'],
    [71.0, 'Baik'],
    [70.99, 'Cukup'],
    [60.0, 'Cukup'],
    [59.99, 'Kurang'],
    [0.0, 'Kurang'],
]);

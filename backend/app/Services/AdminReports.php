<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Models\AuditLog;
use App\Models\Task;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Menu Laporan, export Excel .xlsx (docs/design-admin.md Alur 10). Hanya Rekap Absensi dan Rekap Task.
 *
 * Rekap Absensi: per intern, status final saja (sama dengan rekap di riwayat absensi): hari ini belum dihitung,
 * hari libur bukan hari kerja, dan tanggal di luar periode magang tidak dihitung. Filter Mentor memakai mentor
 * intern saat ini.
 *
 * Rekap Task (keputusan pemilik repo 23 Okt 2026): Task yang tenggatnya di dalam periode, filter Mentor memakai
 * mentor pemilik Task, dan tanda Terlambat juga untuk Task yang dikumpulkan setelah tenggat (termasuk Done).
 */
class AdminReports
{
    public const TYPES = [
        'attendance' => 'Rekap Absensi',
        'tasks' => 'Rekap Task',
    ];

    public const NO_DATA = 'Tidak ada data pada periode ini.';

    private const APP_NAME = 'InJourney Airports - Intern Management & Attendance System';

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
     * Pilihan filter Intern dan Mentor, termasuk akun nonaktif karena laporan bisa untuk periode lampau.
     *
     * @return array{interns: list<array{id: int, name: string}>, mentors: list<array{id: int, name: string, is_active: bool}>}
     */
    public function options(): array
    {
        $people = fn (Role $role) => User::query()->where('role', $role)->orderBy('name')->orderBy('id')->get(['id', 'name', 'is_active']);

        return [
            'interns' => array_values($people(Role::Intern)->map(fn (User $u): array => ['id' => $u->id, 'name' => $u->name])->all()),
            'mentors' => array_values($people(Role::Mentor)->map(fn (User $u): array => ['id' => $u->id, 'name' => $u->name, 'is_active' => $u->is_active])->all()),
        ];
    }

    /**
     * Susun laporan ke file .xlsx sementara dan catat di Log Aktivitas.
     *
     * @param  array{type: string, from: string, to: string, intern_id: int|null, mentor_id: int|null}  $filters
     * @return array{path: string, filename: string}
     *
     * @throws ActionRejected
     */
    public function export(User $admin, array $filters, CarbonInterface $now): array
    {
        [$head, $rows, $widths] = $filters['type'] === 'attendance'
            ? $this->attendance($filters, $now)
            : $this->tasks($filters, $now);

        if ($rows === []) {
            throw new ActionRejected(self::NO_DATA, 'no_data');
        }

        $label = self::TYPES[$filters['type']];
        $period = IndonesianDate::withYear(Carbon::parse($filters['from'])).' - '.IndonesianDate::withYear(Carbon::parse($filters['to']));

        $intern = $filters['intern_id'] === null ? null : User::query()->find($filters['intern_id']);
        $mentor = $filters['mentor_id'] === null ? null : User::query()->find($filters['mentor_id']);

        $info = [
            [self::APP_NAME],
            [$label],
            ["Periode: {$period}"],
            ['Intern: '.($intern->name ?? 'Semua').' | Mentor: '.($mentor->name ?? 'Semua')],
            ['Dibuat: '.IndonesianDate::withYear($now).' '.$now->format('H:i')." oleh {$admin->name}"],
        ];

        if ($filters['type'] === 'attendance' && $filters['to'] >= $now->toDateString()) {
            $info[] = ['Hari ini belum dihitung karena status final ditetapkan setelah 23:59.'];
        }

        $path = $this->write($label, $info, $head, $rows, $widths);

        $filterText = array_filter([
            $intern === null ? null : "intern {$intern->name}",
            $mentor === null ? null : "mentor {$mentor->name}",
        ]);
        AuditLog::record(
            $admin,
            AuditLog::ACTION_REPORT,
            $label,
            "Export Excel {$period}".($filterText === [] ? '' : ', '.implode(', ', $filterText)).'.',
        );

        $slug = $filters['type'] === 'attendance' ? 'rekap-absensi' : 'rekap-task';

        return ['path' => $path, 'filename' => "{$slug}_{$filters['from']}_{$filters['to']}.xlsx"];
    }

    /**
     * Satu baris per intern yang punya hari kerja final di periode itu (design-admin.md 12.3).
     *
     * @param  array{type: string, from: string, to: string, intern_id: int|null, mentor_id: int|null}  $filters
     * @return array{0: list<string>, 1: list<list<int|string>>, 2: list<float>}
     */
    private function attendance(array $filters, CarbonInterface $now): array
    {
        $interns = User::query()
            ->where('role', Role::Intern)
            ->when($filters['intern_id'], fn (Builder $q, int $id) => $q->whereKey($id))
            ->whereHas('internProfile', fn (Builder $q) => $q
                ->whereDate('start_date', '<=', $filters['to'])
                ->whereDate('end_date', '>=', $filters['from'])
                ->when($filters['mentor_id'], fn (Builder $p, int $id) => $p->where('mentor_id', $id)))
            ->with('internProfile.mentor:id,name')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        $rows = [];

        foreach ($interns as $intern) {
            $recap = $this->calendar->recap($this->calendar->days($intern, $filters['from'], $filters['to'], $now), $filters['from'], $now);

            if ($recap['working_days'] === 0) {
                continue;
            }

            $rows[] = [
                $intern->name,
                $intern->internProfile->mentor->name ?? '-',
                $recap['present'],
                $recap['leave'],
                $recap['absent'],
                $recap['missed_clock_out'],
                $recap['late'],
                $recap['working_days'],
            ];
        }

        return [
            ['Intern', 'Mentor', 'Hadir', 'Izin', 'Tidak Hadir', 'Lupa Clock Out', 'Hari Terlambat', 'Total Hari Kerja'],
            $rows,
            [28, 24, 10, 10, 12, 15, 15, 17],
        ];
    }

    /**
     * Task yang tenggatnya di dalam periode, urut nama intern lalu tenggat (design-admin.md 12.3).
     *
     * @param  array{type: string, from: string, to: string, intern_id: int|null, mentor_id: int|null}  $filters
     * @return array{0: list<string>, 1: list<list<int|string>>, 2: list<float>}
     */
    private function tasks(array $filters, CarbonInterface $now): array
    {
        $tasks = Task::query()
            ->select('tasks.*')
            ->join('users as interns', 'interns.id', '=', 'tasks.intern_id')
            ->whereNull('interns.deleted_at')
            ->whereDate('tasks.due_at', '>=', $filters['from'])
            ->whereDate('tasks.due_at', '<=', $filters['to'])
            ->when($filters['intern_id'], fn (Builder $q, int $id) => $q->where('tasks.intern_id', $id))
            ->when($filters['mentor_id'], fn (Builder $q, int $id) => $q->where('tasks.mentor_id', $id))
            ->with(['intern:id,name', 'mentor:id,name'])
            ->orderBy('interns.name')
            ->orderBy('tasks.due_at')
            ->orderBy('tasks.id')
            ->get();

        $rows = array_values($tasks->map(fn (Task $task): array => [
            $task->code,
            $task->intern->name,
            $task->mentor->name ?? '-',
            $task->title,
            $task->due_at->format('Y-m-d H:i'),
            $task->status->label(),
            $task->submitted_at?->format('Y-m-d H:i') ?? '-',
            $this->taskLate($task, $now) ? 'Terlambat' : '-',
        ])->all());

        return [
            ['Kode', 'Intern', 'Mentor', 'Judul Task', 'Tenggat', 'Status', 'Terakhir Dikumpulkan', 'Terlambat'],
            $rows,
            [10, 26, 24, 40, 17, 13, 21, 12],
        ];
    }

    /**
     * Tanda Terlambat untuk laporan: Task yang sudah dikumpulkan (In Review, Done) terlambat bila hasil terakhirnya
     * masuk setelah tenggat; Task yang belum dikumpulkan terlambat bila tenggatnya sudah lewat. Berbeda dengan
     * Task::isLate() di aplikasi, yang tidak menandai Task Done.
     */
    private function taskLate(Task $task, CarbonInterface $now): bool
    {
        return match ($task->status) {
            TaskStatus::Done, TaskStatus::InReview => ($task->submitted_at ?? $task->done_at ?? $now)->gt($task->due_at),
            default => $now->gt($task->due_at),
        };
    }

    /**
     * @param  list<list<string>>  $info  baris keterangan di atas tabel
     * @param  list<string>  $head
     * @param  list<list<int|string>>  $rows
     * @param  list<float>  $widths
     */
    private function write(string $sheetName, array $info, array $head, array $rows, array $widths): string
    {
        $path = tempnam(sys_get_temp_dir(), 'report');

        if ($path === false) {
            throw new \RuntimeException('Tidak bisa membuat file sementara untuk laporan.');
        }

        $options = new Options;
        foreach ($widths as $column => $width) {
            $options->setColumnWidth($width, $column + 1);
        }

        $writer = new Writer($options);
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName($sheetName);

        foreach ($info as $index => $line) {
            $writer->addRow($this->row($line, new Style(fontBold: $index === 1, fontSize: $index === 1 ? 14 : 11)));
        }

        $writer->addRow(new Row([]));
        $writer->addRow($this->row($head, new Style(fontBold: true, fontColor: Color::WHITE, backgroundColor: '1F4E79')));

        foreach ($rows as $row) {
            $writer->addRow($this->row($row));
        }

        $writer->close();

        return $path;
    }

    /**
     * Teks selalu ditulis sebagai teks: Row::fromValues() mengubah teks berawalan "=" menjadi rumus Excel,
     * sehingga nama atau judul Task buatan pengguna bisa dijalankan di komputer admin (formula injection).
     *
     * @param  list<int|string>  $values
     */
    private function row(array $values, ?Style $style = null): Row
    {
        return new Row(array_map(
            fn (int|string $value): Cell => is_string($value) ? new StringCell($value, $style) : Cell::fromValue($value, $style),
            $values,
        ));
    }
}

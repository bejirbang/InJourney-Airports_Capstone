<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Http\Requests\Mentor\TaskFormRequest;
use App\Models\Holiday;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Daftar Task mentor (docs/design-mentor.md, Alur 5) serta buat, ubah, dan hapus Task (Alur 4).
 * Notifikasi intern sesuai design-intern.md 16.
 */
class MentorTasks
{
    public const DUE_ON_HOLIDAY = 'Tenggat jatuh pada hari libur.';

    public const NOT_TODO = 'Task yang sudah dikerjakan tidak dapat dihapus.';

    public const HAS_COMMENTS = 'Task yang sudah memiliki komentar tidak dapat dihapus.';

    public function __construct(private AccountAccess $access, private Notifier $notifier) {}

    /**
     * Halaman Task mentor, Kanban dan Daftar (docs/design-mentor.md, Alur 5).
     * Semua Task yang dipegang mentor ini (`tasks.mentor_id`), dengan jumlah komentar belum dibaca mentor.
     *
     * @param  array{intern_id?: int|string|null, status?: string|null, late?: bool, due_from?: string|null, due_to?: string|null, q?: string|null, sort?: string|null, include_older_done?: bool}  $filters
     * @return array{tasks: Collection<int, Task>, hidden_done: int}
     */
    public function list(User $mentor, array $filters, CarbonInterface $now): array
    {
        $query = Task::query()
            ->where('mentor_id', $mentor->id)
            ->whereHas('intern')
            ->with('intern:id,name')
            ->withCount([
                'comments',
                'comments as unread_comments_count' => fn (Builder $q) => $q->unreadFor($mentor->id),
            ])
            ->when($filters['intern_id'] ?? null, fn (Builder $q, int|string $id) => $q->where('intern_id', (int) $id))
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['due_from'] ?? null, fn (Builder $q, string $date) => $q->whereDate('due_at', '>=', $date))
            ->when($filters['due_to'] ?? null, fn (Builder $q, string $date) => $q->whereDate('due_at', '<=', $date))
            ->when($filters['q'] ?? null, fn (Builder $q, string $search) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower($search).'%']));

        match ($filters['sort'] ?? 'due') {
            'newest' => $query->latest()->latest('id'),
            'intern' => $query
                ->orderBy(User::query()->select('name')->whereColumn('users.id', 'tasks.intern_id'))
                ->orderBy('due_at')
                ->orderBy('id'),
            default => $query->orderBy('due_at')->orderBy('id'),
        };

        $tasks = $query->get();

        if ($filters['late'] ?? false) {
            $tasks = $tasks->filter(fn (Task $task): bool => $task->isLate($now))->values();
        }

        return Task::withoutOldDone($tasks, $filters['include_older_done'] ?? false, $now);
    }

    /**
     * Task baru berstatus To Do untuk satu intern aktif bimbingan mentor ini.
     *
     * @param  array{intern_id: int|string, title: string, description: string, due_at: string}  $input
     *
     * @throws ValidationException
     */
    public function create(User $mentor, array $input, CarbonInterface $now): Task
    {
        $intern = User::query()->with('internProfile')->find((int) $input['intern_id']);

        // Hanya intern aktif bimbingan sendiri; Task baru tidak bisa dibuat untuk intern nonaktif (13.2).
        if ($intern === null
            || $intern->internProfile?->mentor_id !== $mentor->id
            || $this->access->denialReason($intern, $now) !== null) {
            throw ValidationException::withMessages(['intern_id' => TaskFormRequest::INTERN_REQUIRED]);
        }

        $due = $this->futureDue($input['due_at'], $now);

        $task = DB::transaction(function () use ($mentor, $intern, $input, $due): Task {
            $task = Task::query()->create([
                // Kode sementara agar unik, lalu diganti TSK-<id> (sama dengan format prototipe "TSK-024").
                'code' => 'TMP-'.Str::uuid(),
                'title' => $input['title'],
                'description' => $input['description'],
                'intern_id' => $intern->id,
                'mentor_id' => $mentor->id,
                'due_at' => $due,
                'status' => TaskStatus::Todo,
            ]);

            $task->update(['code' => sprintf('TSK-%03d', $task->id)]);

            return $task;
        });

        $this->notifier->send([$intern->id], "Task baru dari {$mentor->name}: {$task->title}.", '/task', ['open' => $task->id]);

        return $task;
    }

    /**
     * Ubah judul, deskripsi, dan tenggat selama belum Done (6.4). Intern tidak bisa diganti.
     * Tenggat yang tidak diubah boleh tetap lewat, agar Task terlambat tetap bisa diperbaiki teksnya.
     *
     * @param  array{title: string, description: string, due_at: string}  $input
     *
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function update(Task $task, array $input, CarbonInterface $now): Task
    {
        $due = self::parseDue($input['due_at']);
        $dueChanged = $due->format('Y-m-d H:i') !== $task->due_at->format('Y-m-d H:i');

        if ($dueChanged) {
            $due = $this->futureDue($input['due_at'], $now);
        }

        $changed = false;

        $task = DB::transaction(function () use ($task, $input, $due, $dueChanged, &$changed): Task {
            // Dikunci agar Accept mentor atau pengumpulan intern tidak bertabrakan dengan perubahan ini.
            $task = Task::query()->lockForUpdate()->findOrFail($task->id);

            if ($task->status === TaskStatus::Done) {
                throw new ActionRejected(Task::DONE_LOCKED, 'done_locked');
            }

            $task->fill([
                'title' => $input['title'],
                'description' => $input['description'],
                // Tenggat baru membuka lagi pengingat "lewat tenggat lebih dari 2 hari kerja" (7.6).
                ...$dueChanged ? ['due_at' => $due, 'overdue_reminded_at' => null] : [],
            ]);

            $changed = $task->isDirty();
            $task->save();

            return $task;
        });

        if ($changed) {
            $this->notifier->send([$task->intern_id], "Task '{$task->title}' diubah mentor.", '/task', ['open' => $task->id]);
        }

        return $task;
    }

    /**
     * Hapus hanya Task To Do yang belum punya komentar (6.4). Intern menerima notifikasi pembatalan.
     *
     * @throws ActionRejected
     */
    public function delete(Task $task): void
    {
        $task = DB::transaction(function () use ($task): Task {
            $task = Task::query()->lockForUpdate()->findOrFail($task->id);

            if ($task->status !== TaskStatus::Todo) {
                throw new ActionRejected(self::NOT_TODO, 'not_todo');
            }

            if ($task->comments()->exists()) {
                throw new ActionRejected(self::HAS_COMMENTS, 'has_comments');
            }

            $task->reads()->delete();
            $task->delete();

            return $task;
        });

        $this->notifier->send([$task->intern_id], "Task '{$task->title}' dibatalkan mentor.", '/task');
    }

    /**
     * Peringatan (bukan penolakan) jika tenggat jatuh pada Sabtu, Minggu, atau libur admin (6.3).
     *
     * @return array{due_on_holiday: bool, holiday_name: string|null, warning: string|null}
     */
    public function dueCheck(CarbonInterface $due): array
    {
        $holidayName = Holiday::query()->whereDate('date', $due->toDateString())->value('name');
        $onHoliday = $holidayName !== null || $due->isWeekend();

        return [
            'due_on_holiday' => $onHoliday,
            'holiday_name' => $holidayName,
            'warning' => $onHoliday ? self::DUE_ON_HOLIDAY : null,
        ];
    }

    /**
     * Waktu lokal dari formulir, tanpa detik.
     */
    public static function parseDue(string $value): Carbon
    {
        return Carbon::parse($value)->setTimezone(config('app.timezone'))->startOfMinute();
    }

    /**
     * @throws ValidationException
     */
    private function futureDue(string $value, CarbonInterface $now): Carbon
    {
        $due = self::parseDue($value);

        if ($due->lte($now)) {
            throw ValidationException::withMessages(['due_at' => TaskFormRequest::DUE_INVALID]);
        }

        return $due;
    }
}

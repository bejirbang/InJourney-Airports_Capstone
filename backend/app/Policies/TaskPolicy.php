<?php

namespace App\Policies;

use App\Models\MentorHistory;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Intern hanya melihat, memindahkan, mengumpulkan hasil, dan mengomentari Task miliknya sendiri.
 * Mentor hanya mengelola Task yang ia pegang (`tasks.mentor_id`).
 * Penolakan dibalas 403 dengan pesan Indonesia.
 */
class TaskPolicy
{
    public const FORBIDDEN = 'Anda tidak memiliki akses ke Task ini.';

    public const MOVED = 'Intern ini sudah dipindahkan ke mentor lain.';

    public function view(User $user, Task $task): Response
    {
        return $this->ownedByIntern($user, $task);
    }

    public function move(User $user, Task $task): Response
    {
        return $this->ownedByIntern($user, $task);
    }

    public function submit(User $user, Task $task): Response
    {
        return $this->ownedByIntern($user, $task);
    }

    public function comment(User $user, Task $task): Response
    {
        return $this->ownedByIntern($user, $task);
    }

    /**
     * Mentor: lihat detail, ubah, hapus, komentar, Accept, Revise (design-mentor.md Alur 4 sampai 6).
     * Mentor lama yang Task-nya sudah pindah ke mentor baru mendapat pesan 13.1.
     */
    public function manage(User $user, Task $task): Response
    {
        if ($task->mentor_id === $user->id) {
            return Response::allow();
        }

        $wasMentor = MentorHistory::query()
            ->ended()
            ->where('intern_id', $task->intern_id)
            ->where('mentor_id', $user->id)
            ->exists();

        return Response::deny($wasMentor ? self::MOVED : self::FORBIDDEN);
    }

    private function ownedByIntern(User $user, Task $task): Response
    {
        return $task->intern_id === $user->id ? Response::allow() : Response::deny(self::FORBIDDEN);
    }
}

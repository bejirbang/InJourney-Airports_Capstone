<?php

namespace App\Policies;

use App\Models\MentorHistory;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\Response;

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

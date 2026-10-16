<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

/**
 * Intern hanya melihat, memindahkan, mengumpulkan hasil, dan mengomentari Task miliknya sendiri.
 */
class TaskPolicy
{
    public function view(User $user, Task $task): bool
    {
        return $task->intern_id === $user->id;
    }

    public function move(User $user, Task $task): bool
    {
        return $task->intern_id === $user->id;
    }

    public function submit(User $user, Task $task): bool
    {
        return $task->intern_id === $user->id;
    }

    public function comment(User $user, Task $task): bool
    {
        return $task->intern_id === $user->id;
    }
}

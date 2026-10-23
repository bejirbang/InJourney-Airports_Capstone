<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Todo = 'todo';
    case InProgress = 'in_progress';
    case InReview = 'in_review';
    case Done = 'done';

    /**
     * Label untuk isi file yang dibuat backend (Rekap Task). Tampilan lain memakai label dari frontend.
     */
    public function label(): string
    {
        return match ($this) {
            self::Todo => 'To Do',
            self::InProgress => 'In Progress',
            self::InReview => 'In Review',
            self::Done => 'Done',
        };
    }
}

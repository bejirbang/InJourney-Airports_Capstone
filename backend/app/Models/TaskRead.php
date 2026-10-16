<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Terakhir seseorang membaca komentar sebuah Task. Komentar orang lain yang lebih baru dihitung belum dibaca.
 *
 * @property int $id
 * @property int $task_id
 * @property int $user_id
 * @property Carbon $last_read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['task_id', 'user_id', 'last_read_at'])]
class TaskRead extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
        ];
    }
}

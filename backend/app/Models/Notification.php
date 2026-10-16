<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Isi lonceng notifikasi. Tabel sendiri, bukan channel `database` bawaan Laravel.
 * `link_path` dan `link_params` adalah halaman tujuan di frontend saat item diklik.
 *
 * @property int $id
 * @property int $user_id
 * @property string $text
 * @property string $link_path
 * @property array<string, mixed>|null $link_params
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'text', 'link_path', 'link_params', 'read_at'])]
class Notification extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'link_params' => 'array',
            'read_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

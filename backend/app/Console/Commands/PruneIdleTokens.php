<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Date;
use Laravel\Sanctum\PersonalAccessToken;

class PruneIdleTokens extends Command
{
    protected $signature = 'app:prune-idle-tokens';

    protected $description = 'Hapus token login yang sudah tidak dipakai melewati batas sesi (sanctum.idle_minutes)';

    public function handle(): int
    {
        $limit = Date::now()->subMinutes((int) config('sanctum.idle_minutes'));

        $deleted = PersonalAccessToken::query()
            ->where(fn (Builder $q) => $q
                ->where('last_used_at', '<=', $limit)
                ->orWhere(fn (Builder $n) => $n->whereNull('last_used_at')->where('created_at', '<=', $limit)))
            ->delete();

        $this->info("{$deleted} token tidak aktif dihapus.");

        return self::SUCCESS;
    }
}

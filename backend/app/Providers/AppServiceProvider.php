<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
        $this->configureSessionTimeout();
    }

    /**
     * Token ditolak (401 "Sesi Anda sudah berakhir") jika tidak dipakai selama `sanctum.idle_minutes`.
     */
    protected function configureSessionTimeout(): void
    {
        Sanctum::authenticateAccessTokensUsing(function (PersonalAccessToken $token, bool $isValid): bool {
            $lastActivity = $token->last_used_at ?? $token->created_at;

            return $isValid
                && $lastActivity !== null
                && $lastActivity->greaterThan(Date::now()->subMinutes((int) config('sanctum.idle_minutes')));
        });
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('login', fn (Request $request): Limit => Limit::perMinute(5)
            ->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip())
            ->response(fn (Request $request, array $headers) => response()->json([
                'message' => 'Terlalu banyak percobaan masuk. Coba lagi dalam '.($headers['Retry-After'] ?? 60).' detik.',
            ], 429, $headers)));
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}

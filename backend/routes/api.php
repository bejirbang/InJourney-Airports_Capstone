<?php

use App\Http\Controllers\Admin\ResetPasswordController;
use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('auth.login');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Tetap bisa dibuka walau password sementara belum diganti.
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::put('/auth/password', [AuthController::class, 'changePassword'])->name('auth.password');

    Route::middleware('password.changed')->group(function () {
        Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
            Route::post('/users/{user}/reset-password', ResetPasswordController::class)
                ->name('users.reset-password');
        });
    });
});

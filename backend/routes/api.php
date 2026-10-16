<?php

use App\Http\Controllers\Admin\ResetPasswordController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Intern\AttendanceController as InternAttendanceController;
use App\Http\Controllers\Intern\AttendanceCorrectionController as InternCorrectionController;
use App\Http\Controllers\Intern\DashboardController as InternDashboardController;
use App\Http\Controllers\Intern\LeaveController as InternLeaveController;
use App\Http\Controllers\Intern\MenuController as InternMenuController;
use App\Http\Controllers\Intern\TaskController as InternTaskController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('auth.login');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::put('/auth/password', [AuthController::class, 'changePassword'])->name('auth.password');

    Route::middleware('password.changed')->group(function () {
        Route::middleware('role:intern')->prefix('intern')->name('intern.')->group(function () {
            Route::get('/menu', InternMenuController::class)->name('menu');
            Route::get('/dashboard', InternDashboardController::class)->name('dashboard');
            Route::post('/attendance/clock-in', [InternAttendanceController::class, 'clockIn'])->name('attendance.clock-in');
            Route::post('/attendance/clock-out', [InternAttendanceController::class, 'clockOut'])->name('attendance.clock-out');
            Route::get('/attendance', [InternAttendanceController::class, 'history'])->name('attendance.history');
            Route::get('/attendance/days/{date}', [InternAttendanceController::class, 'day'])->name('attendance.day');
            Route::get('/attendance/daily-report', [InternAttendanceController::class, 'showDailyReport'])->name('attendance.daily-report.show');
            Route::put('/attendance/daily-report', [InternAttendanceController::class, 'saveDailyReport'])->name('attendance.daily-report.save');

            Route::get('/attendance-corrections', [InternCorrectionController::class, 'index'])->name('corrections.index');
            Route::post('/attendance-corrections', [InternCorrectionController::class, 'store'])->name('corrections.store');
            Route::get('/attendance-corrections/{correction}', [InternCorrectionController::class, 'show'])->name('corrections.show');
            Route::post('/attendance-corrections/{correction}/cancel', [InternCorrectionController::class, 'cancel'])->name('corrections.cancel');
            Route::get('/attendance-corrections/{correction}/evidence', [InternCorrectionController::class, 'evidence'])->name('corrections.evidence');

            Route::get('/tasks', [InternTaskController::class, 'index'])->name('tasks.index');
            Route::get('/tasks/{task}', [InternTaskController::class, 'show'])->name('tasks.show');
            Route::post('/tasks/{task}/move', [InternTaskController::class, 'move'])->name('tasks.move');
            Route::post('/tasks/{task}/submission', [InternTaskController::class, 'submit'])->name('tasks.submit');
            Route::get('/tasks/{task}/submission/file', [InternTaskController::class, 'submissionFile'])->name('tasks.submission-file');
            Route::post('/tasks/{task}/comments', [InternTaskController::class, 'comment'])->name('tasks.comments.store');

            Route::get('/leaves', [InternLeaveController::class, 'index'])->name('leaves.index');
            Route::get('/leaves/working-days', [InternLeaveController::class, 'workingDays'])->name('leaves.working-days');
            Route::post('/leaves', [InternLeaveController::class, 'store'])->name('leaves.store');
            Route::get('/leaves/{leave}', [InternLeaveController::class, 'show'])->whereNumber('leave')->name('leaves.show');
            Route::post('/leaves/{leave}/cancel', [InternLeaveController::class, 'cancel'])->name('leaves.cancel');
            Route::get('/leaves/{leave}/evidence', [InternLeaveController::class, 'evidence'])->name('leaves.evidence');
        });

        Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
            Route::post('/users/{user}/reset-password', ResetPasswordController::class)
                ->name('users.reset-password');
        });
    });
});

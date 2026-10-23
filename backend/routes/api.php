<?php

use App\Http\Controllers\Admin\CorrectionController as AdminCorrectionController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\EndingInternshipController as AdminEndingInternshipController;
use App\Http\Controllers\Admin\HolidayController as AdminHolidayController;
use App\Http\Controllers\Admin\InternRecordController as AdminInternRecordController;
use App\Http\Controllers\Admin\LeaveController as AdminLeaveController;
use App\Http\Controllers\Admin\MenuController as AdminMenuController;
use App\Http\Controllers\Admin\ResetPasswordController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\WarningController as AdminWarningController;
use App\Http\Controllers\Admin\WorkHourController as AdminWorkHourController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\ProfileController;
use App\Http\Controllers\Intern\AttendanceController as InternAttendanceController;
use App\Http\Controllers\Intern\AttendanceCorrectionController as InternCorrectionController;
use App\Http\Controllers\Intern\DashboardController as InternDashboardController;
use App\Http\Controllers\Intern\LeaveController as InternLeaveController;
use App\Http\Controllers\Intern\MenuController as InternMenuController;
use App\Http\Controllers\Intern\OfficeController as InternOfficeController;
use App\Http\Controllers\Intern\TaskController as InternTaskController;
use App\Http\Controllers\Mentor\DashboardController as MentorDashboardController;
use App\Http\Controllers\Mentor\InternController as MentorInternController;
use App\Http\Controllers\Mentor\LeaveCalendarController as MentorLeaveCalendarController;
use App\Http\Controllers\Mentor\LeaveController as MentorLeaveController;
use App\Http\Controllers\Mentor\MenuController as MentorMenuController;
use App\Http\Controllers\Mentor\PerformanceController as MentorPerformanceController;
use App\Http\Controllers\Mentor\TaskController as MentorTaskController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('auth.login');

// Tanpa token: alamat bertanda tangan dari `user.photo_url`, agar bisa dipakai langsung di <img>.
Route::get('/users/{user}/photo', [ProfileController::class, 'photo'])
    ->middleware('signed')
    ->name('users.photo');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::put('/auth/password', [AuthController::class, 'changePassword'])->name('auth.password');

    Route::middleware('password.changed')->group(function () {
        Route::put('/auth/profile', [ProfileController::class, 'update'])->name('auth.profile.update');
        Route::post('/auth/profile/photo', [ProfileController::class, 'uploadPhoto'])->name('auth.profile.photo.store');
        Route::delete('/auth/profile/photo', [ProfileController::class, 'deletePhoto'])->name('auth.profile.photo.destroy');

        Route::middleware('role:intern')->prefix('intern')->name('intern.')->group(function () {
            Route::get('/menu', InternMenuController::class)->name('menu');
            Route::get('/dashboard', InternDashboardController::class)->name('dashboard');
            Route::get('/offices', [InternOfficeController::class, 'index'])->name('offices.index');
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

        Route::middleware('role:mentor')->prefix('mentor')->name('mentor.')->group(function () {
            Route::get('/menu', MentorMenuController::class)->name('menu');
            Route::get('/dashboard', MentorDashboardController::class)->name('dashboard');

            Route::get('/interns', [MentorInternController::class, 'index'])->name('interns.index');
            Route::get('/interns/{intern}', [MentorInternController::class, 'show'])->whereNumber('intern')->name('interns.show');
            Route::get('/interns/{intern}/attendance', [MentorInternController::class, 'attendance'])->name('interns.attendance');
            Route::get('/interns/{intern}/attendance/days/{date}', [MentorInternController::class, 'day'])->name('interns.attendance.day');
            Route::get('/interns/{intern}/daily-reports', [MentorInternController::class, 'dailyReports'])->name('interns.daily-reports');
            Route::get('/interns/{intern}/tasks', [MentorInternController::class, 'tasks'])->name('interns.tasks');
            Route::get('/interns/{intern}/leaves', [MentorInternController::class, 'leaves'])->name('interns.leaves');

            Route::get('/tasks', [MentorTaskController::class, 'index'])->name('tasks.index');
            Route::get('/tasks/due-check', [MentorTaskController::class, 'dueCheck'])->name('tasks.due-check');
            Route::post('/tasks', [MentorTaskController::class, 'store'])->name('tasks.store');
            Route::put('/tasks/{task}', [MentorTaskController::class, 'update'])->whereNumber('task')->name('tasks.update');
            Route::delete('/tasks/{task}', [MentorTaskController::class, 'destroy'])->whereNumber('task')->name('tasks.destroy');
            Route::get('/tasks/{task}', [MentorTaskController::class, 'show'])->whereNumber('task')->name('tasks.show');
            Route::get('/tasks/{task}/submission/file', [MentorTaskController::class, 'submissionFile'])->name('tasks.submission-file');
            Route::post('/tasks/{task}/comments', [MentorTaskController::class, 'comment'])->name('tasks.comments.store');
            Route::post('/tasks/{task}/accept', [MentorTaskController::class, 'accept'])->name('tasks.accept');
            Route::post('/tasks/{task}/revise', [MentorTaskController::class, 'revise'])->name('tasks.revise');

            Route::get('/leaves', [MentorLeaveController::class, 'index'])->name('leaves.index');
            Route::get('/leaves/{leave}', [MentorLeaveController::class, 'show'])->whereNumber('leave')->name('leaves.show');
            Route::get('/leaves/{leave}/evidence', [MentorLeaveController::class, 'evidence'])->name('leaves.evidence');
            Route::post('/leaves/{leave}/approve', [MentorLeaveController::class, 'approve'])->name('leaves.approve');
            Route::post('/leaves/{leave}/reject', [MentorLeaveController::class, 'reject'])->name('leaves.reject');

            Route::get('/leave-calendar', MentorLeaveCalendarController::class)->name('leave-calendar');
            Route::get('/performance', MentorPerformanceController::class)->name('performance');
        });

        Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
            Route::get('/menu', AdminMenuController::class)->name('menu');
            Route::get('/dashboard', AdminDashboardController::class)->name('dashboard');
            Route::get('/ending-internships', AdminEndingInternshipController::class)->name('ending-internships');

            Route::get('/mentors', [AdminUserController::class, 'mentors'])->name('mentors.index');
            Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
            Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
            Route::get('/users/{user}', [AdminUserController::class, 'show'])->whereNumber('user')->name('users.show');
            Route::put('/users/{user}', [AdminUserController::class, 'update'])->whereNumber('user')->name('users.update');
            Route::get('/users/{user}/mentor-change', [AdminUserController::class, 'mentorChange'])->name('users.mentor-change');
            Route::post('/users/{user}/mentor', [AdminUserController::class, 'changeMentor'])->name('users.change-mentor');
            Route::post('/users/{user}/deactivate', [AdminUserController::class, 'deactivate'])->name('users.deactivate');
            Route::post('/users/{user}/activate', [AdminUserController::class, 'activate'])->name('users.activate');
            Route::post('/users/{user}/extend', [AdminUserController::class, 'extend'])->name('users.extend');

            Route::get('/users/{user}/attendance', [AdminInternRecordController::class, 'attendance'])->name('users.attendance');
            Route::get('/users/{user}/attendance/days/{date}', [AdminInternRecordController::class, 'day'])->name('users.attendance.day');
            Route::get('/users/{user}/leaves', [AdminInternRecordController::class, 'leaves'])->name('users.leaves');
            Route::get('/users/{user}/corrections', [AdminInternRecordController::class, 'corrections'])->name('users.corrections');

            Route::get('/corrections', [AdminCorrectionController::class, 'index'])->name('corrections.index');
            Route::get('/corrections/{correction}', [AdminCorrectionController::class, 'show'])->whereNumber('correction')->name('corrections.show');
            Route::get('/corrections/{correction}/evidence', [AdminCorrectionController::class, 'evidence'])->name('corrections.evidence');
            Route::post('/corrections/{correction}/approve', [AdminCorrectionController::class, 'approve'])->name('corrections.approve');
            Route::post('/corrections/{correction}/reject', [AdminCorrectionController::class, 'reject'])->name('corrections.reject');

            Route::get('/leaves', [AdminLeaveController::class, 'index'])->name('leaves.index');
            Route::get('/leaves/{leave}', [AdminLeaveController::class, 'show'])->whereNumber('leave')->name('leaves.show');
            Route::get('/leaves/{leave}/evidence', [AdminLeaveController::class, 'evidence'])->name('leaves.evidence');
            Route::post('/leaves/{leave}/approve', [AdminLeaveController::class, 'approve'])->name('leaves.approve');
            Route::post('/leaves/{leave}/reject', [AdminLeaveController::class, 'reject'])->name('leaves.reject');

            Route::get('/warnings', [AdminWarningController::class, 'index'])->name('warnings.index');
            Route::get('/users/{user}/warnings', [AdminWarningController::class, 'forIntern'])->name('users.warnings.index');
            Route::post('/users/{user}/warnings', [AdminWarningController::class, 'store'])->name('users.warnings.store');
            Route::put('/warnings/{warning}', [AdminWarningController::class, 'update'])->name('warnings.update');

            Route::get('/settings/work-hours', [AdminWorkHourController::class, 'show'])->name('work-hours.show');
            Route::post('/settings/work-hours', [AdminWorkHourController::class, 'store'])->name('work-hours.store');
            Route::get('/holidays', [AdminHolidayController::class, 'index'])->name('holidays.index');
            Route::post('/holidays', [AdminHolidayController::class, 'store'])->name('holidays.store');
            Route::put('/holidays/{holiday}', [AdminHolidayController::class, 'update'])->name('holidays.update');
            Route::delete('/holidays/{holiday}', [AdminHolidayController::class, 'destroy'])->name('holidays.destroy');

            Route::post('/users/{user}/reset-password', ResetPasswordController::class)
                ->name('users.reset-password');
        });
    });
});

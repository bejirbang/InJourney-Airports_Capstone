<?php

use App\Http\Controllers\Admin\AirportController as AdminAirportController;
use App\Http\Controllers\Admin\AnnouncementController as AdminAnnouncementController;
use App\Http\Controllers\Admin\AssessmentController as AdminAssessmentController;
use App\Http\Controllers\Admin\AttendanceController as AdminAttendanceController;
use App\Http\Controllers\Admin\AuditLogController as AdminAuditLogController;
use App\Http\Controllers\Admin\CorrectionController as AdminCorrectionController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\EndingInternshipController as AdminEndingInternshipController;
use App\Http\Controllers\Admin\GeneralSettingController as AdminGeneralSettingController;
use App\Http\Controllers\Admin\HolidayController as AdminHolidayController;
use App\Http\Controllers\Admin\InternRecordController as AdminInternRecordController;
use App\Http\Controllers\Admin\LeaveController as AdminLeaveController;
use App\Http\Controllers\Admin\MenuController as AdminMenuController;
use App\Http\Controllers\Admin\OfficeController as AdminOfficeController;
use App\Http\Controllers\Admin\PresentationController as AdminPresentationController;
use App\Http\Controllers\Admin\ReportController as AdminReportController;
use App\Http\Controllers\Admin\ResetPasswordController;
use App\Http\Controllers\Admin\UnitController as AdminUnitController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\WarningController as AdminWarningController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\ProfileController;
use App\Http\Controllers\Intern\AssessmentController as InternAssessmentController;
use App\Http\Controllers\Intern\AttendanceController as InternAttendanceController;
use App\Http\Controllers\Intern\AttendanceCorrectionController as InternCorrectionController;
use App\Http\Controllers\Intern\DashboardController as InternDashboardController;
use App\Http\Controllers\Intern\LeaveController as InternLeaveController;
use App\Http\Controllers\Intern\LogbookController as InternLogbookController;
use App\Http\Controllers\Intern\MenuController as InternMenuController;
use App\Http\Controllers\Intern\OfficeController as InternOfficeController;
use App\Http\Controllers\Intern\PresentationController as InternPresentationController;
use App\Http\Controllers\Intern\WarningController as InternWarningController;
use App\Http\Controllers\Mentor\AssessmentController as MentorAssessmentController;
use App\Http\Controllers\Mentor\CorrectionController as MentorCorrectionController;
use App\Http\Controllers\Mentor\DashboardController as MentorDashboardController;
use App\Http\Controllers\Mentor\InternController as MentorInternController;
use App\Http\Controllers\Mentor\LeaveCalendarController as MentorLeaveCalendarController;
use App\Http\Controllers\Mentor\LeaveController as MentorLeaveController;
use App\Http\Controllers\Mentor\LogbookController as MentorLogbookController;
use App\Http\Controllers\Mentor\MenuController as MentorMenuController;
use App\Http\Controllers\Mentor\PerformanceController as MentorPerformanceController;
use App\Http\Controllers\Shared\AnnouncementController;
use App\Http\Controllers\Shared\ChatController;
use App\Http\Controllers\Shared\NotificationController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('auth.login');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::put('/auth/password', [AuthController::class, 'changePassword'])->name('auth.password');

    Route::middleware('password.changed')->group(function () {
        Route::put('/auth/profile', [ProfileController::class, 'update'])->name('auth.profile.update');

        Route::get('/announcements/{announcement}', [AnnouncementController::class, 'show'])->name('announcements.show');

        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->whereNumber('notification')->name('notifications.read');

        Route::get('/chats', [ChatController::class, 'index'])->name('chats.index');
        Route::get('/chats/contacts', [ChatController::class, 'contacts'])->name('chats.contacts');
        Route::get('/chats/{user}/messages', [ChatController::class, 'messages'])->whereNumber('user')->name('chats.messages');
        Route::post('/chats/{user}/messages', [ChatController::class, 'send'])->whereNumber('user')->middleware('throttle:60,1')->name('chats.send');
        Route::post('/chats/{user}/read', [ChatController::class, 'read'])->whereNumber('user')->name('chats.read');

        Route::middleware('role:intern')->prefix('intern')->name('intern.')->group(function () {
            Route::get('/menu', InternMenuController::class)->name('menu');
            Route::get('/dashboard', InternDashboardController::class)->name('dashboard');
            Route::get('/offices', [InternOfficeController::class, 'index'])->name('offices.index');
            Route::post('/attendance/clock-in', [InternAttendanceController::class, 'clockIn'])->name('attendance.clock-in');
            Route::post('/attendance/clock-out', [InternAttendanceController::class, 'clockOut'])->name('attendance.clock-out');
            Route::get('/attendance', [InternAttendanceController::class, 'history'])->name('attendance.history');
            Route::get('/attendance/days/{date}', [InternAttendanceController::class, 'day'])->name('attendance.day');

            Route::get('/logbooks', [InternLogbookController::class, 'index'])->name('logbooks.index');
            Route::get('/logbooks/{date}', [InternLogbookController::class, 'show'])->name('logbooks.show');
            Route::put('/logbooks/{date}', [InternLogbookController::class, 'update'])->name('logbooks.update');

            Route::get('/attendance-corrections', [InternCorrectionController::class, 'index'])->name('corrections.index');
            Route::post('/attendance-corrections', [InternCorrectionController::class, 'store'])->name('corrections.store');
            Route::get('/attendance-corrections/{correction}', [InternCorrectionController::class, 'show'])->whereNumber('correction')->name('corrections.show');
            Route::post('/attendance-corrections/{correction}/cancel', [InternCorrectionController::class, 'cancel'])->name('corrections.cancel');

            Route::get('/leaves', [InternLeaveController::class, 'index'])->name('leaves.index');
            Route::get('/leaves/working-days', [InternLeaveController::class, 'workingDays'])->name('leaves.working-days');
            Route::post('/leaves', [InternLeaveController::class, 'store'])->name('leaves.store');
            Route::get('/leaves/{leave}', [InternLeaveController::class, 'show'])->whereNumber('leave')->name('leaves.show');
            Route::post('/leaves/{leave}/cancel', [InternLeaveController::class, 'cancel'])->name('leaves.cancel');

            Route::get('/presentation', [InternPresentationController::class, 'show'])->name('presentation.show');
            Route::put('/presentation', [InternPresentationController::class, 'update'])->name('presentation.update');
            Route::get('/assessment', InternAssessmentController::class)->name('assessment');
            Route::get('/warnings', InternWarningController::class)->name('warnings');
        });

        Route::middleware('role:mentor')->prefix('mentor')->name('mentor.')->group(function () {
            Route::get('/menu', MentorMenuController::class)->name('menu');
            Route::get('/dashboard', MentorDashboardController::class)->name('dashboard');

            Route::get('/interns', [MentorInternController::class, 'index'])->name('interns.index');
            Route::get('/interns/{intern}', [MentorInternController::class, 'show'])->whereNumber('intern')->name('interns.show');
            Route::get('/interns/{intern}/attendance', [MentorInternController::class, 'attendance'])->name('interns.attendance');
            Route::get('/interns/{intern}/attendance/days/{date}', [MentorInternController::class, 'day'])->name('interns.attendance.day');
            Route::get('/interns/{intern}/logbooks', [MentorInternController::class, 'logbooks'])->name('interns.logbooks');
            Route::get('/interns/{intern}/leaves', [MentorInternController::class, 'leaves'])->name('interns.leaves');
            Route::get('/interns/{intern}/corrections', [MentorInternController::class, 'corrections'])->name('interns.corrections');
            Route::get('/interns/{intern}/warnings', [MentorInternController::class, 'warnings'])->name('interns.warnings');

            Route::get('/logbooks', [MentorLogbookController::class, 'index'])->name('logbooks.index');
            Route::post('/logbooks/approve', [MentorLogbookController::class, 'approveMany'])->name('logbooks.approve-many');
            Route::get('/logbooks/{logbook}', [MentorLogbookController::class, 'show'])->whereNumber('logbook')->name('logbooks.show');
            Route::post('/logbooks/{logbook}/approve', [MentorLogbookController::class, 'approve'])->whereNumber('logbook')->name('logbooks.approve');
            Route::post('/logbooks/{logbook}/revise', [MentorLogbookController::class, 'revise'])->whereNumber('logbook')->name('logbooks.revise');

            Route::get('/corrections', [MentorCorrectionController::class, 'index'])->name('corrections.index');
            Route::get('/corrections/{correction}', [MentorCorrectionController::class, 'show'])->whereNumber('correction')->name('corrections.show');
            Route::post('/corrections/{correction}/approve', [MentorCorrectionController::class, 'approve'])->name('corrections.approve');
            Route::post('/corrections/{correction}/reject', [MentorCorrectionController::class, 'reject'])->name('corrections.reject');

            Route::get('/leaves', [MentorLeaveController::class, 'index'])->name('leaves.index');
            Route::get('/leaves/{leave}', [MentorLeaveController::class, 'show'])->whereNumber('leave')->name('leaves.show');
            Route::post('/leaves/{leave}/approve', [MentorLeaveController::class, 'approve'])->name('leaves.approve');
            Route::post('/leaves/{leave}/reject', [MentorLeaveController::class, 'reject'])->name('leaves.reject');

            Route::get('/leave-calendar', MentorLeaveCalendarController::class)->name('leave-calendar');
            Route::get('/performance', MentorPerformanceController::class)->name('performance');

            Route::get('/assessments', [MentorAssessmentController::class, 'index'])->name('assessments.index');
            Route::get('/assessments/{intern}', [MentorAssessmentController::class, 'show'])->whereNumber('intern')->name('assessments.show');
            Route::put('/assessments/{intern}', [MentorAssessmentController::class, 'update'])->whereNumber('intern')->name('assessments.update');
            Route::post('/assessments/{intern}/submit', [MentorAssessmentController::class, 'submit'])->whereNumber('intern')->name('assessments.submit');
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
            Route::get('/users/{user}/logbooks', [AdminInternRecordController::class, 'logbooks'])->name('users.logbooks');

            Route::get('/attendance', [AdminAttendanceController::class, 'index'])->name('attendance.index');
            Route::get('/attendance/daily', [AdminAttendanceController::class, 'daily'])->name('attendance.daily');

            Route::get('/corrections', [AdminCorrectionController::class, 'index'])->name('corrections.index');
            Route::get('/corrections/{correction}', [AdminCorrectionController::class, 'show'])->whereNumber('correction')->name('corrections.show');
            Route::post('/corrections/{correction}/approve', [AdminCorrectionController::class, 'approve'])->name('corrections.approve');
            Route::post('/corrections/{correction}/reject', [AdminCorrectionController::class, 'reject'])->name('corrections.reject');

            Route::get('/leaves', [AdminLeaveController::class, 'index'])->name('leaves.index');
            Route::get('/leaves/{leave}', [AdminLeaveController::class, 'show'])->whereNumber('leave')->name('leaves.show');
            Route::post('/leaves/{leave}/approve', [AdminLeaveController::class, 'approve'])->name('leaves.approve');
            Route::post('/leaves/{leave}/reject', [AdminLeaveController::class, 'reject'])->name('leaves.reject');

            Route::get('/presentations', [AdminPresentationController::class, 'index'])->name('presentations.index');
            Route::get('/presentations/{presentation}', [AdminPresentationController::class, 'show'])->whereNumber('presentation')->name('presentations.show');
            Route::post('/presentations/{presentation}/approve', [AdminPresentationController::class, 'approve'])->whereNumber('presentation')->name('presentations.approve');
            Route::post('/presentations/{presentation}/revise', [AdminPresentationController::class, 'revise'])->whereNumber('presentation')->name('presentations.revise');

            Route::get('/assessments', [AdminAssessmentController::class, 'index'])->name('assessments.index');
            Route::get('/assessments/{user}', [AdminAssessmentController::class, 'show'])->whereNumber('user')->name('assessments.show');

            Route::get('/warnings', [AdminWarningController::class, 'index'])->name('warnings.index');
            Route::get('/users/{user}/warnings', [AdminWarningController::class, 'forIntern'])->name('users.warnings.index');
            Route::post('/users/{user}/warnings', [AdminWarningController::class, 'store'])->name('users.warnings.store');
            Route::put('/warnings/{warning}', [AdminWarningController::class, 'update'])->name('warnings.update');

            Route::get('/holidays', [AdminHolidayController::class, 'index'])->name('holidays.index');
            Route::post('/holidays', [AdminHolidayController::class, 'store'])->name('holidays.store');
            Route::put('/holidays/{holiday}', [AdminHolidayController::class, 'update'])->name('holidays.update');
            Route::delete('/holidays/{holiday}', [AdminHolidayController::class, 'destroy'])->name('holidays.destroy');

            Route::get('/settings', [AdminGeneralSettingController::class, 'show'])->name('settings.show');
            Route::put('/settings', [AdminGeneralSettingController::class, 'update'])->name('settings.update');

            Route::get('/units', [AdminUnitController::class, 'index'])->name('units.index');
            Route::post('/units', [AdminUnitController::class, 'store'])->name('units.store');
            Route::put('/units/{unit}', [AdminUnitController::class, 'update'])->whereNumber('unit')->name('units.update');
            Route::post('/units/{unit}/deactivate', [AdminUnitController::class, 'deactivate'])->whereNumber('unit')->name('units.deactivate');
            Route::post('/units/{unit}/activate', [AdminUnitController::class, 'activate'])->whereNumber('unit')->name('units.activate');

            Route::get('/airports', [AdminAirportController::class, 'index'])->name('airports.index');
            Route::post('/airports', [AdminAirportController::class, 'store'])->name('airports.store');
            Route::get('/airports/{airport}', [AdminAirportController::class, 'show'])->whereNumber('airport')->name('airports.show');
            Route::put('/airports/{airport}', [AdminAirportController::class, 'update'])->whereNumber('airport')->name('airports.update');
            Route::post('/airports/{airport}/deactivate', [AdminAirportController::class, 'deactivate'])->whereNumber('airport')->name('airports.deactivate');
            Route::post('/airports/{airport}/activate', [AdminAirportController::class, 'activate'])->whereNumber('airport')->name('airports.activate');
            Route::get('/airports/{airport}/weekly-schedules', [AdminAirportController::class, 'weeklyHistory'])->whereNumber('airport')->name('airports.weekly.index');
            Route::put('/airports/{airport}/weekly-schedule', [AdminAirportController::class, 'saveWeekly'])->whereNumber('airport')->name('airports.weekly.save');
            Route::get('/airports/{airport}/special-schedules', [AdminAirportController::class, 'specials'])->whereNumber('airport')->name('airports.specials.index');
            Route::post('/airports/{airport}/special-schedules', [AdminAirportController::class, 'storeSpecial'])->whereNumber('airport')->name('airports.specials.store');
            Route::put('/special-schedules/{special}', [AdminAirportController::class, 'updateSpecial'])->whereNumber('special')->name('specials.update');
            Route::delete('/special-schedules/{special}', [AdminAirportController::class, 'destroySpecial'])->whereNumber('special')->name('specials.destroy');

            Route::get('/offices', [AdminOfficeController::class, 'index'])->name('offices.index');
            Route::post('/offices', [AdminOfficeController::class, 'store'])->name('offices.store');
            Route::get('/offices/{office}', [AdminOfficeController::class, 'show'])->name('offices.show');
            Route::put('/offices/{office}', [AdminOfficeController::class, 'update'])->name('offices.update');
            Route::post('/offices/{office}/deactivate', [AdminOfficeController::class, 'deactivate'])->name('offices.deactivate');
            Route::post('/offices/{office}/activate', [AdminOfficeController::class, 'activate'])->name('offices.activate');

            Route::get('/announcements', [AdminAnnouncementController::class, 'index'])->name('announcements.index');
            Route::post('/announcements', [AdminAnnouncementController::class, 'store'])->name('announcements.store');
            Route::put('/announcements/{announcement}', [AdminAnnouncementController::class, 'update'])->name('announcements.update');
            Route::delete('/announcements/{announcement}', [AdminAnnouncementController::class, 'destroy'])->name('announcements.destroy');

            Route::get('/reports/options', [AdminReportController::class, 'options'])->name('reports.options');
            Route::post('/reports/preview', [AdminReportController::class, 'preview'])->name('reports.preview');
            Route::post('/reports/export', [AdminReportController::class, 'export'])->name('reports.export');
            Route::post('/reports/attendance-pdf', [AdminReportController::class, 'attendancePdf'])->name('reports.attendance-pdf');
            Route::post('/reports/assessment-pdf', [AdminReportController::class, 'assessmentPdf'])->name('reports.assessment-pdf');

            Route::get('/audit-logs', [AdminAuditLogController::class, 'index'])->name('audit-logs.index');
            Route::get('/audit-logs/options', [AdminAuditLogController::class, 'options'])->name('audit-logs.options');

            Route::post('/users/{user}/reset-password', ResetPasswordController::class)
                ->name('users.reset-password');
        });
    });
});

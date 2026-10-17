<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Pengingat Task lewat tenggat lebih dari 2 hari kerja (docs/design-mentor.md 7.6), pagi hari waktu Jakarta.
Schedule::command('app:remind-overdue-tasks')->dailyAt('07:00')->withoutOverlapping();

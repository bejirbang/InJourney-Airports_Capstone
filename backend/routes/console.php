<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('app:remind-overdue-leaves')->hourly()->withoutOverlapping();

Schedule::command('app:remind-ending-internships')->dailyAt('07:00')->withoutOverlapping();

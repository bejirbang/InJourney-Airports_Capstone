<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Pengingat Task lewat tenggat lebih dari 2 hari kerja (docs/design-mentor.md 7.6), pagi hari waktu Jakarta.
Schedule::command('app:remind-overdue-tasks')->dailyAt('07:00')->withoutOverlapping();

// Izin belum diproses mentor lebih dari 24 jam (docs/design-admin.md 14). Batasnya per jam, jadi dicek tiap jam.
Schedule::command('app:remind-overdue-leaves')->hourly()->withoutOverlapping();

// Magang berakhir dalam 7 hari (docs/design-admin.md 14, Alur 6). Rentangnya per hari, jadi cukup sekali tiap pagi.
Schedule::command('app:remind-ending-internships')->dailyAt('07:00')->withoutOverlapping();

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('airport_weekly_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('airport_id')->constrained('airports')->restrictOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->boolean('is_workday');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->date('effective_from');
            $table->timestamps();

            $table->unique(['airport_id', 'day_of_week', 'effective_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('airport_weekly_schedules');
    }
};

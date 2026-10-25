<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('airport_special_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('airport_id')->constrained('airports')->restrictOnDelete();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->timestamps();

            $table->index(['airport_id', 'start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('airport_special_schedules');
    }
};

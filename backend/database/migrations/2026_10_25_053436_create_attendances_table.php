<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intern_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('clock_in_office_id')->nullable()->constrained('offices')->restrictOnDelete();
            $table->foreignId('clock_out_office_id')->nullable()->constrained('offices')->restrictOnDelete();
            $table->date('date');
            $table->time('clock_in_at')->nullable();
            $table->time('clock_out_at')->nullable();
            $table->decimal('clock_in_latitude', 10, 7)->nullable();
            $table->decimal('clock_in_longitude', 10, 7)->nullable();
            $table->decimal('clock_out_latitude', 10, 7)->nullable();
            $table->decimal('clock_out_longitude', 10, 7)->nullable();
            $table->time('scheduled_start');
            $table->time('scheduled_end');
            $table->unsignedSmallInteger('late_tolerance_minutes');
            $table->boolean('is_corrected')->default(false);
            $table->foreignId('correction_id')->nullable()->constrained('attendance_corrections')->nullOnDelete();
            $table->timestamps();

            $table->unique(['intern_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('attendance_corrections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intern_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->time('recorded_clock_in')->nullable();
            $table->time('recorded_clock_out')->nullable();
            $table->time('requested_clock_in');
            $table->time('requested_clock_out');
            $table->text('reason');
            $table->string('evidence_path')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending')->index();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('decision_note')->nullable();
            $table->time('final_clock_in')->nullable();
            $table->time('final_clock_out')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->index(['intern_id', 'date']);
        });

        // Satu intern hanya boleh punya satu koreksi Pending untuk satu tanggal.
        DB::statement("CREATE UNIQUE INDEX attendance_corrections_one_pending_unique ON attendance_corrections (intern_id, date) WHERE status = 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_corrections');
    }
};

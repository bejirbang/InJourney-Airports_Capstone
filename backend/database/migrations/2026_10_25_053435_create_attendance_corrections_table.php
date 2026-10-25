<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_corrections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intern_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('date');
            $table->enum('recorded_status', ['present', 'late', 'missed_clock_in', 'absent']);
            $table->boolean('recorded_missed_clock_out')->default(false);
            $table->text('reason');
            $table->enum('status', ['pending_mentor', 'rejected_by_mentor', 'pending_admin', 'approved', 'rejected_by_admin', 'cancelled'])
                ->default('pending_mentor')
                ->index();
            $table->text('mentor_note')->nullable();
            $table->timestamp('mentor_decided_at')->nullable();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('admin_note')->nullable();
            $table->timestamp('admin_decided_at')->nullable();
            $table->timestamps();

            $table->index(['intern_id', 'date']);
            $table->index(['mentor_id', 'status']);
        });

        // Satu intern hanya boleh punya satu koreksi aktif (menunggu mentor atau admin) untuk satu tanggal.
        DB::statement("CREATE UNIQUE INDEX attendance_corrections_one_active_unique ON attendance_corrections (intern_id, date) WHERE status IN ('pending_mentor', 'pending_admin')");
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_corrections');
    }
};

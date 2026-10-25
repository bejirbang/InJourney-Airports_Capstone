<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intern_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentor_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('airport_id')->constrained('airports')->restrictOnDelete();
            $table->string('university');
            $table->string('major');
            $table->date('start_date');
            $table->date('end_date');
            $table->date('leave_quota_since');
            $table->timestamp('presentation_reminded_at')->nullable();
            $table->date('ending_notified_for')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intern_profiles');
    }
};

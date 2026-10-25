<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('final_presentations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intern_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('evidence_url', 2048);
            $table->enum('status', ['pending', 'approved', 'revision'])->default('pending')->index();
            $table->timestamp('submitted_at');
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('decision_note')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('final_presentations');
    }
};

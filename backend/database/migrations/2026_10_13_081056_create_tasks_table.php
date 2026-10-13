<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('title');
            $table->text('description');
            $table->foreignId('intern_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('mentor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('due_at');
            $table->enum('status', ['todo', 'in_progress', 'in_review', 'done'])->default('todo');
            $table->string('submission_link', 2048)->nullable();
            $table->string('submission_file_path')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->boolean('ever_submitted')->default(false);
            $table->boolean('revise_pending')->default(false);
            $table->unsignedInteger('revision_count')->default(0);
            $table->timestamp('done_at')->nullable();
            $table->timestamps();

            $table->index(['intern_id', 'status']);
            $table->index(['mentor_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penanda pengingat "lewat tenggat lebih dari 2 hari kerja" sudah dikirim ke mentor,
     * agar pengingat hanya sekali per Task (docs/design-mentor.md 7.6).
     */
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->timestamp('overdue_reminded_at')->nullable()->after('done_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('overdue_reminded_at');
        });
    }
};

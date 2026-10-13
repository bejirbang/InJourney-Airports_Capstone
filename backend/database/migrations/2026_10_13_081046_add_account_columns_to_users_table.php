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
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['intern', 'mentor', 'admin'])->index();
            $table->string('title');
            $table->string('phone')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('must_change_password')->default(true);
            $table->softDeletes();
            $table->dropUnique(['email']);
        });

        // Email akun yang sudah dihapus (soft delete) boleh dipakai lagi.
        DB::statement('CREATE UNIQUE INDEX users_email_active_unique ON users (email) WHERE deleted_at IS NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX users_email_active_unique');

        Schema::table('users', function (Blueprint $table) {
            $table->unique('email');
            $table->dropIndex(['role']);
            $table->dropSoftDeletes();
            $table->dropColumn(['role', 'title', 'phone', 'is_active', 'must_change_password']);
        });
    }
};

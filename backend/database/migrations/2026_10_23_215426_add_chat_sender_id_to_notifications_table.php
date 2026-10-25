<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Unik per penerima dan pengirim; baris notifikasi lain berisi NULL sehingga tidak terkena aturan unik.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('chat_sender_id')->nullable()->after('announcement_id')->constrained('users')->cascadeOnDelete();
            $table->unique(['user_id', 'chat_sender_id']);
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'chat_sender_id']);
            $table->dropConstrainedForeignId('chat_sender_id');
        });
    }
};

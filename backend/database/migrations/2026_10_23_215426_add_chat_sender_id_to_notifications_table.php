<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Notifikasi "Pesan baru dari ..." satu baris per pengirim (keputusan pemilik repo 23 Okt 2026): pesan berikutnya
     * dari orang yang sama memperbarui baris itu, bukan menambah baris. Unik per penerima dan pengirim; baris
     * notifikasi lain berisi NULL dan tidak terkena aturan unik.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('chat_sender_id')->nullable()->after('announcement_id')->constrained('users')->cascadeOnDelete();
            $table->unique(['user_id', 'chat_sender_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'chat_sender_id']);
            $table->dropConstrainedForeignId('chat_sender_id');
        });
    }
};

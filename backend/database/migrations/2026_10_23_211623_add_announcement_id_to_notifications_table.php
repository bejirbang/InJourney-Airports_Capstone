<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Notifikasi pengumuman mengikuti pengumumannya (keputusan pemilik repo 23 Okt 2026): judul yang diubah
     * ikut berubah di lonceng, dan notifikasi ikut terhapus saat pengumuman dihapus.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('announcement_id')->nullable()->after('user_id')->constrained('announcements')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('announcement_id');
        });
    }
};

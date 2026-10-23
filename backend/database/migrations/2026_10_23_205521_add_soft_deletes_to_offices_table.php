<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kantor nonaktif boleh dihapus admin (keputusan pemilik repo 23 Okt 2026). Penghapusan bersifat soft delete
     * agar riwayat absensi tetap menunjuk kantornya. Nama hanya unik di antara kantor yang belum dihapus, tanpa
     * beda huruf besar, sehingga nama kantor yang dihapus boleh dipakai lagi.
     */
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->softDeletes();
            $table->dropUnique(['name']);
        });

        // Indeks parsial dengan ekspresi didukung PostgreSQL dan SQLite (test).
        DB::statement('CREATE UNIQUE INDEX offices_name_unique ON offices (LOWER(name)) WHERE deleted_at IS NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX offices_name_unique');

        Schema::table('offices', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->unique('name');
        });
    }
};

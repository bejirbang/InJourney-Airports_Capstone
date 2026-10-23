<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tanggal selesai yang sudah diingatkan ke admin ("Magang ... berakhir dalam 7 hari.", docs/design-admin.md 14).
     * Disimpan tanggalnya, bukan waktu kirim, agar setelah diperpanjang pengingat dikirim lagi untuk tanggal baru.
     */
    public function up(): void
    {
        Schema::table('intern_profiles', function (Blueprint $table) {
            $table->date('ending_notified_for')->nullable()->after('end_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('intern_profiles', function (Blueprint $table) {
            $table->dropColumn('ending_notified_for');
        });
    }
};

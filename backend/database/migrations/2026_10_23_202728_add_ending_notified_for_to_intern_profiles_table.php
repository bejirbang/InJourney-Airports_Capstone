<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Disimpan tanggalnya, bukan waktu kirim, agar setelah diperpanjang pengingat dikirim lagi untuk tanggal baru.
     */
    public function up(): void
    {
        Schema::table('intern_profiles', function (Blueprint $table) {
            $table->date('ending_notified_for')->nullable()->after('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('intern_profiles', function (Blueprint $table) {
            $table->dropColumn('ending_notified_for');
        });
    }
};

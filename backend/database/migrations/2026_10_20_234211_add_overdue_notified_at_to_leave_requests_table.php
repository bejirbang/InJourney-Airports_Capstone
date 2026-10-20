<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penanda notifikasi "Izin ... belum diproses mentor lebih dari 24 jam." sudah dikirim ke admin,
     * agar pengingat hanya sekali per izin (docs/design-admin.md 14).
     */
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->timestamp('overdue_notified_at')->nullable()->after('decided_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropColumn('overdue_notified_at');
        });
    }
};

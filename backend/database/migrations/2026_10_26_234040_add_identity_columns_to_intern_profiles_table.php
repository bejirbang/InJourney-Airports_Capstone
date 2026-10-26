<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intern_profiles', function (Blueprint $table) {
            $table->enum('institution_type', ['universitas', 'sekolah'])->nullable()->after('user_id');
            $table->string('student_number', 30)->nullable()->after('major'); // NIM / NIS
        });
    }

    public function down(): void
    {
        Schema::table('intern_profiles', function (Blueprint $table) {
            $table->dropColumn(['institution_type', 'student_number']);
        });
    }
};

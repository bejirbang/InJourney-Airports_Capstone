<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('airport_id')->constrained('airports')->restrictOnDelete();
            $table->string('name');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->unsignedInteger('clock_in_radius_meters');
            $table->unsignedInteger('clock_out_radius_meters');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::statement('CREATE UNIQUE INDEX offices_airport_name_unique ON offices (airport_id, LOWER(name))');
    }

    public function down(): void
    {
        Schema::dropIfExists('offices');
    }
};

<?php

namespace Database\Seeders;

use App\Models\Airport;
use App\Models\AssessmentIndicator;
use App\Models\Office;
use App\Models\Unit;
use App\Models\User;
use App\Services\SystemSettings;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public const UNITS = ['Divisi IT', 'Human Capital', 'Operasional Bandara', 'Keuangan'];

    /** Sembilan indikator formulir Penilaian Magang, urut sesuai formulir: [kategori, indikator]. */
    public const INDICATORS = [
        ['Motivasi', 'Perhatian terhadap Instruksi/Petunjuk'],
        ['Motivasi', 'Disiplin Kerja'],
        ['Motivasi', 'Inisiatif'],
        ['Kemampuan Kerja', 'Pengetahuan tentang Pekerjaan'],
        ['Kemampuan Kerja', 'Kualitas Pekerjaan / Keterampilan'],
        ['Kemampuan Kerja', 'Efektivitas Penggunaan Waktu Kerja'],
        ['Kepribadian', 'Keberhasilan'],
        ['Kepribadian', 'Kemampuan Menyesuaikan Diri dengan Lingkungan'],
        ['Kepribadian', 'Tanggung Jawab'],
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Seeder data contoh tidak boleh dijalankan di production.');
        }

        SystemSettings::seedDefaults();

        $units = collect(self::UNITS)->mapWithKeys(fn (string $name): array => [$name => Unit::factory()->create(['name' => $name])]);

        foreach (self::INDICATORS as $order => [$category, $name]) {
            AssessmentIndicator::factory()->create(['category' => $category, 'name' => $name, 'weight' => null, 'sort_order' => $order + 1]);
        }

        // Jadwal mingguan bawaan factory: Senin-Jumat 08:00-17:00.
        $soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta', 'city' => 'Tangerang']);
        $halim = Airport::factory()->create(['name' => 'Halim Perdanakusuma', 'city' => 'Jakarta']);

        foreach ([['Terminal 1', -6.1270, 106.6531], ['Terminal 2', -6.1240, 106.6610], ['Terminal 3', -6.1197, 106.6635]] as [$name, $lat, $lng]) {
            Office::factory()->for($soetta)->create(['name' => $name, 'latitude' => $lat, 'longitude' => $lng]);
        }

        Office::factory()->for($halim)->create(['name' => 'Terminal Utama', 'latitude' => -6.2655, 'longitude' => 106.8908]);

        User::factory()->admin()->create([
            'name' => 'Admin Contoh',
            'email' => 'admin@injourney.test',
        ]);

        $mentor = User::factory()->mentor()->create([
            'name' => 'Mentor Contoh',
            'email' => 'mentor@injourney.test',
            'unit_id' => $units['Divisi IT']->id,
        ]);

        User::factory()->intern(['mentor_id' => $mentor->id, 'airport_id' => $soetta->id])->create([
            'name' => 'Intern Contoh',
            'email' => 'intern@injourney.test',
            'unit_id' => $units['Divisi IT']->id,
        ]);

        User::factory()->intern([
            'mentor_id' => $mentor->id,
            'airport_id' => $halim->id,
            'institution_type' => 'universitas',
            'university' => 'Institut Teknologi Bandung',
            'major' => 'Sistem Informasi',
            'student_number' => '18221001',
        ])->mustChangePassword()->create([
            'name' => 'Intern Baru',
            'email' => 'intern.baru@injourney.test',
            'unit_id' => $units['Operasional Bandara']->id,
        ]);
    }
}

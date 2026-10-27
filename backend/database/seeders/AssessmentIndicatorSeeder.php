<?php

namespace Database\Seeders;

use App\Models\AssessmentIndicator;
use Illuminate\Database\Seeder;

/**
 * Sembilan indikator formulir Penilaian Magang mitra. Dipakai DatabaseSeeder dan ProductionSeeder; aman dijalankan
 * ulang karena dicocokkan berdasarkan nama.
 */
class AssessmentIndicatorSeeder extends Seeder
{
    /** Urut sesuai formulir: [kategori, indikator]. */
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
        foreach (self::INDICATORS as $order => [$category, $name]) {
            AssessmentIndicator::query()->updateOrCreate(
                ['name' => $name],
                ['category' => $category, 'weight' => null, 'sort_order' => $order + 1],
            );
        }
    }
}

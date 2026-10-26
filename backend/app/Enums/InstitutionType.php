<?php

namespace App\Enums;

/**
 * Nilai mengikuti dokumen perubahan 26 Okt 2026 (`universitas`, `sekolah`), bukan kode bahasa Inggris.
 */
enum InstitutionType: string
{
    case University = 'universitas';
    case School = 'sekolah';

    /**
     * Label kolom asal dan nomor induk di dokumen PDF.
     */
    public function originLabel(): string
    {
        return match ($this) {
            self::University => 'Asal Universitas',
            self::School => 'Asal Sekolah',
        };
    }

    public function numberLabel(): string
    {
        return match ($this) {
            self::University => 'NIM',
            self::School => 'NIS',
        };
    }
}

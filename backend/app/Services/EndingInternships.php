<?php

namespace App\Services;

use App\Models\InternProfile;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Daftar "Magang berakhir dalam 7 hari" (docs/design-admin.md 5.2 dan Alur 6). Dashboard menampilkan
 * maksimal 5 baris, all() untuk Lihat semua. Baris berisi mentor untuk tombol Tanya mentor.
 */
class EndingInternships
{
    /**
     * @return Builder<InternProfile>
     */
    public function query(CarbonInterface $now): Builder
    {
        return InternProfile::query()->endingSoon($now->toDateString());
    }

    /**
     * Paling dekat tanggal selesainya lebih dulu.
     *
     * @return Builder<InternProfile>
     */
    public function ordered(CarbonInterface $now): Builder
    {
        return $this->query($now)->with(['user:id,name', 'mentor:id,name'])->orderBy('end_date')->orderBy('id');
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function all(CarbonInterface $now): array
    {
        return array_values($this->ordered($now)->get()->map(fn (InternProfile $profile): array => $this->row($profile, $now))->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function row(InternProfile $profile, CarbonInterface $now): array
    {
        $intern = $profile->user;

        return [
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'end_date' => $profile->end_date->toDateString(),
            // 0 = hari ini hari terakhir magang.
            'ends_in_days' => $profile->daysLeft($now),
            'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
        ];
    }
}

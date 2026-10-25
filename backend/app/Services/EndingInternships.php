<?php

namespace App\Services;

use App\Models\InternProfile;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

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
            'ends_in_days' => $profile->daysLeft($now),
            'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
        ];
    }
}

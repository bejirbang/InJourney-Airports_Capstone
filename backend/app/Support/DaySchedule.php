<?php

namespace App\Support;

/**
 * Jadwal kerja satu tanggal untuk satu bandara. Jam disimpan "H:i:s" seperti kolom time.
 */
final readonly class DaySchedule
{
    public function __construct(
        public bool $isWorkday,
        public ?string $start = null,
        public ?string $end = null,
        public ?string $holidayName = null,
        public ?string $specialName = null,
    ) {}

    public static function off(?string $holidayName = null): self
    {
        return new self(false, holidayName: $holidayName);
    }

    /**
     * @return array{start: string, end: string}|null
     */
    public function hours(): ?array
    {
        if (! $this->isWorkday || $this->start === null || $this->end === null) {
            return null;
        }

        return ['start' => substr($this->start, 0, 5), 'end' => substr($this->end, 0, 5)];
    }
}

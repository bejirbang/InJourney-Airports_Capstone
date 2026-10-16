<?php

use App\Support\Duration;

it('formats minutes in Indonesian, converting 60 minutes or more to hours', function (int $minutes, string $text) {
    expect(Duration::minutes($minutes))->toBe($text);
})->with([
    [1, '1 menit'],
    [45, '45 menit'],
    [59, '59 menit'],
    [60, '1 jam'],
    [61, '1 jam 1 menit'],
    [150, '2 jam 30 menit'],
    [540, '9 jam'],
]);

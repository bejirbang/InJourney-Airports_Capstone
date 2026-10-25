<?php

use App\Rules\GoogleDriveLink;

it('accepts https links on drive.google.com and docs.google.com', function (string $url) {
    expect(GoogleDriveLink::passes($url))->toBeTrue();
})->with([
    'https://drive.google.com/file/d/1AbC/view?usp=sharing',
    'https://drive.google.com/drive/folders/1AbC',
    'https://docs.google.com/document/d/1AbC/edit',
]);

it('rejects links that are not exactly a Google Drive or Docs host over https', function (mixed $value) {
    expect(GoogleDriveLink::passes($value))->toBeFalse();
})->with([
    'host lain' => 'https://dropbox.com/s/surat.pdf',
    'host menyamar' => 'https://drive.google.com.situs-jahat.com/file',
    'subdomain lain' => 'https://evil.drive.google.com/file',
    'http' => 'http://drive.google.com/file/d/1AbC',
    'ada user' => 'https://user@drive.google.com/file/d/1AbC',
    'ada user dan password' => 'https://user:rahasia@drive.google.com/file/d/1AbC',
    'ada port' => 'https://drive.google.com:8443/file/d/1AbC',
    'huruf besar' => 'https://DRIVE.google.com/file/d/1AbC',
    'bukan url' => 'drive.google.com/file/d/1AbC',
    'javascript' => 'javascript:alert(1)',
    'bukan teks' => 123,
]);

it('rejects links longer than 2048 characters', function () {
    $url = 'https://drive.google.com/file/d/'.str_repeat('a', 2048 - 32);

    expect(strlen($url))->toBe(2048)
        ->and(GoogleDriveLink::passes($url))->toBeTrue()
        ->and(GoogleDriveLink::passes($url.'a'))->toBeFalse();
});

it('fails validation with the document message', function () {
    $messages = [];
    (new GoogleDriveLink)->validate('evidence_url', 'https://example.com', function (string $message) use (&$messages): void {
        $messages[] = $message;
    });

    expect($messages[0] ?? null)
        ->toBe('Link harus berupa link Google Drive atau Google Docs, contoh: https://drive.google.com/...');
});

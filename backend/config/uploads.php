<?php

/*
 * Aturan unggah file untuk hasil Task, lampiran izin, dan bukti koreksi
 * (keputusan Draft 2 dan 13 Oktober 2026). Jenis lain dikirim lewat link.
 * File disimpan di disk default (FILESYSTEM_DISK): lokal saat development, Supabase Storage saat production.
 */

return [
    'max_kilobytes' => 2048,

    'mimes' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],

    'messages' => [
        'max' => 'Ukuran file maksimal 2 MB.',
        'mimes' => 'Jenis file tidak diizinkan. Gunakan PDF, Word, Excel, atau PowerPoint.',
        // Hasil Task boleh dikirim lewat link, jadi pesannya menyarankan link (design-intern.md 11.3).
        'mimes_or_link' => 'Jenis file tidak diizinkan. Gunakan PDF, Word, Excel, atau PowerPoint, atau kirim lewat link.',
    ],
];

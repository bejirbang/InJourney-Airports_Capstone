<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | Frontend (TanStack Start) berjalan di origin berbeda dari API saat
    | development, jadi endpoint di bawah perlu mengizinkan origin frontend.
    | Daftar origin dipisah koma lewat FRONTEND_URL. Mode token (Bearer),
    | jadi cookie/kredensial tidak dipakai.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('FRONTEND_URL', 'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8080,http://localhost:8081'))
    ))),

    // Development: Vite bisa pindah port (8080, 8081, ...) bila port dipakai.
    // Production diisi lewat CORS_ORIGIN_PATTERNS (misal domain Vercel).
    // Catatan: jangan panggil app()/helper lain di berkas config, hanya env().
    'allowed_origins_patterns' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env(
            'CORS_ORIGIN_PATTERNS',
            env('APP_ENV', 'local') === 'production' ? '' : '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#'
        ))
    ))),

    'allowed_headers' => ['*'],

    // Nama file export Excel dibaca frontend dari header ini.
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 0,

    'supports_credentials' => false,

];

{{-- Kerangka dokumen PDF (dompdf). Semua teks dari data memakai {{ }} agar ter-escape. --}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>@yield('title')</title>
    <style>
        @page { margin: 28px 36px; }
        body { font-family: "DejaVu Sans", sans-serif; font-size: 10px; color: #111; }
        .kop { text-align: center; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 12px; }
        .kop .company { font-size: 13px; font-weight: bold; letter-spacing: 1px; }
        .kop .region { font-size: 11px; }
        h1 { text-align: center; font-size: 13px; margin: 0 0 12px; text-decoration: underline; }
        table.identity td { padding: 1px 4px 1px 0; vertical-align: top; }
        table.identity td.label { width: 150px; }
        table.grid { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.grid th, table.grid td { border: 1px solid #111; padding: 4px; vertical-align: top; }
        table.grid th { background: #e8e8e8; text-align: center; }
        .center { text-align: center; }
        .nowrap { white-space: nowrap; }
        .multiline { white-space: pre-line; }
        .signatures { width: 100%; margin-top: 24px; page-break-inside: avoid; }
        .signatures td { width: 50%; text-align: center; vertical-align: top; }
        .signatures .space { height: 64px; }
        .signatures .name { font-weight: bold; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="kop">
        <div class="company">INJOURNEY AIRPORTS</div>
        <div class="region">{{ $region }}</div>
    </div>

    @yield('content')
</body>
</html>

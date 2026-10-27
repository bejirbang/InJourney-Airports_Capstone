{{-- Kerangka dokumen PDF (dompdf, CSS 2.1: tata letak memakai tabel). Semua teks dari data memakai {{ }} agar ter-escape.
     Judul dan margin halaman diatur tiap dokumen lewat @section('header') dan @section('style'), mengikuti formulir mitra. --}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>@yield('title')</title>
    <style>
        body { font-family: "DejaVu Sans", sans-serif; font-size: 10pt; line-height: 1.2; color: #000; margin: 0; }
        .title { text-align: center; font-weight: bold; font-size: 10.5pt; line-height: 1.25; }
        table { border-collapse: collapse; }
        table.identity { margin-top: 10mm; }
        table.identity td { padding: 0 0 1mm; vertical-align: top; }
        table.identity td.label { width: 64mm; }
        table.identity td.colon { width: 5mm; }
        table.grid { width: 100%; border: 1.5px solid #000; }
        table.grid th, table.grid td { border: 1px solid #000; vertical-align: top; }
        table.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
        .center { text-align: center; }
        .multiline { white-space: pre-line; }
        .signatures { width: 100%; page-break-inside: avoid; }
        .signatures td { vertical-align: top; padding: 0; }
        .signatures .space { height: 24mm; }
        .signatures .line { width: 42mm; margin: 0 auto; border-bottom: 1px solid #000; text-align: center; padding-bottom: 0.5mm; }
    </style>
    <style>
        @yield('style')
    </style>
</head>
<body>
    @yield('header')

    @yield('content')
</body>
</html>

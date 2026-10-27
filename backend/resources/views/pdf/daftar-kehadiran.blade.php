@extends('pdf.layout')

@section('title', 'Daftar Kehadiran Magang')

@section('style')
    @page { margin: 17mm 16mm 18mm 25mm; }
    .logo { margin-bottom: 6mm; line-height: 1; }
    .logo .word { font-family: Helvetica, sans-serif; font-size: 23pt; color: #7a7b7e; letter-spacing: 0.5pt; }
    .logo .word img { height: 13pt; width: 13pt; }
    .logo .sub { font-family: Helvetica, sans-serif; font-size: 8.5pt; font-weight: bold; color: #28a9b8; letter-spacing: 4.2pt; padding-left: 1mm; }
    .title { margin-right: 7mm; }
    table.month { margin: 1mm auto 0; }
    table.month td { padding: 0; font-weight: bold; }
    table.month td.fill { width: 62mm; border-bottom: 1px solid #000; text-align: center; }
    table.identity { margin-top: 9mm; }
    table.attendance { margin-top: 5mm; }
    table.attendance th { font-size: 10.5pt; padding: 0.2mm 1mm; line-height: 1.1; }
    table.attendance td { font-size: 9pt; padding: 0.3mm 1.2mm; line-height: 1.1; }
    .signatures { margin-top: 6mm; }
@endsection

@section('header')
    {{-- Logo dari berkas lokal (resources/pdf), bukan URL luar. --}}
    <div class="logo">
        <span class="word">inj<img src="data:image/png;base64,{{ base64_encode((string) file_get_contents(resource_path('pdf/injourney-mark.png'))) }}" alt="o">urney</span><br>
        <span class="sub">AIRPORTS</span>
    </div>

    <div class="title">
        DAFTAR KEHADIRAN<br>
        PESERTA MAGANG/PKL PT ANGKASA PURA INDONESIA<br>
        {{ mb_strtoupper($region) }}
        <table class="month">
            <tr><td>BULAN/TAHUN :&nbsp;</td><td class="fill">{{ mb_strtoupper($month_label) }}</td></tr>
        </table>
    </div>
@endsection

@section('content')
    @include('pdf.identity', ['identity' => $identity])

    <table class="grid attendance">
        <thead>
            <tr>
                <th rowspan="2" style="width: 21%;">Tanggal</th>
                <th colspan="2">Jam</th>
                <th rowspan="2">Kegiatan</th>
                <th rowspan="2" style="width: 23%;">Keterangan</th>
            </tr>
            <tr>
                <th style="width: 9%;">Masuk</th>
                <th style="width: 9%;">Keluar</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    <td>{{ $row['date'] }}</td>
                    <td class="center">{{ $row['clock_in'] }}</td>
                    <td class="center">{{ $row['clock_out'] }}</td>
                    <td class="multiline">{{ $row['activity'] }}</td>
                    <td>{{ $row['remark'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="signatures">
        <tr>
            <td colspan="4">{{ $place_date }}</td>
        </tr>
        <tr>
            <td style="width: 34%;" class="center">
                Menyetujui,<br>
                Pembimbing
                <div class="space"></div>
                <div class="line">{{ $mentor_name }}</div>
            </td>
            <td style="width: 28%;"></td>
            <td style="width: 34%;" class="center">
                <br>
                Peserta Magang
                <div class="space"></div>
                <div class="line">{{ $intern_name }}</div>
            </td>
            <td style="width: 4%;"></td>
        </tr>
    </table>
@endsection

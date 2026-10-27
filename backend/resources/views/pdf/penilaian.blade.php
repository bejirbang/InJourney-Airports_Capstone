@extends('pdf.layout')

@section('title', 'Penilaian Magang')

@section('style')
    @page { margin: 26mm 26mm 20mm 25.5mm; }
    table.identity { margin-top: 12mm; }
    table.scores { margin-top: 6mm; margin-left: 2mm; width: 155mm; font-size: 9.5pt; }
    table.scores th { font-size: 10pt; padding: 0.6mm 1mm; height: 6.5mm; line-height: 1.1; }
    table.scores th.left { text-align: left; }
    table.scores th .heading { text-decoration: underline; }
    table.scores td { padding: 0.1mm 1mm; line-height: 1.1; }
    table.scores tr.category td { height: 5.5mm; }
    table.scores tr.category td.name { vertical-align: middle; padding-left: 1.6mm; }
    table.scores tr.category td.number { font-weight: bold; text-align: center; font-size: 10pt; }
    table.scores tr.total td { height: 5.5mm; font-weight: bold; font-size: 10pt; vertical-align: top; }
    .legend { margin-top: 0.5mm; }
    .notes { margin-top: 5mm; }
    .signatures { margin-top: 15mm; }
    .signatures .role { margin-top: 3mm; }
    .signatures .space { height: 21mm; }
    .signatures .line { width: 36mm; }
@endsection

@section('header')
    <div class="title">
        PENILAIAN PESERTA MAGANG / PKL<br>
        PT ANGKASA PURA INDONESIA
    </div>
@endsection

@section('content')
    @include('pdf.identity', ['identity' => $identity, 'showNumber' => true])

    <table class="grid scores">
        <thead>
            <tr>
                <th style="width: 5.5%;">No</th>
                <th class="left">KOMPONEN</th>
                <th style="width: 30%;"><span class="heading">DAFTAR NILAI</span><br>Angka</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($groups as $group)
                <tr class="category">
                    <td class="number">{{ $group['number'] }}</td>
                    <td class="name">{{ $group['name'] }}</td>
                    <td></td>
                </tr>
                @foreach ($group['indicators'] as $indicator)
                    <tr>
                        <td></td>
                        <td>{{ $indicator['number'] }}. {{ $indicator['name'] }}</td>
                        <td class="center">{{ $indicator['score'] }}</td>
                    </tr>
                @endforeach
            @endforeach
            <tr class="total">
                <td colspan="2" class="center">NILAI RATA-RATA</td>
                <td class="center">{{ $final_score }}</td>
            </tr>
        </tbody>
    </table>

    <div class="legend">
        Keterangan:<br>
        86-100 : Baik Sekali<br>
        71-85 : Baik<br>
        60-70 : Cukup<br>
        &lt;60 : Kurang
    </div>

    @if (($notes ?? '') === '')
        <div class="notes">CATATAN: .....................................</div>
    @else
        <div class="notes multiline">CATATAN: {{ $notes }}</div>
    @endif

    <table class="signatures">
        <tr>
            <td style="width: 60%;"></td>
            <td style="width: 40%;" class="center">
                {{ $place_date }}
                <div class="role">Pembimbing</div>
                <div class="space"></div>
                <div class="line">{{ $mentor_name }}</div>
            </td>
        </tr>
    </table>
@endsection

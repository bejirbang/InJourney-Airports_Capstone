@extends('pdf.layout')

@section('title', 'Penilaian Magang')

@section('content')
    <h1>PENILAIAN MAGANG</h1>

    @include('pdf.identity', ['identity' => $identity, 'showNumber' => true])

    <table class="grid">
        <thead>
            <tr>
                <th style="width: 22px;">No</th>
                <th>Indikator Penilaian</th>
                <th style="width: 70px;">Nilai (0-100)</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($groups as $category => $indicators)
                <tr>
                    <td></td>
                    <td colspan="2"><strong>{{ $category }}</strong></td>
                </tr>
                @foreach ($indicators as $indicator)
                    <tr>
                        <td class="center">{{ $indicator['number'] }}</td>
                        <td>{{ $indicator['name'] }}</td>
                        <td class="center">{{ $indicator['score'] }}</td>
                    </tr>
                @endforeach
            @endforeach
            <tr>
                <td></td>
                <td><strong>Nilai Rata-rata</strong></td>
                <td class="center"><strong>{{ $final_score }}</strong></td>
            </tr>
            <tr>
                <td></td>
                <td><strong>Predikat</strong></td>
                <td class="center"><strong>{{ $predicate }}</strong></td>
            </tr>
        </tbody>
    </table>

    <p style="margin-top: 6px; font-size: 9px;">
        Predikat: &ge; 86 Baik Sekali, &ge; 71 Baik, &ge; 60 Cukup, &lt; 60 Kurang.
    </p>

    <table class="grid">
        <tr><th style="text-align: left;">Catatan</th></tr>
        <tr><td class="multiline" style="height: 60px;">{{ $notes ?? '-' }}</td></tr>
    </table>

    <table class="signatures">
        <tr>
            <td></td>
            <td>
                {{ $place_date }}<br>
                Pembimbing,
                <div class="space"></div>
                <div class="name">{{ $mentor_name }}</div>
            </td>
        </tr>
    </table>
@endsection

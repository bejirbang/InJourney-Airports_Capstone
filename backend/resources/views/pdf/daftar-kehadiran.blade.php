@extends('pdf.layout')

@section('title', 'Daftar Kehadiran Magang')

@section('content')
    <h1>DAFTAR KEHADIRAN MAGANG</h1>

    @include('pdf.identity', ['identity' => $identity, 'monthLabel' => $month_label])

    <table class="grid">
        <thead>
            <tr>
                <th style="width: 22px;">No</th>
                <th style="width: 110px;">Tanggal</th>
                <th style="width: 44px;">Jam Masuk</th>
                <th style="width: 44px;">Jam Keluar</th>
                <th>Kegiatan</th>
                <th style="width: 90px;">Keterangan</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    <td class="center">{{ $loop->iteration }}</td>
                    <td class="nowrap">{{ $row['date'] }}</td>
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
            <td>
                <br>
                Pembimbing,
                <div class="space"></div>
                <div class="name">{{ $mentor_name }}</div>
            </td>
            <td>
                {{ $place_date }}<br>
                Peserta Magang,
                <div class="space"></div>
                <div class="name">{{ $intern_name }}</div>
            </td>
        </tr>
    </table>
@endsection

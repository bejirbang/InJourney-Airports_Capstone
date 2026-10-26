<table class="identity">
    <tr><td class="label">Nama</td><td>:</td><td>{{ $identity['name'] }}</td></tr>
    @if ($showNumber ?? false)
        <tr><td class="label">{{ $identity['number_label'] }}</td><td>:</td><td>{{ $identity['student_number'] }}</td></tr>
    @endif
    <tr><td class="label">{{ $identity['origin_label'] }}</td><td>:</td><td>{{ $identity['origin'] }}</td></tr>
    <tr><td class="label">Jurusan</td><td>:</td><td>{{ $identity['major'] }}</td></tr>
    <tr><td class="label">Unit Penempatan</td><td>:</td><td>{{ $identity['unit'] }}</td></tr>
    <tr><td class="label">Periode Magang</td><td>:</td><td>{{ $identity['period'] }}</td></tr>
    @isset($monthLabel)
        <tr><td class="label">Bulan/Tahun</td><td>:</td><td>{{ $monthLabel }}</td></tr>
    @endisset
</table>

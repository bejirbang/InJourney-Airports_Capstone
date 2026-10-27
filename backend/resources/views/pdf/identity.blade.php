<table class="identity">
    <tr><td class="label">Nama</td><td class="colon">:</td><td>{{ $identity['name'] }}</td></tr>
    <tr><td class="label">{{ $identity['origin_label'] }}</td><td class="colon">:</td><td>{{ $identity['origin'] }}</td></tr>
    <tr><td class="label">Jurusan</td><td class="colon">:</td><td>{{ $identity['major'] }}</td></tr>
    @if ($showNumber ?? false)
        <tr><td class="label">{{ $identity['number_label'] }}</td><td class="colon">:</td><td>{{ $identity['student_number'] }}</td></tr>
    @endif
    <tr><td class="label">Unit Penempatan</td><td class="colon">:</td><td>{{ $identity['unit'] }}</td></tr>
    <tr><td class="label">Periode Magang</td><td class="colon">:</td><td>{{ $identity['period'] }}</td></tr>
</table>

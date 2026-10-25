<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->sinta = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->dedi = User::factory()->admin()->create(['name' => 'Dedi Admin']);

    $at = function (string $time, User $admin, string $action, string $object, string $detail): AuditLog {
        $this->travelTo(Carbon::parse($time));

        return AuditLog::record($admin, $action, $object, $detail);
    };

    $this->reset = $at('2026-10-09 16:40:00', $this->dedi, AuditLog::ACTION_ACCOUNT, 'Andi Pratama', 'Reset password.');
    $this->holiday = $at('2026-10-10 10:15:00', $this->sinta, AuditLog::ACTION_CALENDAR, '3 Okt 2026', 'Tambah libur "Libur Daerah". 21 absensi dihitung ulang.');
    $this->correction = $at('2026-10-10 13:02:00', $this->sinta, AuditLog::ACTION_CORRECTION, 'Rina Wulandari', 'Setujui koreksi 9 Okt: 08:02 - 17:00.');

    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));
});

function auditLogs(User $user, string $query = ''): TestResponse
{
    app('auth')->forgetGuards();

    return test()->getJson("/api/admin/audit-logs{$query}", ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('lists admin actions newest first', function () {
    auditLogs($this->sinta)
        ->assertOk()
        ->assertJsonPath('data.*.id', [$this->correction->id, $this->holiday->id, $this->reset->id])
        ->assertJsonPath('data.0', [
            'id' => $this->correction->id,
            'created_at' => '2026-10-10T13:02:00+07:00',
            'admin' => ['id' => $this->sinta->id, 'name' => 'Sinta Admin'],
            'action' => 'Koreksi Presensi',
            'object' => 'Rina Wulandari',
            'detail' => 'Setujui koreksi 9 Okt: 08:02 - 17:00.',
        ])
        ->assertJsonPath('meta.total', 3);
});

it('filters by date, admin, and action type', function (string $query, Closure $expected) {
    auditLogs($this->sinta, $query)
        ->assertOk()
        ->assertJsonPath('data.*.id', $expected());
})->with([
    'tanggal' => ['?from=2026-10-10&to=2026-10-10', fn () => [test()->correction->id, test()->holiday->id]],
    'admin' => [fn () => '?admin_id='.test()->dedi->id, fn () => [test()->reset->id]],
    'jenis aksi' => ['?action=Kalender dan jam kerja', fn () => [test()->holiday->id]],
]);

it('keeps the name used at the time of the action', function () {
    $this->dedi->update(['name' => 'Dedi Kurniawan']);
    $this->dedi->delete();

    auditLogs($this->sinta, '?admin_id='.$this->dedi->id)
        ->assertJsonPath('data.0.admin', ['id' => $this->dedi->id, 'name' => 'Dedi Admin']);
});

it('pages twenty rows at a time', function () {
    foreach (range(1, 21) as $i) {
        AuditLog::record($this->sinta, AuditLog::ACTION_REPORT, 'Rekap Absensi', "Export Excel {$i}.");
    }

    auditLogs($this->sinta, '?page=2')
        ->assertJsonCount(4, 'data')
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonPath('meta.total', 24);
});

it('validates the filters', function (string $query, string $field, string $message) {
    auditLogs($this->sinta, $query)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'periode terbalik' => ['?from=2026-10-10&to=2026-10-09', 'to', 'Periode tidak valid.'],
    'jenis aksi asing' => ['?action=Hapus', 'action', 'Jenis aksi tidak valid.'],
]);

it('offers the admins found in the log and every action type', function () {
    User::factory()->admin()->create(['name' => 'Admin Tanpa Log']);
    $this->dedi->delete();

    app('auth')->forgetGuards();
    test()->getJson('/api/admin/audit-logs/options', ['Authorization' => 'Bearer '.$this->sinta->createToken('api')->plainTextToken])
        ->assertOk()
        ->assertExactJson(['data' => [
            'admins' => [
                ['id' => $this->dedi->id, 'name' => 'Dedi Admin'],
                ['id' => $this->sinta->id, 'name' => 'Sinta Admin'],
            ],
            'actions' => ['Akun', 'Absensi', 'Koreksi Presensi', 'Izin', 'Kalender dan jam kerja', 'Lokasi kantor', 'Warning', 'Pengumuman', 'Laporan'],
        ]]);
});

it('cannot be changed or deleted', function () {
    expect(fn () => $this->reset->update(['detail' => 'Diubah.']))->toThrow(LogicException::class, 'Log Aktivitas tidak bisa diubah.')
        ->and(fn () => $this->reset->delete())->toThrow(LogicException::class, 'Log Aktivitas tidak bisa dihapus.')
        ->and($this->reset->refresh()->detail)->toBe('Reset password.');

    app('auth')->forgetGuards();
    test()->deleteJson("/api/admin/audit-logs/{$this->reset->id}", [], ['Authorization' => 'Bearer '.$this->sinta->createToken('api')->plainTextToken])
        ->assertNotFound();
});

it('is only for admins', function (string $role) {
    auditLogs(User::factory()->{$role}()->create())->assertForbidden();
})->with(['intern', 'mentor']);

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $admin_id
 * @property string $admin_name
 * @property string $action
 * @property string $object
 * @property string $detail
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['admin_id', 'admin_name', 'action', 'object', 'detail'])]
class AuditLog extends Model
{
    public const ACTION_ACCOUNT = 'Akun';

    public const ACTION_WARNING = 'Warning';

    public const ACTION_ATTENDANCE = 'Presensi';

    public const ACTION_CORRECTION = 'Koreksi Presensi';

    public const ACTION_LEAVE = 'Izin';

    public const ACTION_PRESENTATION = 'Presentasi';

    /** Dicatat oleh mentor (simpan draft dan submit), bukan admin. */
    public const ACTION_ASSESSMENT = 'Penilaian';

    public const ACTION_CALENDAR = 'Kalender Libur';

    public const ACTION_OFFICE = 'Lokasi & Jadwal';

    public const ACTION_SETTINGS = 'Pengaturan Umum';

    public const ACTION_UNIT = 'Unit';

    public const ACTION_ANNOUNCEMENT = 'Pengumuman';

    public const ACTION_REPORT = 'Laporan';

    public const ACTIONS = [
        self::ACTION_ACCOUNT,
        self::ACTION_ATTENDANCE,
        self::ACTION_CORRECTION,
        self::ACTION_LEAVE,
        self::ACTION_PRESENTATION,
        self::ACTION_ASSESSMENT,
        self::ACTION_OFFICE,
        self::ACTION_CALENDAR,
        self::ACTION_SETTINGS,
        self::ACTION_UNIT,
        self::ACTION_WARNING,
        self::ACTION_ANNOUNCEMENT,
        self::ACTION_REPORT,
    ];

    protected static function booted(): void
    {
        static::updating(fn (): never => throw new \LogicException('Log Aktivitas tidak bisa diubah.'));
        static::deleting(fn (): never => throw new \LogicException('Log Aktivitas tidak bisa dihapus.'));
    }

    public static function record(User $admin, string $action, string $object, string $detail): self
    {
        return self::create([
            'admin_id' => $admin->id,
            'admin_name' => $admin->name,
            'action' => $action,
            'object' => $object,
            'detail' => $detail,
        ]);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}

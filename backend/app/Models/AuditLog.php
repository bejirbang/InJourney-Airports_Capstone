<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Log tindakan admin. Hanya ditambah, tidak pernah diubah atau dihapus.
 *
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

    public const ACTION_ATTENDANCE = 'Absensi';

    public const ACTION_LEAVE = 'Izin';

    public const ACTION_CALENDAR = 'Kalender dan jam kerja';

    public const ACTION_OFFICE = 'Lokasi kantor';

    public const ACTION_ANNOUNCEMENT = 'Pengumuman';

    public const ACTION_REPORT = 'Laporan';

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

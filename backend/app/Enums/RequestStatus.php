<?php

namespace App\Enums;

/**
 * Status pengajuan izin (`leave_requests`) dan koreksi absensi (`attendance_corrections`).
 */
enum RequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
}

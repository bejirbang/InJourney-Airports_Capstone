<?php

namespace App\Enums;

enum CorrectionStatus: string
{
    case PendingMentor = 'pending_mentor';
    case RejectedByMentor = 'rejected_by_mentor';
    case PendingAdmin = 'pending_admin';
    case Approved = 'approved';
    case RejectedByAdmin = 'rejected_by_admin';
    case Cancelled = 'cancelled';

    /**
     * @return list<self>
     */
    public static function active(): array
    {
        return [self::PendingMentor, self::PendingAdmin];
    }

    public function isActive(): bool
    {
        return in_array($this, self::active(), true);
    }
}

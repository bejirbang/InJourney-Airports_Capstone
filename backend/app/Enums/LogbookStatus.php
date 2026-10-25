<?php

namespace App\Enums;

enum LogbookStatus: string
{
    case Draft = 'draft';
    case PendingReview = 'pending_review';
    case Approved = 'approved';
    case Revision = 'revision';
}

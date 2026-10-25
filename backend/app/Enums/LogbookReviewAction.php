<?php

namespace App\Enums;

enum LogbookReviewAction: string
{
    case Approved = 'approved';
    case Revision = 'revision';
}

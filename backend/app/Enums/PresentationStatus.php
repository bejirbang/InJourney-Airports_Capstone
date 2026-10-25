<?php

namespace App\Enums;

enum PresentationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Revision = 'revision';
}

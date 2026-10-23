<?php

namespace App\Enums;

enum AccountStatus: string
{
    case Active = 'active';
    case NotStarted = 'not_started';
    case Inactive = 'inactive';
}

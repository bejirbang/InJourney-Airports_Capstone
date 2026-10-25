<?php

namespace App\Policies;

use App\Models\Logbook;
use App\Models\User;
use App\Services\MentorLogbooks;
use Illuminate\Auth\Access\Response;

class LogbookPolicy
{
    public const FORBIDDEN = 'Anda tidak memiliki akses ke logbook ini.';

    public function __construct(private MentorLogbooks $logbooks) {}

    /**
     * Hanya mentor intern saat ini, dan hanya logbook yang sudah dikirim.
     */
    public function review(User $user, Logbook $logbook): Response
    {
        return $this->logbooks->isMentorOf($user, $logbook) ? Response::allow() : Response::deny(self::FORBIDDEN);
    }
}

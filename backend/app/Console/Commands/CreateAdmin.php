<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Membuat akun admin (dipakai tim teknis untuk admin pertama saat sistem dipasang).
 * Password sementara dibuat sistem dan wajib diganti saat login pertama.
 */
class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin {email : Email internal admin} {name : Nama lengkap} {--title=Admin : Posisi}';

    protected $description = 'Buat akun admin dengan password sementara';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));

        $validator = Validator::make(['email' => $email], [
            'email' => ['required', 'email', Rule::unique('users', 'email')->withoutTrashed()],
        ], [
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah terdaftar.',
        ]);

        if ($validator->fails()) {
            $this->error($validator->errors()->first('email'));

            return self::FAILURE;
        }

        $temporaryPassword = Str::password(12, symbols: false);

        User::create([
            'name' => (string) $this->argument('name'),
            'email' => $email,
            'password' => $temporaryPassword,
            'role' => Role::Admin,
            'title' => (string) $this->option('title'),
            'is_active' => true,
            'must_change_password' => true,
        ]);

        $this->info("Admin {$email} dibuat.");
        $this->line("Password sementara: {$temporaryPassword}");
        $this->line('Password ini hanya tampil sekali dan wajib diganti saat login pertama.');

        return self::SUCCESS;
    }
}

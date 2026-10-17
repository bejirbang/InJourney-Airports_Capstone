<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Menyimpan dan menghapus foto profil. Satu akun satu foto; foto lama dihapus permanen.
 */
class ProfilePhotos
{
    public function replace(User $user, UploadedFile $photo): void
    {
        $old = $user->photo_path;
        $path = $photo->store("profile-photos/{$user->id}");
        $path = is_string($path) ? $path : null;

        abort_if($path === null, 500, 'Foto gagal disimpan. Coba lagi.');

        try {
            $user->update(['photo_path' => $path]);
        } catch (Throwable $e) {
            Storage::delete($path);

            throw $e;
        }

        if ($old !== null) {
            Storage::delete($old);
        }
    }

    public function remove(User $user): void
    {
        $old = $user->photo_path;

        if ($old === null) {
            return;
        }

        $user->update(['photo_path' => null]);
        Storage::delete($old);
    }
}

<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ProfilePhotoRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\ProfilePhotos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Halaman Profil Saya untuk semua role (design-intern.md 3.3, design-mentor.md 3.3, design-admin.md 13.3).
 * Pengguna hanya mengubah nama, foto, dan nomor telepon. Password tidak bisa diganti di sini.
 */
class ProfileController extends Controller
{
    public const SAVED = 'Perubahan tersimpan.';

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update([
            'name' => $request->string('name')->value(),
            'phone' => $request->filled('phone') ? $request->string('phone')->value() : null,
        ]);

        return $this->saved($user);
    }

    public function uploadPhoto(ProfilePhotoRequest $request, ProfilePhotos $photos): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        /** @var UploadedFile $photo */
        $photo = $request->file('photo');
        $photos->replace($user, $photo);

        return $this->saved($user);
    }

    public function deletePhoto(Request $request, ProfilePhotos $photos): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $photos->remove($user);

        return $this->saved($user);
    }

    /**
     * Foto profil siapa pun, lewat alamat bertanda tangan dari `photo_url` (tanpa token).
     */
    public function photo(User $user): StreamedResponse
    {
        $path = $user->photo_path;
        abort_if($path === null || ! Storage::exists($path), 404, 'Foto tidak ditemukan.');

        return Storage::response($path, null, ['Cache-Control' => 'private, max-age=86400']);
    }

    private function saved(User $user): JsonResponse
    {
        return response()->json([
            'message' => self::SAVED,
            'data' => new UserResource($user->loadMissing('internProfile')),
        ]);
    }
}

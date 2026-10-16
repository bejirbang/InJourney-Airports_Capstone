<?php

namespace App\Http\Resources;

use App\Models\TaskComment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu komentar dalam thread Task. `author` null jika akun penulis sudah dihapus permanen.
 *
 * @mixin TaskComment
 */
class TaskCommentResource extends JsonResource
{
    /**
     * Komentar orang lain yang belum dibaca sebelum detail dibuka, untuk disorot.
     */
    public bool $unread = false;

    public function markUnread(bool $unread): static
    {
        $this->unread = $unread;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'author' => $this->author === null ? null : [
                'id' => $this->author->id,
                'name' => $this->author->name,
                'role' => $this->author->role->value,
            ],
            'body' => $this->body,
            'is_revision' => $this->is_revision,
            'is_unread' => $this->unread,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

<?php

namespace App\Http\Resources;

use App\Enums\TaskStatus;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Date;

/**
 * Task dari sisi mentor: kartu Kanban dan baris Daftar (Alur 5), serta hasil buat dan ubah (Alur 4).
 *
 * @mixin Task
 */
class MentorTaskResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $now = Date::now();
        $intern = $this->intern;
        $late = $this->isLate($now);
        $comments = $this->comments_count ?? $this->comments()->count();

        return [
            'id' => $this->id,
            'code' => $this->code,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status->value,
            'due_at' => $this->due_at->toIso8601String(),
            'is_late' => $late,
            // "Lewat 2 hari" selama belum dikumpulkan; Task In Review dinilai dari waktu kumpul.
            'late_label' => $late && $this->status !== TaskStatus::InReview ? $this->lateLabel($now) : null,
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'done_at' => $this->done_at?->toIso8601String(),
            // Angka kecil di kartu: komentar dari intern yang belum dibaca mentor.
            'unread_comments' => (int) ($this->unread_comments_count ?? 0),
            'revision_count' => $this->revision_count,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            // Tombol di Daftar (7.3): review = Periksa, open = Buka, view = Lihat.
            'action' => match ($this->status) {
                TaskStatus::InReview => 'review',
                TaskStatus::Done => 'view',
                default => 'open',
            },
            // Hanya kartu In Review yang bisa diseret mentor: ke Done (Accept) atau In Progress (Revise).
            'can_drag' => $this->status === TaskStatus::InReview,
            // Tombol Ubah: selama belum Done. Tombol Hapus: hanya To Do tanpa komentar (6.4).
            'can_edit' => $this->status !== TaskStatus::Done,
            'can_delete' => $this->status === TaskStatus::Todo && $comments === 0,
        ];
    }
}

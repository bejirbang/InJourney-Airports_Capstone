import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getToken,
  taskApi,
  type ApiInternTask,
  type ApiRole,
  type ApiTaskStatus,
  type TaskListParams,
} from "@/lib/api";
import type { Role, TaskStatus } from "@/lib/mock-rules";
import { type Task } from "@/components/internspace/shared/model";

// Integrasi halaman Task intern dengan backend (docs/design-intern.md Alur 8 dan 9).
// Sisi mentor masih memakai data prototipe di MockProvider.

/** Kunci dasar daftar Task intern; dipakai untuk invalidate setelah pindah status, kumpul, atau komentar. */
export const TASKS_KEY = ["intern", "tasks"] as const;
/** Awalan kunci detail Task; invalidate atas ini menyegarkan semua detail yang terbuka. */
export const TASK_DETAIL_PREFIX = ["intern", "task"] as const;
/** Kunci detail Task; selalu dimuat ulang agar komentar terbaru dan penanda terbaca ikut segar. */
export const taskDetailKey = (openId: string | null) =>
  [...TASK_DETAIL_PREFIX, openId ?? ""] as const;

export const internToken = (): string => {
  const token = getToken();
  if (!token) throw new ApiError("Sesi Anda sudah berakhir. Silakan masuk lagi.", 401);
  return token;
};

export function toApiStatus(status: TaskStatus): ApiTaskStatus {
  switch (status) {
    case "To Do":
      return "todo";
    case "In Progress":
      return "in_progress";
    case "In Review":
      return "in_review";
    default:
      return "done";
  }
}

export function fromApiStatus(status: ApiTaskStatus): TaskStatus {
  switch (status) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "in_review":
      return "In Review";
    default:
      return "Done";
  }
}

function toRole(role: ApiRole): Role {
  switch (role) {
    case "mentor":
      return "Mentor";
    case "admin":
      return "Admin";
    default:
      return "Intern";
  }
}

/**
 * Data API menjadi model Task yang dipakai Kanban, daftar, dan dialog detail.
 * `viewer` adalah nama sendiri (Task intern selalu milik yang sedang masuk).
 */
export function toViewTask(api: ApiInternTask, viewer: string): Task {
  const submission = api.submission;
  const comments = (api.comments ?? []).map((comment) => ({
    id: comment.id,
    author: comment.author?.name ?? "Akun dihapus",
    role: toRole(comment.author?.role ?? "intern"),
    text: comment.body,
    at: comment.created_at ?? api.due_at,
    ...(comment.is_revision ? { revise: true } : {}),
  }));

  return {
    id: String(api.id),
    title: api.title,
    description: api.description ?? "",
    intern: viewer,
    mentor: api.mentor?.name ?? "—",
    due: api.due_at,
    status: fromApiStatus(api.status),
    // Urutan "Terbaru dibuat" diserahkan ke server lewat sort=newest.
    createdAt: api.due_at,
    everSubmitted: api.ever_submitted,
    ...(api.done_at ? { doneAt: api.done_at } : {}),
    ...(api.revise_pending ? { revisePending: true } : {}),
    revisions: 0,
    comments,
    unread: { Intern: api.unread_comments, Mentor: 0 },
    // Tanda Terlambat dan keterangannya dihitung server, bukan dari jam browser.
    late: api.is_late,
    ...(api.late_label ? { lateLabel: api.late_label } : {}),
    ...(submission
      ? {
          submittedAt: submission.submitted_at,
          submittedLate: submission.submitted_late,
          lateHours: submission.late_hours,
          ...(submission.link ? { link: submission.link } : {}),
          ...(submission.file ? { file: submission.file.name } : {}),
        }
      : {}),
  };
}

export type TaskFilters = {
  q: string;
  status: "Semua" | TaskStatus;
  late: boolean;
  sort: "tenggat" | "terbaru";
  allDone: boolean;
};

/** Filter di halaman diteruskan ke server; hanya komponen khusus mentor yang masih disaring di klien. */
export function taskListParams(filters: TaskFilters): TaskListParams {
  const q = filters.q.trim();
  return {
    ...(filters.status !== "Semua" ? { status: toApiStatus(filters.status) } : {}),
    ...(filters.late ? { late: true } : {}),
    ...(q ? { q } : {}),
    sort: filters.sort === "terbaru" ? ("newest" as const) : ("due" as const),
    ...(filters.allDone ? { include_older_done: true } : {}),
  };
}

export function useInternTaskList(filters: TaskFilters, enabled: boolean) {
  const params = taskListParams(filters);
  return useQuery({
    queryKey: [...TASKS_KEY, params],
    queryFn: () => taskApi.list(internToken(), params),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Detail Task (deskripsi, hasil kumpulan, thread komentar). Membuka detail menandai komentar
 * terbaca di server, jadi daftar ikut dimuat ulang setelahnya.
 */
export function useInternTaskDetail(openId: string | null, enabled: boolean) {
  const id = Number(openId);
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: taskDetailKey(openId),
    queryFn: () =>
      taskApi.show(internToken(), id).then((data) => {
        void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        return data;
      }),
    enabled: enabled && openId !== null && Number.isInteger(id) && id > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

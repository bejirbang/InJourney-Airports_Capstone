// Endpoint bersama semua role: menu sidebar, notifikasi, chat, dan pengumuman (progress.md 4.1).
// Menu diisi di Fase 1 (progress.md 5.2); notifikasi/lonceng dan chat menyusul di Fase 5,
// pengumuman di Fase 4.
import { request, type ApiRole } from "@/lib/api";

/** Satu item dari `GET /api/{role}/menu`. `path` server tidak dipakai (progress.md 4.3). */
export interface ApiMenuItem {
  key: string;
  path: string;
  /** Angka badge, atau `null` bila tidak ada. */
  badge: number | null;
}

export const menuApi = {
  list(token: string, role: ApiRole): Promise<ApiMenuItem[]> {
    return request<{ data?: ApiMenuItem[] }>(`/api/${role}/menu`, { token }).then(
      (body) => body.data ?? [],
    );
  },
};

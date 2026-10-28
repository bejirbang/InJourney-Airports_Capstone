import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { internToken, type ApiRole } from "@/lib/api";
import { menuApi, type ApiMenuItem } from "@/lib/endpoints/shared";

// Sidebar diisi dari server: GET /api/{role}/menu (progress.md 5.2). Key dipetakan ke
// route di lib/navigation.ts dan label di lib/navigation.ts `MENU_LABELS`.

/** Kunci query menu; dipakai lagi untuk invalidasi setelah mutasi yang mengubah angka. */
export const menuQueryKey = (role: ApiRole | null) => ["menu", role] as const;

/**
 * Daftar menu sidebar (key + badge) untuk satu role. Null saat user belum dimuat;
 * shell menampilkan daftar statis tanpa badge selama memuat atau bila gagal.
 */
export function useMenu(role: ApiRole | null): UseQueryResult<ApiMenuItem[]> {
  return useQuery({
    queryKey: menuQueryKey(role),
    enabled: role !== null,
    queryFn: () => menuApi.list(internToken(), role as ApiRole),
  });
}

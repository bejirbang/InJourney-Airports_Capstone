import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { attendanceApi } from "@/lib/endpoints/intern";

// Dashboard intern (design-intern.md Alur 2): semua bagian dibaca dari GET /api/intern/dashboard.

export const DASHBOARD_KEY = ["intern", "dashboard"] as const;

/** Data dashboard intern, termasuk kartu Hari Ini, rekap, kuota izin, dan pengumuman. */
export function useInternDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => attendanceApi.dashboard(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

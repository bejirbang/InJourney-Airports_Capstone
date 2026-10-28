import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { mentorApi } from "@/lib/endpoints/mentor";

// Dashboard mentor (design-mentor.md Alur 2): kartu presensi hari ini dan antrean tindakan.
// Semua angka dan baris dibaca dari GET /api/mentor/dashboard.

/** Kunci dasar data mentor; semua mutasi mentor menyegarkan kunci ini. */
export const MENTOR_KEY = ["mentor"] as const;

export function useMentorDashboard() {
  return useQuery({
    queryKey: [...MENTOR_KEY, "dashboard"],
    queryFn: () => mentorApi.dashboard(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

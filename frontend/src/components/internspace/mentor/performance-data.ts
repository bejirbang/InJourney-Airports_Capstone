import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { mentorApi } from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";

// Performa intern (design-mentor.md Alur 8): rekap kehadiran dan KPI, bukan nilai akhir.

export const PERFORMANCE_KEY = [...MENTOR_KEY, "performance"] as const;

export function useMentorPerformance(month: string, internId: number | undefined) {
  return useQuery({
    queryKey: [...PERFORMANCE_KEY, month, internId ?? 0],
    queryFn: () =>
      mentorApi.performance(
        internToken(),
        internId === undefined ? { month } : { month, intern_id: internId },
      ),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

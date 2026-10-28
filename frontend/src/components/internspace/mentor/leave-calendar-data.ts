import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { mentorApi } from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";

// Kalender izin mentor (design-mentor.md Alur 7): libur mengikuti jadwal bandara tiap intern.

export const LEAVE_CALENDAR_KEY = [...MENTOR_KEY, "leave-calendar"] as const;

export function useMentorLeaveCalendar(month: string, internId: number | undefined) {
  return useQuery({
    queryKey: [...LEAVE_CALENDAR_KEY, month, internId ?? 0],
    queryFn: () =>
      mentorApi.leaveCalendar(
        internToken(),
        internId === undefined ? { month } : { month, intern_id: internId },
      ),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminAttendanceMonth({
  month,
  airportId,
  q,
}: {
  month: string | null;
  airportId: number | null;
  q: string;
}) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "attendance-month", month, airportId, q],
    queryFn: () =>
      adminApi.attendance.month(internToken(), {
        ...(month === null ? {} : { month }),
        airport_id: airportId,
        ...(q.trim() === "" ? {} : { q: q.trim() }),
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminAttendanceDaily({
  date,
  airportId,
  q,
}: {
  date: string | null;
  airportId: number | null;
  q: string;
}) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "attendance-day", date, airportId, q],
    queryFn: () =>
      adminApi.attendance.daily(internToken(), {
        ...(date === null ? {} : { date }),
        airport_id: airportId,
        ...(q.trim() === "" ? {} : { q: q.trim() }),
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

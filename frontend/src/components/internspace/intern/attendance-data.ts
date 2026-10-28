import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { attendanceApi, type ApiAttendanceFilter, type GeoPosition } from "@/lib/endpoints/intern";
import { DASHBOARD_KEY } from "@/components/internspace/intern/dashboard-data";

// Presensi intern (design-intern.md Alur 3-6): status hari ini, kantor, clock in/out, riwayat.

/** Kunci riwayat presensi; invalidate atas ini menyegarkan daftar dan detail hari. */
export const ATTENDANCE_KEY = ["intern", "attendance"] as const;

/**
 * Status kartu Hari Ini. Dashboard dan tab Hari Ini membaca respons yang sama, jadi
 * hook ini memakai kunci dashboard agar keduanya berbagi cache.
 */
export function useTodayStatus() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => attendanceApi.dashboard(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Titik presensi aktif milik bandara intern (peta dan perkiraan jarak di browser). */
export function useOffices() {
  return useQuery({
    queryKey: ["intern", "offices"],
    queryFn: () => attendanceApi.offices(internToken()),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Clock in; sukses menyegarkan dashboard, logbook hari ini, dan riwayat. */
export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (position: GeoPosition) => attendanceApi.clockIn(internToken(), position),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

/** Clock out, boleh sekaligus membawa isian logbook dari dialog. */
export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { position: GeoPosition; work?: string; notes?: string | null }) =>
      attendanceApi.clockOut(
        internToken(),
        input.position,
        input.work === undefined && input.notes === undefined
          ? undefined
          : {
              ...(input.work === undefined ? {} : { work: input.work }),
              ...(input.notes === undefined ? {} : { notes: input.notes }),
            },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

/** Riwayat presensi satu bulan; navigasi bulan dibatasi `selectable_months` dari server. */
export function useAttendanceHistory(params: {
  month?: string;
  status?: ApiAttendanceFilter;
}) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, params],
    queryFn: () => attendanceApi.history(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Detail satu hari untuk dialog riwayat; hanya dimuat saat baris dibuka. */
export function useAttendanceDay(date: string | null) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, "day", date ?? ""],
    queryFn: () => attendanceApi.day(internToken(), date ?? ""),
    enabled: date !== null,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

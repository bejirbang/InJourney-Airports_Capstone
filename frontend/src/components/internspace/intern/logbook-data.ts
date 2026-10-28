import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { attendanceApi, type LogbookFilter } from "@/lib/endpoints/intern";

// Logbook intern (design-intern.md Alur 4 dan Alur 8): daftar per bulan, detail, simpan/kirim.

export const LOGBOOKS_KEY = ["intern", "logbooks"] as const;

/** Daftar logbook satu bulan, termasuk bagian "Perlu ditindak" dari server. */
export function useLogbookMonth(params: LogbookFilter) {
  return useQuery({
    queryKey: [...LOGBOOKS_KEY, params],
    queryFn: () => attendanceApi.logbooks(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Detail satu tanggal; `action` menentukan tombol yang tampil. */
export function useLogbookDay(date: string | null) {
  return useQuery({
    queryKey: [...LOGBOOKS_KEY, "day", date ?? ""],
    queryFn: () => attendanceApi.logbook(internToken(), date ?? ""),
    enabled: date !== null,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Simpan/kirim logbook; sukses menyegarkan daftar, detail, dashboard, dan riwayat. */
export function useSaveLogbook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; work: string; notes: string | null }) =>
      attendanceApi.saveLogbook(internToken(), input.date, {
        work: input.work,
        notes: input.notes,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

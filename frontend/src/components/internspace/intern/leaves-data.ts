import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  leaveApi,
  type ApiLeaveStatus,
  type ApiLeaveType,
  type LeaveListParams,
} from "@/lib/endpoints/intern";
import type { LeaveType } from "@/lib/mock-rules";

// Integrasi halaman Izin intern dengan backend (docs/design-intern.md Alur 11).
// Data contoh di MockProvider hanya dipakai role Mentor dan Admin.

/** Kunci dasar riwayat izin intern; invalidate atas ini menyegarkan daftar dan kuota. */
export const LEAVES_KEY = ["intern", "leaves"] as const;
/** Kunci detail izin. */
export const leaveDetailKey = (openId: string | null) =>
  [...LEAVES_KEY, "detail", openId ?? ""] as const;
/** Kunci pratinjau "Total: 2 hari kerja" untuk satu rentang tanggal. */
export const workingDaysKey = (start: string, end: string) =>
  [...LEAVES_KEY, "working-days", start, end] as const;

export function toApiLeaveType(type: LeaveType): ApiLeaveType {
  return type === "Izin Sakit" ? "sick" : "urgent";
}

export function useInternLeaveList(status: "Semua" | ApiLeaveStatus) {
  const params: LeaveListParams = status === "Semua" ? {} : { status };
  return useQuery({
    queryKey: [...LEAVES_KEY, params],
    queryFn: () => leaveApi.list(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Detail izin (alasan, link bukti, pemroses, dan catatan keputusan). */
export function useInternLeaveDetail(openId: string | null) {
  const id = Number(openId);
  return useQuery({
    queryKey: leaveDetailKey(openId),
    queryFn: () => leaveApi.show(internToken(), id),
    enabled: openId !== null && Number.isInteger(id) && id > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Pratinjau "Total: 2 hari kerja" di formulir, selama kedua tanggal terisi. */
export function useLeaveWorkingDays(start: string, end: string, enabled: boolean) {
  const ready = !!start && !!end && end >= start;
  return useQuery({
    queryKey: workingDaysKey(start, end),
    queryFn: () => leaveApi.workingDays(internToken(), start, end),
    enabled: enabled && ready,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Ajukan izin; sukses menyegarkan riwayat, kuota, dan dashboard. */
export function useSubmitLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: ApiLeaveType;
      start_date: string;
      end_date: string;
      reason: string;
      evidence_url?: string | null;
    }) => leaveApi.store(internToken(), input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

/** Batalkan izin yang masih Menunggu; kuota otomatis kembali lewat server. */
export function useCancelLeave() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["intern"] });
  return useMutation({
    mutationFn: (id: number) => leaveApi.cancel(internToken(), id),
    onSuccess: refresh,
    // 422 "sudah diproses" juga mengubah data di server: segarkan agar status terbaru tampil.
    onError: refresh,
  });
}

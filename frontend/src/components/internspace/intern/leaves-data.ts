import { useQuery } from "@tanstack/react-query";
import {
  internToken,
  leaveApi,
  type ApiInternLeave,
  type ApiLeaveStatus,
  type ApiLeaveType,
  type ApiRole,
} from "@/lib/api";
import type { LeaveStatus, LeaveType, Role } from "@/lib/mock-rules";
import { type Leave } from "@/components/internspace/shared/model";

// Integrasi halaman Izin intern dengan backend (docs/design-intern.md Alur 11).
// Data contoh di MockProvider hanya dipakai role Mentor dan Admin.

/** Kunci dasar riwayat izin intern; invalidate atas ini menyegarkan daftar, detail, dan hari kerja. */
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

export function fromApiLeaveType(type: ApiLeaveType): LeaveType {
  return type === "sick" ? "Izin Sakit" : "Izin Urgent";
}

export function fromApiLeaveStatus(status: ApiLeaveStatus): LeaveStatus {
  switch (status) {
    case "approved":
      return "Disetujui";
    case "rejected":
      return "Ditolak";
    case "cancelled":
      return "Dibatalkan";
    default:
      return "Pending";
  }
}

function toRole(role: ApiRole): Role {
  switch (role) {
    case "mentor":
      return "Mentor";
    case "admin":
      return "Admin";
    default:
      return "Intern";
  }
}

/**
 * Data API menjadi model yang dipakai tabel riwayat dan dialog detail.
 * `viewer` adalah nama sendiri: izin intern selalu milik yang sedang masuk.
 */
export function toViewLeave(api: ApiInternLeave, viewer: string): Leave {
  return {
    id: api.id,
    intern: viewer,
    type: fromApiLeaveType(api.type),
    start: api.start_date,
    end: api.end_date,
    reason: api.reason,
    // Nama berkas tidak dikirim server; lampiran dibaca lewat tombol Unduh.
    evidence: api.has_evidence ? "Lampiran bukti" : "",
    status: fromApiLeaveStatus(api.status),
    submitted: api.submitted_at,
    // Label "Diajukan setelah tanggal izin" ditentukan server.
    submittedLate: api.submitted_late,
    // Dihitung server dari kalender libur terbaru.
    workingDays: api.working_days,
    // Tombol Batalkan mengikuti keputusan server, bukan hanya status di layar.
    canCancel: api.can_cancel,
    ...(api.decided_by ? { by: api.decided_by.name, byRole: toRole(api.decided_by.role) } : {}),
    ...(api.decision_note ? { note: api.decision_note } : {}),
    ...(api.decided_at ? { decidedAt: api.decided_at } : {}),
  };
}

export function useInternLeaveList(status: "Semua" | ApiLeaveStatus) {
  const params = status === "Semua" ? {} : { status };
  return useQuery({
    queryKey: [...LEAVES_KEY, params],
    queryFn: () => leaveApi.list(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Detail izin (alasan, lampiran, pemroses, dan catatan keputusan). */
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

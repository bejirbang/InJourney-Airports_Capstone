import { downloadFile, request, unwrap, type ApiRole } from "@/lib/api";

// Semua endpoint /api/intern/* beserta tipe responsnya (progress.md 4.1).

export type ApiTodayState =
  | "not_clocked_in"
  | "clocked_in"
  | "clocked_out"
  /** Sudah lewat jam pulang tanpa clock in: hanya Clock Out yang tersedia. */
  | "missed_clock_in"
  | "holiday"
  | "on_leave"
  | "outside_period";

export interface TodayStatus {
  state: ApiTodayState;
  /** Jam kerja hari ini menurut jadwal bandara (mingguan/khusus); null di hari non-kerja. */
  schedule: { start: string; end: string } | null;
  status: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  /** Jam pulang acuan clock out (salinan jadwal di baris presensi bila sudah clock in). */
  clock_out_from: string | null;
  /** Server hanya mengizinkan clock out setelah jam pulang lewat. */
  can_clock_out: boolean;
  /** Logbook hari ini; selama ada isian, clock out diperbolehkan server. */
  logbook: { status: string; work: string; notes: string | null } | null;
  holiday_name: string | null;
  leave_type: "sick" | "urgent" | null;
  has_active_office: boolean;
}

export interface InternDashboard {
  date: string;
  today: TodayStatus;
  /** Clock in hari ini tetapi logbook belum diisi. */
  logbook_reminder: boolean;
}

export interface OfficeInfo {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
}

export type ApiLogbookStatus = "draft" | "pending_review" | "revision" | "approved";

/** Logbook satu hari (`InternLogbooks::day`). */
export interface InternLogbookDay {
  date: string;
  attendance: {
    status: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    missed_clock_out: boolean;
    is_corrected: boolean;
  } | null;
  logbook: {
    id: number;
    work: string;
    notes: string | null;
    status: ApiLogbookStatus;
    updated_at: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    approved_by: string | null;
  } | null;
  /** Aksi yang tersedia: save (draft hari ini), resubmit (revisi), submit (hari hasil koreksi), null = terkunci. */
  action: "save" | "submit" | "resubmit" | null;
}

export interface AttendanceRecord {
  id: number;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  clock_in_office?: { id: number; name: string } | null;
  clock_out_office?: { id: number; name: string } | null;
  is_corrected: boolean;
}

export interface GeoPosition {
  lat: number;
  lng: number;
}

export const attendanceApi = {
  dashboard(token: string): Promise<InternDashboard> {
    return request<{ data?: InternDashboard } | InternDashboard>("/api/intern/dashboard", {
      token,
    }).then(unwrap<InternDashboard>);
  },

  offices(token: string): Promise<OfficeInfo[]> {
    return request<{ data?: OfficeInfo[] } | OfficeInfo[]>("/api/intern/offices", {
      token,
    }).then(unwrap<OfficeInfo[]>);
  },

  clockIn(
    token: string,
    position: GeoPosition,
  ): Promise<{ message: string; data: AttendanceRecord }> {
    return request("/api/intern/attendance/clock-in", {
      method: "POST",
      body: { latitude: position.lat, longitude: position.lng },
      token,
    });
  },

  /**
   * Clock out. `work` dikirim inline hanya untuk Lupa Clock In (tanpa baris presensi server
   * menolak logbook terpisah); pada hari normal logbook sudah dikirim lewat `saveLogbook`.
   */
  clockOut(
    token: string,
    position: GeoPosition,
    input?: { work?: string; notes?: string | null },
  ): Promise<{ message: string; data: AttendanceRecord }> {
    return request("/api/intern/attendance/clock-out", {
      method: "POST",
      body: {
        latitude: position.lat,
        longitude: position.lng,
        ...(input?.work === undefined ? {} : { work: input.work }),
        ...(input?.notes === undefined ? {} : { notes: input.notes }),
      },
      token,
    });
  },

  /** Logbook satu tanggal; `logbook` null sebelum diisi. */
  logbook(token: string, date: string): Promise<InternLogbookDay> {
    return request<{ data?: InternLogbookDay } | InternLogbookDay>(`/api/intern/logbooks/${date}`, {
      token,
    }).then(unwrap<InternLogbookDay>);
  },

  /** Simpan isian logbook (draft hari ini, atau kirim ulang setelah revisi mentor). */
  saveLogbook(
    token: string,
    date: string,
    input: { work: string; notes: string | null },
  ): Promise<{ message: string; data: InternLogbookDay }> {
    return request(`/api/intern/logbooks/${date}`, {
      method: "PUT",
      body: input,
      token,
    });
  },
};

// ---- Izin intern (Alur 11) ----

export type ApiLeaveType = "sick" | "urgent";
export type ApiLeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Izin dari sisi intern (`InternLeaveResource`). */
export interface ApiInternLeave {
  id: number;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  /** Dihitung server saat dibaca, jadi libur yang ditambahkan admin ikut mengurangi. */
  working_days: number;
  reason: string;
  has_evidence: boolean;
  status: ApiLeaveStatus;
  submitted_at: string;
  submitted_late: boolean;
  /** Mentor atau admin yang memutuskan; null selama Pending. */
  decided_by: { name: string; role: ApiRole } | null | undefined;
  decision_note: string | null;
  decided_at: string | null;
  /** Hanya izin Pending yang boleh dibatalkan intern. */
  can_cancel: boolean;
}

export interface LeaveListParams {
  status?: ApiLeaveStatus;
}

export const leaveApi = {
  list(token: string, params: LeaveListParams = {}): Promise<ApiInternLeave[]> {
    const query = params.status ? `?status=${params.status}` : "";
    return request<{ data?: ApiInternLeave[] } | ApiInternLeave[]>(`/api/intern/leaves${query}`, {
      token,
    }).then(unwrap<ApiInternLeave[]>);
  },

  /** "Total: 2 hari kerja" di formulir izin; server memakai kalender libur terbaru. */
  workingDays(token: string, start: string, end: string): Promise<number> {
    return request<{ data?: { working_days: number } }>(
      `/api/intern/leaves/working-days?start_date=${start}&end_date=${end}`,
      { token },
    ).then((body) => unwrap<{ working_days: number }>(body).working_days);
  },

  /** Ajukan izin (multipart: type, start_date, end_date, reason, evidence). */
  store(
    token: string,
    input: {
      type: ApiLeaveType;
      start_date: string;
      end_date: string;
      reason: string;
      evidence?: File | null;
    },
  ): Promise<{ message: string; leave: ApiInternLeave }> {
    const formData = new FormData();
    formData.append("type", input.type);
    formData.append("start_date", input.start_date);
    formData.append("end_date", input.end_date);
    formData.append("reason", input.reason);
    if (input.evidence) formData.append("evidence", input.evidence);

    return request<{ message?: string; data?: ApiInternLeave }>("/api/intern/leaves", {
      method: "POST",
      formData,
      token,
    }).then((body) => ({
      message: body.message ?? "Izin diajukan. Menunggu mentor.",
      leave: unwrap<ApiInternLeave>(body),
    }));
  },

  show(token: string, leave: number): Promise<ApiInternLeave> {
    return request<{ data?: ApiInternLeave } | ApiInternLeave>(`/api/intern/leaves/${leave}`, {
      token,
    }).then(unwrap<ApiInternLeave>);
  },

  /** Batalkan izin Pending. Ditolak 422 bila sudah diproses mentor atau admin. */
  cancel(token: string, leave: number): Promise<{ message: string; leave: ApiInternLeave }> {
    return request<{ message?: string; data?: ApiInternLeave }>(
      `/api/intern/leaves/${leave}/cancel`,
      { method: "POST", token },
    ).then((body) => ({
      message: body.message ?? "Pengajuan izin dibatalkan.",
      leave: unwrap<ApiInternLeave>(body),
    }));
  },

  /** Unduh lampiran bukti; file tidak punya URL publik. */
  evidence(token: string, leave: number, fallbackName: string): Promise<string> {
    return downloadFile(`/api/intern/leaves/${leave}/evidence`, {
      method: "GET",
      token,
      fallbackName,
    });
  },
};

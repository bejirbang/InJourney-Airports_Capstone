import { request, unwrap, type ApiRole } from "@/lib/api";

// Semua endpoint /api/intern/* beserta tipe responsnya (progress.md 4.1, Fase 2).

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

/** Rekap satu bulan (`AttendanceCalendar::recap`), dihitung server. */
export interface ApiAttendanceRecap {
  month: string;
  present: number;
  late: number;
  missed_clock_in: number;
  leave: number;
  absent: number;
  missed_clock_out: number;
  corrected: number;
  working_days: number;
}

/** Batas bulan yang bisa dibuka; navigasi bulan mengikuti nilai ini. */
export interface ApiSelectableMonths {
  first: string;
  last: string;
}

export interface ApiLeaveQuota {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

export interface ApiPresentationBanner {
  state: ApiPresentationState;
  end_date: string;
  days_left: number;
}

/** Baris "Perlu ditindak" di dashboard (semua tautan langsung ke itemnya). */
export interface ApiActionNeeded {
  logbooks: { date: string; logbook_state: string; comment: string | null }[];
  warnings: { id: number; created_at: string | null }[];
  corrections: { id: number; date: string; status: string; decided_at: string | null }[];
  leaves: {
    id: number;
    type: ApiLeaveType;
    start_date: string;
    end_date: string;
    status: ApiLeaveStatus;
    decided_at: string | null;
  }[];
}

export interface ApiAnnouncement {
  id: number;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string | null;
}

/** `GET /api/intern/dashboard` (`InternDashboard::for`). */
export interface InternDashboard {
  /** Tanggal server (YYYY-MM-DD); dipakai untuk menghitung batas tanggal di form. */
  date: string;
  /** Muncul sejak form presentasi terbuka sampai disetujui; null = sembunyikan. */
  presentation_banner: ApiPresentationBanner | null;
  today: TodayStatus;
  /** Sudah clock in hari ini tetapi logbook belum diisi. */
  logbook_reminder: boolean;
  action_needed: ApiActionNeeded;
  /** Hanya status final sampai kemarin; hari ini tidak ikut dihitung. */
  monthly_recap: ApiAttendanceRecap;
  leave_quota: ApiLeaveQuota;
  internship: {
    start_date: string;
    end_date: string;
    mentor: { id: number; name: string };
  } | null;
  announcements: ApiAnnouncement[];
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
/** `missing` = hari hasil koreksi yang belum punya logbook terkirim. */
export type ApiLogbookState = ApiLogbookStatus | "missing";
export type ApiLogbookAction = "save" | "submit" | "resubmit";

/** Riwayat review mentor pada satu logbook. */
export interface ApiLogbookReview {
  action: "revision" | "approved";
  comment: string | null;
  mentor: string | null;
  created_at: string | null;
}

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
  logbook_state: ApiLogbookState | null;
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
  reviews: ApiLogbookReview[];
  /** Aksi yang tersedia: save (draft hari ini), resubmit (revisi), submit (hari hasil koreksi), null = terkunci. */
  action: ApiLogbookAction | null;
}

/** Satu baris daftar logbook per hari kerja (`InternLogbooks::month`). */
export interface ApiLogbookListDay {
  date: string;
  attendance_status: string;
  leave_type: ApiLeaveType | null;
  logbook_state: ApiLogbookState | null;
  work: string | null;
  action: ApiLogbookAction | null;
}

export interface ApiLogbookMonth {
  month: string;
  selectable_months: ApiSelectableMonths;
  action_needed: { date: string; logbook_state: string; comment: string | null }[];
  days: ApiLogbookListDay[];
}

export interface LogbookFilter {
  month?: string;
  status?: ApiLogbookState;
}

/** Satu baris riwayat presensi (`AttendanceHistory::dayFields` + flag koreksi). */
export interface ApiAttendanceDay {
  date: string;
  status: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  missed_clock_out: boolean;
  is_corrected: boolean;
  logbook_state: ApiLogbookState | null;
  holiday_name: string | null;
  leave_type: ApiLeaveType | null;
  has_active_correction: boolean;
  can_request_correction: boolean;
}

/** `GET /api/intern/attendance?month=&status=` */
export interface ApiAttendanceMonth {
  month: string;
  selectable_months: ApiSelectableMonths;
  recap: ApiAttendanceRecap;
  days: ApiAttendanceDay[];
}

export type ApiAttendanceFilter =
  "present" | "late" | "missed_clock_in" | "leave" | "absent" | "holiday" | "missed_clock_out";

/** `GET /api/intern/attendance/days/{date}`: baris yang sama ditambah detail. */
export interface ApiAttendanceDayDetail {
  date: string;
  status: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  missed_clock_out: boolean;
  is_corrected: boolean;
  logbook_state: ApiLogbookState | null;
  holiday_name: string | null;
  leave_type: ApiLeaveType | null;
  scheduled: { start: string; end: string } | null;
  clock_in_office: { id: number; name: string } | null;
  clock_out_office: { id: number; name: string } | null;
  logbook: {
    work: string;
    notes: string | null;
    status: ApiLogbookStatus;
    submitted_at: string | null;
  } | null;
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
   * Clock out. `work`/`notes` ikut dikirim saat dialog logbook tampil (hari tanpa logbook atau
   * Lupa Clock In); server membuat/mengirim logbook sekaligus.
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

  /** Riwayat presensi satu bulan; `recap` selalu sebulan penuh walau daftar difilter. */
  history(token: string, params: { month?: string; status?: ApiAttendanceFilter } = {}) {
    const query = new URLSearchParams();
    if (params.month) query.set("month", params.month);
    if (params.status) query.set("status", params.status);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return request<{ data?: ApiAttendanceMonth } | ApiAttendanceMonth>(
      `/api/intern/attendance${suffix}`,
      { token },
    ).then(unwrap<ApiAttendanceMonth>);
  },

  /** Detail satu hari: titik clock in/out, jadwal, dan logbook. */
  day(token: string, date: string): Promise<ApiAttendanceDayDetail> {
    return request<{ data?: ApiAttendanceDayDetail } | ApiAttendanceDayDetail>(
      `/api/intern/attendance/days/${date}`,
      { token },
    ).then(unwrap<ApiAttendanceDayDetail>);
  },

  /** Daftar logbook per hari kerja satu bulan. */
  logbooks(token: string, params: LogbookFilter = {}): Promise<ApiLogbookMonth> {
    const query = new URLSearchParams();
    if (params.month) query.set("month", params.month);
    if (params.status) query.set("status", params.status);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return request<{ data?: ApiLogbookMonth } | ApiLogbookMonth>(`/api/intern/logbooks${suffix}`, {
      token,
    }).then(unwrap<ApiLogbookMonth>);
  },

  /** Logbook satu tanggal; `logbook` null sebelum diisi. */
  logbook(token: string, date: string): Promise<InternLogbookDay> {
    return request<{ data?: InternLogbookDay } | InternLogbookDay>(`/api/intern/logbooks/${date}`, {
      token,
    }).then(unwrap<InternLogbookDay>);
  },

  /** Simpan isian logbook (draft hari ini, kirim hari hasil koreksi, atau kirim ulang revisi). */
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

// ---- Koreksi presensi intern (Fase 2, Alur 7) ----

export type ApiCorrectionStatus =
  | "pending_mentor"
  | "rejected_by_mentor"
  | "pending_admin"
  | "approved"
  | "rejected_by_admin"
  | "cancelled";

export interface ApiCorrection {
  id: number;
  date: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  reason: string;
  status: ApiCorrectionStatus;
  submitted_at: string | null;
  mentor: { id: number; name: string } | null;
  mentor_note: string | null;
  mentor_decided_at: string | null;
  admin: { id: number; name: string } | null;
  admin_note: string | null;
  admin_decided_at: string | null;
  /** Hanya intern pemilik dan selama masih Menunggu Mentor/Admin. */
  can_cancel: boolean;
  /** Detail (show/cancel): jam yang tercatat saat pengajuan dibuat. */
  recorded?: { clock_in_at: string | null; clock_out_at: string | null };
}

export const correctionApi = {
  list(token: string): Promise<ApiCorrection[]> {
    return request<{ data?: ApiCorrection[] } | ApiCorrection[]>(
      "/api/intern/attendance-corrections",
      { token },
    ).then(unwrap<ApiCorrection[]>);
  },

  show(token: string, id: number): Promise<ApiCorrection> {
    return request<{ data?: ApiCorrection } | ApiCorrection>(
      `/api/intern/attendance-corrections/${id}`,
      { token },
    ).then(unwrap<ApiCorrection>);
  },

  /** Ajukan koreksi: hanya tanggal + alasan (tanpa jam dan tanpa bukti). */
  store(
    token: string,
    input: { date: string; reason: string },
  ): Promise<{ message: string; data: ApiCorrection }> {
    return request("/api/intern/attendance-corrections", {
      method: "POST",
      body: input,
      token,
    });
  },

  cancel(token: string, id: number): Promise<{ message: string; data: ApiCorrection }> {
    return request(`/api/intern/attendance-corrections/${id}/cancel`, {
      method: "POST",
      token,
    });
  },
};

// ---- Presentasi akhir intern (Fase 2, Alur 10) ----

export type ApiPresentationState =
  "not_open" | "not_submitted" | "pending" | "revision" | "approved";

export interface ApiPresentation {
  state: ApiPresentationState;
  end_date: string;
  days_left: number;
  /** Tanggal form mulai menerima link bukti. */
  opens_on: string;
  /** Pesan server saat `state = not_open`; selain itu null. */
  message: string | null;
  evidence_url: string | null;
  submitted_at: string | null;
  decision_note: string | null;
  decided_at: string | null;
  can_submit: boolean;
}

export const presentationApi = {
  show(token: string): Promise<ApiPresentation> {
    return request<{ data?: ApiPresentation } | ApiPresentation>("/api/intern/presentation", {
      token,
    }).then(unwrap<ApiPresentation>);
  },

  submit(token: string, evidenceUrl: string): Promise<{ message: string; data: ApiPresentation }> {
    return request("/api/intern/presentation", {
      method: "PUT",
      body: { evidence_url: evidenceUrl },
      token,
    });
  },
};

// ---- Catatan (warning) dan nilai akhir intern (Fase 2, Alur 11) ----

export interface ApiWarning {
  id: number;
  body: string;
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiAssessmentIndicator {
  id: number;
  category: string | null;
  name: string;
  description: string | null;
  weight: number | null;
  score: number;
}

export type ApiAssessment =
  | { available: false; message: string }
  | {
      available: true;
      final_score: number;
      predicate: string;
      notes: string | null;
      submitted_at: string | null;
      assessed_by: string | null;
      indicators: ApiAssessmentIndicator[];
    };

export const notesApi = {
  warnings(token: string): Promise<ApiWarning[]> {
    return request<{ data?: ApiWarning[] } | ApiWarning[]>("/api/intern/warnings", {
      token,
    }).then(unwrap<ApiWarning[]>);
  },

  assessment(token: string): Promise<ApiAssessment> {
    return request<{ data?: ApiAssessment } | ApiAssessment>("/api/intern/assessment", {
      token,
    }).then(unwrap<ApiAssessment>);
  },
};

// ---- Izin intern (Alur 9) ----

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
  /** Link Google Drive/Docs bukti; null bila tidak dilampirkan. */
  evidence_url: string | null;
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

export interface ApiLeaveList {
  leaves: ApiInternLeave[];
  quota: ApiLeaveQuota;
}

export interface LeaveListParams {
  status?: ApiLeaveStatus;
}

export const leaveApi = {
  /** Riwayat izin + sisa kuota (`meta.quota`). */
  list(token: string, params: LeaveListParams = {}): Promise<ApiLeaveList> {
    const query = params.status ? `?status=${params.status}` : "";
    return request<{
      data?: ApiInternLeave[];
      meta?: { quota?: ApiLeaveQuota };
    }>(`/api/intern/leaves${query}`, { token }).then((body) => ({
      leaves: unwrap<ApiInternLeave[]>(body),
      // Kuota selalu dikirim server; nilai cadangan hanya jaring pengaman tipe.
      quota: body.meta?.quota ?? { used: 0, limit: 0, remaining: 0, exhausted: false },
    }));
  },

  /** "Total: 2 hari kerja" di formulir izin; server memakai kalender libur terbaru. */
  workingDays(token: string, start: string, end: string): Promise<number> {
    return request<{ data?: { working_days: number } }>(
      `/api/intern/leaves/working-days?start_date=${start}&end_date=${end}`,
      { token },
    ).then((body) => unwrap<{ working_days: number }>(body).working_days);
  },

  /** Ajukan izin (JSON: type, start_date, end_date, reason, evidence_url). */
  store(
    token: string,
    input: {
      type: ApiLeaveType;
      start_date: string;
      end_date: string;
      reason: string;
      evidence_url?: string | null;
    },
  ): Promise<{ message: string; leave: ApiInternLeave }> {
    return request<{ message?: string; data?: ApiInternLeave }>("/api/intern/leaves", {
      method: "POST",
      body: {
        type: input.type,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason,
        ...(input.evidence_url ? { evidence_url: input.evidence_url } : {}),
      },
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
};

import { request, unwrap, type ApiRole } from "@/lib/api";
import type {
  ApiAttendanceDay,
  ApiAttendanceDayDetail,
  ApiAttendanceRecap,
  ApiLeaveQuota,
  ApiLeaveStatus,
  ApiLeaveType,
  ApiLogbookState,
  ApiLogbookStatus,
  ApiPresentationState,
  ApiSelectableMonths,
  ApiWarning,
} from "@/lib/endpoints/intern";

// Semua endpoint /api/mentor/* beserta tipe responsnya (progress.md bagian 7, Fase 3).

/** Identitas ringkas intern yang dipakai kotak tindakan dan resource mentor. */
export interface MentorPerson {
  id: number;
  name: string;
  short_name: string;
}

export interface MentorTodayRow {
  intern: MentorPerson;
  status: string;
  clock_in_at: string | null;
  late_minutes: number | null;
  missed_clock_out: boolean;
  leave_type: ApiLeaveType | null;
}

/** `today` dari `DashboardCards::today`; null saat semua intern libur. */
export interface MentorTodayCard {
  interns: number;
  clocked_in: number;
  late: number;
  on_leave: number;
  not_clocked_in: number;
  rows: MentorTodayRow[];
}

/** Kotak tindakan dashboard: maksimal lima baris, `total` untuk tombol "semua". */
export interface MentorActionBox<T> {
  total: number;
  items: T[];
}

export interface MentorPendingLogbook {
  id: number;
  intern: MentorPerson;
  date: string;
  work: string;
  is_corrected: boolean;
}

export interface MentorPendingCorrection {
  id: number;
  intern: MentorPerson;
  date: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  reason: string;
}

export interface MentorPendingLeave {
  id: number;
  intern: MentorPerson;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  created_at: string | null;
  pending_hours: number;
  is_overdue: boolean;
}

export interface MentorReadyToAssess {
  intern: MentorPerson;
  end_date: string | null;
  status: string;
}

/** `GET /api/mentor/dashboard` (`MentorDashboard::for`). */
export interface MentorDashboard {
  date: string;
  interns_total: number;
  holiday: { name: string | null } | null;
  today: MentorTodayCard | null;
  pending_logbooks: MentorActionBox<MentorPendingLogbook>;
  pending_corrections: MentorActionBox<MentorPendingCorrection>;
  pending_leaves: MentorActionBox<MentorPendingLeave>;
  ready_to_assess: MentorActionBox<MentorReadyToAssess>;
  announcements: {
    id: number;
    title: string;
    body: string;
    author_name: string | null;
    created_at: string | null;
  }[];
}

// ---- Intern Saya (progress.md 7.2) ----

export type MentorInternFilter = "active" | "inactive" | "former" | "all";
export type MentorInternRelation = "current" | "former";

export interface MentorInternRow {
  id: number;
  name: string;
  unit: string | null;
  airport: string | null;
  institution_type: "universitas" | "sekolah" | null;
  university: string | null;
  major: string | null;
  student_number: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  relation: MentorInternRelation;
  ends_in_days: number | null;
  /** Status presensi hari ini; null untuk intern nonaktif/peserta lama. */
  today_state: string | null;
}

export interface MentorInternList {
  interns: MentorInternRow[];
  current_total: number;
  former_total: number;
}

export interface MentorInternDetail extends Omit<MentorInternRow, "today_state"> {
  email: string;
  phone: string | null;
  current_mentor: { id: number; name: string } | null;
  leave_quota: ApiLeaveQuota;
  selectable_months: ApiSelectableMonths | null;
}

/** Riwayat presensi intern di halaman mentor (tanpa tombol koreksi milik intern). */
export type MentorAttendanceDay = Omit<
  ApiAttendanceDay,
  "has_active_correction" | "can_request_correction"
>;

export interface MentorAttendanceMonth {
  month: string;
  selectable_months: ApiSelectableMonths;
  recap: ApiAttendanceRecap;
  days: MentorAttendanceDay[];
}

export interface MentorInternLogbookDay {
  date: string;
  status: string;
  leave_type: ApiLeaveType | null;
  logbook_state: ApiLogbookState | null;
  logbook: {
    work: string;
    notes: string | null;
    status: ApiLogbookStatus;
    submitted_at: string | null;
  } | null;
}

export interface MentorInternLogbooks {
  month: string;
  selectable_months: ApiSelectableMonths;
  days: MentorInternLogbookDay[];
}

export interface MentorInternLeave {
  id: number;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  working_days: number;
  status: ApiLeaveStatus;
  evidence_url: string | null;
  submitted_at: string | null;
  decided_by: { name: string; role: ApiRole } | null;
  /** Izin hanya bisa dibuka mentor saat intern masih dibimbing. */
  can_open: boolean;
}

// ---- Review logbook (progress.md 7.3) ----

export type MentorLogbookTab = "pending_review" | "revision" | "all";

export interface MentorLogbookRow {
  id: number;
  intern: MentorPerson;
  date: string;
  work: string;
  status: ApiLogbookStatus;
  submitted_at: string | null;
  is_corrected: boolean;
  revision_count: number;
}

export interface MentorLogbookReview {
  action: "revision" | "approved";
  comment: string | null;
  mentor: string | null;
  created_at: string | null;
}

export interface MentorLogbookDetail extends MentorLogbookRow {
  notes: string | null;
  approved_at: string | null;
  attendance: {
    status: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
  } | null;
  reviews: MentorLogbookReview[];
  intern_inactive: boolean;
  /** Peringatan server, misalnya intern nonaktif tidak dapat memperbaiki logbook. */
  warning: string | null;
  can_approve: boolean;
  can_request_revision: boolean;
  previous_id: number | null;
  next_id: number | null;
}

export interface MentorLogbookList {
  logbooks: MentorLogbookRow[];
  counts: { pending_review: number; revision: number };
}

export interface MentorLogbookListParams {
  tab?: MentorLogbookTab;
  intern_id?: number;
}

// ---- Koreksi presensi mentor (progress.md 7.4) ----

export type MentorCorrectionTab = "waiting" | "all";

export type MentorCorrectionStatus =
  | "pending_mentor"
  | "rejected_by_mentor"
  | "pending_admin"
  | "approved"
  | "rejected_by_admin"
  | "cancelled";

export interface MentorCorrection {
  id: number;
  intern: MentorPerson;
  date: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  reason: string;
  status: MentorCorrectionStatus;
  submitted_at: string | null;
  mentor: { id: number; name: string } | null;
  mentor_note: string | null;
  mentor_decided_at: string | null;
  admin: { id: number; name: string } | null;
  admin_note: string | null;
  admin_decided_at: string | null;
  can_cancel: boolean;
  can_decide: boolean;
  /** Detail: jam yang tercatat saat pengajuan dibuat. */
  recorded?: { clock_in_at: string | null; clock_out_at: string | null };
}

export interface MentorCorrectionList {
  corrections: MentorCorrection[];
  pendingCount: number;
}

// ---- Izin mentor dan admin (progress.md 7.5) ----

export type ReviewerLeaveTab = "pending" | "all";

export interface ReviewerLeave {
  id: number;
  intern: MentorPerson;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  working_days: number;
  evidence_url: string | null;
  status: ApiLeaveStatus;
  submitted_at: string | null;
  submitted_late: boolean;
  pending_hours: number;
  is_overdue: boolean;
  decided_by: { name: string; role: ApiRole } | null;
  decided_at: string | null;
  can_decide: boolean;
  /** Hanya admin: boleh Setujui jika sudah lewat batas dan ada link bukti. */
  can_approve?: boolean;
  /** Hanya admin: mentor intern tersebut. */
  mentor?: { id: number; name: string } | null;
  reason?: string;
  decision_note?: string | null;
  quota?: ApiLeaveQuota;
}

export interface ReviewerLeaveList {
  leaves: ReviewerLeave[];
  pendingCount: number;
  /** Admin: pilihan filter intern dari `meta.interns`. */
  interns: { id: number; name: string }[];
}

export interface ReviewerLeaveParams {
  tab?: ReviewerLeaveTab;
  type?: ApiLeaveType;
  intern_id?: number;
  airport_id?: number;
  quota_exhausted?: boolean;
}

// ---- Kalender izin (progress.md 7.6) ----

export interface MentorLeaveCalendarEntry {
  leave_id: number;
  intern_id: number;
  short_name: string;
  type: ApiLeaveType;
  status: ApiLeaveStatus;
}

export interface MentorLeaveCalendarDay {
  date: string;
  weekday: number;
  is_today: boolean;
  is_off: boolean;
  holiday_name: string | null;
  entries: MentorLeaveCalendarEntry[];
}

/** `GET /api/mentor/leave-calendar?month=&intern_id=`. */
export interface MentorLeaveCalendar {
  month: string;
  days: MentorLeaveCalendarDay[];
  leaves: {
    id: number;
    intern: MentorPerson;
    type: ApiLeaveType;
    start_date: string;
    end_date: string;
    status: ApiLeaveStatus;
  }[];
}

// ---- Performa intern (progress.md 7.7) ----

export interface MentorPerformanceRecap {
  present: number;
  late: number;
  missed_clock_in: number;
  missed_clock_out: number;
  leave: number;
  absent: number;
  working_days: number;
}

export interface MentorPerformanceDates {
  present: string[];
  late: string[];
  missed_clock_in: string[];
  missed_clock_out: string[];
  leave: string[];
  absent: string[];
  logbook_not_approved: string[];
  logbook_revisions: string[];
}

export interface MentorPerformanceIntern {
  intern: MentorPerson;
  is_active: boolean;
  recap: MentorPerformanceRecap;
  kpi: {
    enough_data: boolean;
    attendance_rate: number | null;
    on_time_rate: number | null;
    logbook_approved_rate: number | null;
    logbook_revisions: number;
  };
  dates: MentorPerformanceDates;
}

/** `GET /api/mentor/performance?month=&intern_id=`. */
export interface MentorPerformance {
  month: string;
  selectable_months: ApiSelectableMonths | null;
  interns_total: number;
  summary: {
    attendance_rate: number | null;
    on_time_rate: number | null;
    logbook_approved_rate: number | null;
  };
  interns: MentorPerformanceIntern[];
}

// ---- Input nilai (progress.md 7.8) ----

export type MentorAssessmentStatus = "ready" | "blocked" | "draft" | "submitted";

export interface MentorAssessmentBlocker {
  code: string;
  text: string;
}

export interface MentorAssessmentRow {
  intern: MentorPerson;
  end_date: string | null;
  presentation_status: ApiPresentationState | null;
  unapproved_logbooks: number;
  status: MentorAssessmentStatus;
  blockers: MentorAssessmentBlocker[];
  can_assess: boolean;
  final_score: number | null;
  submitted_at: string | null;
  assessed_by: string | null;
}

export interface MentorAssessmentIndicator {
  id: number;
  category: string | null;
  name: string;
  description: string | null;
  weight: number | null;
  /** Null saat draft dan indikator belum diisi. */
  score: number | null;
}

export interface MentorUnapprovedLogbookDay {
  date: string;
  status: ApiLogbookState;
  logbook_id: number | null;
}

/** `GET /api/mentor/assessments/{intern}` (`Assessments::detail`). */
export interface MentorAssessmentDetail extends MentorAssessmentRow {
  start_date: string;
  presentation: {
    id: number;
    status: ApiPresentationState;
    evidence_url: string | null;
    submitted_at: string | null;
    decision_note: string | null;
    decided_by: string | null;
    decided_at: string | null;
  } | null;
  unapproved_logbook_days: MentorUnapprovedLogbookDay[];
  indicators: MentorAssessmentIndicator[];
  predicate: string | null;
  notes: string | null;
  can_edit: boolean;
}

export interface MentorAssessmentInput {
  scores: { indicator_id: number; score: number | null }[];
  notes: string | null;
}

// ---- Helper query ----

function queryString(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [
    string,
    string | number | boolean | undefined,
  ][]) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }
  return query.size > 0 ? `?${query.toString()}` : "";
}

export const mentorApi = {
  dashboard(token: string): Promise<MentorDashboard> {
    return request<{ data?: MentorDashboard } | MentorDashboard>("/api/mentor/dashboard", {
      token,
    }).then(unwrap<MentorDashboard>);
  },

  interns(
    token: string,
    params: { status?: MentorInternFilter; q?: string } = {},
  ): Promise<MentorInternList> {
    return request<{
      data?: MentorInternRow[];
      meta?: { current_total?: number; former_total?: number };
    }>(`/api/mentor/interns${queryString(params)}`, { token }).then((body) => ({
      interns: unwrap<MentorInternRow[]>(body),
      current_total: body.meta?.current_total ?? 0,
      former_total: body.meta?.former_total ?? 0,
    }));
  },

  intern(token: string, id: number): Promise<MentorInternDetail> {
    return request<{ data?: MentorInternDetail } | MentorInternDetail>(
      `/api/mentor/interns/${id}`,
      { token },
    ).then(unwrap<MentorInternDetail>);
  },

  attendance(
    token: string,
    id: number,
    params: { month?: string; status?: string } = {},
  ): Promise<MentorAttendanceMonth> {
    return request<{ data?: MentorAttendanceMonth } | MentorAttendanceMonth>(
      `/api/mentor/interns/${id}/attendance${queryString(params)}`,
      { token },
    ).then(unwrap<MentorAttendanceMonth>);
  },

  attendanceDay(token: string, id: number, date: string): Promise<ApiAttendanceDayDetail> {
    return request<{ data?: ApiAttendanceDayDetail } | ApiAttendanceDayDetail>(
      `/api/mentor/interns/${id}/attendance/days/${date}`,
      { token },
    ).then(unwrap<ApiAttendanceDayDetail>);
  },

  internLogbooks(
    token: string,
    id: number,
    params: { month?: string } = {},
  ): Promise<MentorInternLogbooks> {
    return request<{ data?: MentorInternLogbooks } | MentorInternLogbooks>(
      `/api/mentor/interns/${id}/logbooks${queryString(params)}`,
      { token },
    ).then(unwrap<MentorInternLogbooks>);
  },

  internLeaves(token: string, id: number): Promise<MentorInternLeave[]> {
    return request<{ data?: MentorInternLeave[] } | MentorInternLeave[]>(
      `/api/mentor/interns/${id}/leaves`,
      { token },
    ).then(unwrap<MentorInternLeave[]>);
  },

  internCorrections(token: string, id: number): Promise<MentorCorrection[]> {
    return request<{ data?: MentorCorrection[] } | MentorCorrection[]>(
      `/api/mentor/interns/${id}/corrections`,
      { token },
    ).then(unwrap<MentorCorrection[]>);
  },

  internWarnings(token: string, id: number): Promise<ApiWarning[]> {
    return request<{ data?: ApiWarning[] } | ApiWarning[]>(`/api/mentor/interns/${id}/warnings`, {
      token,
    }).then(unwrap<ApiWarning[]>);
  },

  logbooks(token: string, params: MentorLogbookListParams = {}): Promise<MentorLogbookList> {
    return request<{
      data?: MentorLogbookRow[];
      meta?: { pending_review?: number; revision?: number };
    }>(`/api/mentor/logbooks${queryString(params)}`, { token }).then((body) => ({
      logbooks: unwrap<MentorLogbookRow[]>(body),
      counts: {
        pending_review: body.meta?.pending_review ?? 0,
        revision: body.meta?.revision ?? 0,
      },
    }));
  },

  logbook(token: string, id: number, tab?: MentorLogbookTab): Promise<MentorLogbookDetail> {
    return request<{ data?: MentorLogbookDetail } | MentorLogbookDetail>(
      `/api/mentor/logbooks/${id}${queryString({ tab })}`,
      { token },
    ).then(unwrap<MentorLogbookDetail>);
  },

  approveLogbook(
    token: string,
    id: number,
    comment: string | null,
  ): Promise<{ message: string; data: MentorLogbookDetail }> {
    return request(`/api/mentor/logbooks/${id}/approve`, {
      method: "POST",
      body: comment === null ? {} : { comment },
      token,
    });
  },

  reviseLogbook(
    token: string,
    id: number,
    comment: string,
  ): Promise<{ message: string; data: MentorLogbookDetail }> {
    return request(`/api/mentor/logbooks/${id}/revise`, {
      method: "POST",
      body: { comment },
      token,
    });
  },

  approveLogbooks(
    token: string,
    ids: number[],
  ): Promise<{ message: string; data: { approved: number[]; skipped: number[] } }> {
    return request("/api/mentor/logbooks/approve", {
      method: "POST",
      body: { ids },
      token,
    });
  },

  corrections(
    token: string,
    params: { tab?: MentorCorrectionTab; intern_id?: number } = {},
  ): Promise<{ corrections: MentorCorrection[]; pendingCount: number }> {
    return request<{
      data?: MentorCorrection[];
      meta?: { pending_count?: number };
    }>(`/api/mentor/corrections${queryString(params)}`, { token }).then((body) => ({
      corrections: unwrap<MentorCorrection[]>(body),
      pendingCount: body.meta?.pending_count ?? 0,
    }));
  },

  correction(token: string, id: number): Promise<MentorCorrection> {
    return request<{ data?: MentorCorrection } | MentorCorrection>(
      `/api/mentor/corrections/${id}`,
      { token },
    ).then(unwrap<MentorCorrection>);
  },

  approveCorrection(
    token: string,
    id: number,
    note: string | null,
  ): Promise<{ message: string; data: MentorCorrection }> {
    return request(`/api/mentor/corrections/${id}/approve`, {
      method: "POST",
      body: note === null ? {} : { note },
      token,
    });
  },

  rejectCorrection(
    token: string,
    id: number,
    note: string,
  ): Promise<{ message: string; data: MentorCorrection }> {
    return request(`/api/mentor/corrections/${id}/reject`, {
      method: "POST",
      body: { note },
      token,
    });
  },

  leaves(token: string, params: ReviewerLeaveParams = {}): Promise<ReviewerLeaveList> {
    return request<{
      data?: ReviewerLeave[];
      meta?: { pending_count?: number; interns?: { id: number; name: string }[] };
    }>(`/api/mentor/leaves${queryString(params)}`, { token }).then((body) => ({
      leaves: unwrap<ReviewerLeave[]>(body),
      pendingCount: body.meta?.pending_count ?? 0,
      interns: body.meta?.interns ?? [],
    }));
  },

  leave(token: string, id: number): Promise<ReviewerLeave> {
    return request<{ data?: ReviewerLeave } | ReviewerLeave>(`/api/mentor/leaves/${id}`, {
      token,
    }).then(unwrap<ReviewerLeave>);
  },

  approveLeave(
    token: string,
    id: number,
    note: string,
  ): Promise<{ message: string; data: ReviewerLeave }> {
    return request(`/api/mentor/leaves/${id}/approve`, {
      method: "POST",
      body: { note },
      token,
    });
  },

  rejectLeave(
    token: string,
    id: number,
    note: string,
  ): Promise<{ message: string; data: ReviewerLeave }> {
    return request(`/api/mentor/leaves/${id}/reject`, {
      method: "POST",
      body: { note },
      token,
    });
  },

  leaveCalendar(
    token: string,
    params: { month: string; intern_id?: number },
  ): Promise<MentorLeaveCalendar> {
    return request<{ data?: MentorLeaveCalendar } | MentorLeaveCalendar>(
      `/api/mentor/leave-calendar${queryString(params)}`,
      { token },
    ).then(unwrap<MentorLeaveCalendar>);
  },

  performance(
    token: string,
    params: { month?: string; intern_id?: number },
  ): Promise<MentorPerformance> {
    return request<{ data?: MentorPerformance } | MentorPerformance>(
      `/api/mentor/performance${queryString(params)}`,
      { token },
    ).then(unwrap<MentorPerformance>);
  },

  assessments(token: string): Promise<MentorAssessmentRow[]> {
    return request<{ data?: MentorAssessmentRow[] } | MentorAssessmentRow[]>(
      "/api/mentor/assessments",
      { token },
    ).then(unwrap<MentorAssessmentRow[]>);
  },

  assessment(token: string, internId: number): Promise<MentorAssessmentDetail> {
    return request<{ data?: MentorAssessmentDetail } | MentorAssessmentDetail>(
      `/api/mentor/assessments/${internId}`,
      { token },
    ).then(unwrap<MentorAssessmentDetail>);
  },

  saveAssessment(
    token: string,
    internId: number,
    input: MentorAssessmentInput,
  ): Promise<{ message: string; data: MentorAssessmentDetail }> {
    return request(`/api/mentor/assessments/${internId}`, {
      method: "PUT",
      body: input,
      token,
    });
  },

  submitAssessment(
    token: string,
    internId: number,
    input: MentorAssessmentInput,
  ): Promise<{ message: string; data: MentorAssessmentDetail }> {
    return request(`/api/mentor/assessments/${internId}/submit`, {
      method: "POST",
      body: input,
      token,
    });
  },
};

// ---- Izin admin (dipakai halaman Izin bersama; detail penuh di Fase 4) ----

export const adminLeaveApi = {
  list(token: string, params: ReviewerLeaveParams = {}): Promise<ReviewerLeaveList> {
    return request<{
      data?: ReviewerLeave[];
      meta?: { pending_count?: number; interns?: { id: number; name: string }[] };
    }>(`/api/admin/leaves${queryString(params)}`, { token }).then((body) => ({
      leaves: unwrap<ReviewerLeave[]>(body),
      pendingCount: body.meta?.pending_count ?? 0,
      interns: body.meta?.interns ?? [],
    }));
  },

  show(token: string, id: number): Promise<ReviewerLeave> {
    return request<{ data?: ReviewerLeave } | ReviewerLeave>(`/api/admin/leaves/${id}`, {
      token,
    }).then(unwrap<ReviewerLeave>);
  },

  approve(
    token: string,
    id: number,
    input: { note: string; evidence_checked: boolean },
  ): Promise<{ message: string; data: ReviewerLeave }> {
    return request(`/api/admin/leaves/${id}/approve`, {
      method: "POST",
      body: input,
      token,
    });
  },

  reject(
    token: string,
    id: number,
    note: string,
  ): Promise<{ message: string; data: ReviewerLeave }> {
    return request(`/api/admin/leaves/${id}/reject`, {
      method: "POST",
      body: { note },
      token,
    });
  },
};

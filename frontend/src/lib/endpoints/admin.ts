import { downloadFile, request, unwrap } from "@/lib/api";
import type { ApiLeaveQuota, ApiLeaveType } from "@/lib/endpoints/intern";

// Semua endpoint /api/admin/* beserta tipe responsnya (progress.md bagian 8, Fase 4).

export type AdminRole = "intern" | "mentor" | "admin";
export type AdminAccountStatus = "active" | "not_started" | "inactive";
export type AdminInstitutionType = "universitas" | "sekolah";

export interface AdminRef {
  id: number;
  name: string;
}

export interface AdminPerson {
  id: number;
  name: string;
  short_name: string;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Bentuk standar respons aksi admin: pesan server + data terbaru. */
export interface AdminMutation<T> {
  message: string;
  data: T;
}

/** Kotak tindakan dashboard: maksimal lima baris dan jumlah totalnya. */
export interface AdminActionBox<T> {
  total: number;
  items: T[];
}

export interface AdminTodayRow {
  intern: AdminPerson;
  status: string;
  clock_in_at: string | null;
  late_minutes: number | null;
  missed_clock_out: boolean;
  leave_type: ApiLeaveType | null;
}

export interface AdminTodayCard {
  interns: number;
  clocked_in: number;
  late: number;
  on_leave: number;
  not_clocked_in: number;
  rows: AdminTodayRow[];
}

export interface AdminYesterday {
  date: string;
  present: number;
  late: number;
  missed_clock_in: number;
  leave: number;
  absent: number;
  missed_clock_out: number;
  rows: AdminTodayRow[];
}

export interface AdminPendingCorrection {
  id: number;
  intern: AdminPerson;
  date: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  mentor_decided_at: string | null;
}

export interface AdminOverdueLeave {
  id: number;
  intern: AdminPerson;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  created_at: string | null;
  pending_hours: number;
}

export interface AdminPendingPresentation {
  id: number;
  intern: AdminPerson;
  evidence_url: string;
  submitted_at: string;
}

export interface AdminEndingInternship {
  intern: AdminPerson;
  end_date: string;
  ends_in_days: number;
  mentor: AdminRef;
}

export interface AdminQuotaExhausted {
  intern: AdminPerson;
  quota: ApiLeaveQuota | null;
}

export interface AdminNewAssessment {
  intern: AdminPerson;
  final_score: number;
  assessed_by: string | null;
  submitted_at: string | null;
}

export interface AdminCampus {
  university: string;
  total: number;
}

/** `GET /api/admin/dashboard` (`AdminDashboard::for`). */
export interface AdminDashboardData {
  date: string;
  airport_id: number | null;
  holiday: { name: string | null } | null;
  has_active_office: boolean;
  today: AdminTodayCard | null;
  yesterday: AdminYesterday | null;
  pending_corrections: AdminActionBox<AdminPendingCorrection>;
  overdue_leaves: AdminActionBox<AdminOverdueLeave>;
  pending_presentations: AdminActionBox<AdminPendingPresentation>;
  ending_internships: AdminActionBox<AdminEndingInternship>;
  quota_exhausted: AdminActionBox<AdminQuotaExhausted>;
  new_assessments: AdminActionBox<AdminNewAssessment>;
  campuses: AdminCampus[];
}

// ---- Pengguna (AdminUserResource + detail AdminUsers) ----

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  unit: AdminRef | null;
  status: AdminAccountStatus;
  mentor: AdminRef | null;
  airport: AdminRef | null;
  institution_type: AdminInstitutionType | null;
  university: string | null;
  major: string | null;
  student_number: string | null;
  start_date: string | null;
  end_date: string | null;
  phone?: string | null;
  is_active?: boolean;
  must_change_password?: boolean;
  created_at?: string | null;
  former_mentors?: AdminRef[];
  leave_quota?: ApiLeaveQuota | null;
  interns?: { id: number; name: string; status: AdminAccountStatus }[];
}

export interface AdminUserList {
  rows: AdminUser[];
  meta: PaginationMeta;
}

export interface AdminUserFilters {
  q?: string;
  role?: AdminRole | "";
  status?: AdminAccountStatus | "all";
  page?: number;
  airport_id?: number;
}

export interface AdminMentorOption extends AdminRef {
  unit: AdminRef | null;
}

export interface AdminUserCreateInput {
  name: string;
  email: string;
  role: AdminRole;
  unit_id?: number;
  mentor_id?: number;
  airport_id?: number;
  institution_type?: AdminInstitutionType;
  university?: string;
  major?: string;
  student_number?: string;
  start_date?: string;
  end_date?: string;
}

export type AdminUserUpdateInput = Omit<AdminUserCreateInput, "role" | "mentor_id">;

export interface AdminMentorChangeImpact {
  current_mentor: AdminRef | null;
  pending_corrections: number;
  pending_leaves: number;
}

export interface AdminInternLeave {
  id: number;
  type: ApiLeaveType;
  start_date: string;
  end_date: string;
  working_days: number;
  status: string;
  evidence_url: string | null;
  submitted_at: string | null;
  decided_by: { name: string; role: AdminRole } | null;
  decision_note: string | null;
  decided_at: string | null;
}

export interface AdminInternCorrection {
  id: number;
  date: string;
  submitted_at: string | null;
  status: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  reason: string;
  mentor: string | null;
  mentor_note: string | null;
  mentor_decided_at: string | null;
  admin: string | null;
  admin_note: string | null;
  admin_decided_at: string | null;
}

// ---- Presensi admin ----

export interface AdminAttendanceRecap {
  present: number;
  late: number;
  missed_clock_in: number;
  leave: number;
  absent: number;
  missed_clock_out: number;
  corrected: number;
  working_days: number;
}

export interface AdminAttendanceInternRow {
  intern: AdminPerson;
  airport: AdminRef | null;
  mentor: AdminRef | null;
  recap: AdminAttendanceRecap;
  attendance_rate: number | null;
}

export interface AdminAttendanceMonth {
  month: string;
  selectable_months: { first: string; last: string } | null;
  interns: AdminAttendanceInternRow[];
}

export interface AdminAttendanceDailyRow {
  intern: AdminPerson;
  status: string;
  clock_in_at: string | null;
  late_minutes: number | null;
  missed_clock_out: boolean;
  leave_type: ApiLeaveType | null;
  clock_out_at: string | null;
  is_corrected: boolean;
  airport: AdminRef | null;
}

export interface AdminAttendanceDaily {
  date: string;
  counts: Record<string, number>;
  interns: AdminAttendanceDailyRow[];
}

// ---- Koreksi admin ----

export type AdminCorrectionTab = "pending_admin" | "pending_mentor" | "all";

export interface AdminCorrection {
  id: number;
  intern?: AdminPerson;
  date: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  reason: string;
  status: string;
  submitted_at: string | null;
  mentor: AdminRef | null;
  mentor_note: string | null;
  mentor_decided_at: string | null;
  admin: AdminRef | null;
  admin_note: string | null;
  admin_decided_at: string | null;
  can_decide: boolean;
  recorded?: { clock_in_at: string | null; clock_out_at: string | null };
  result?: { clock_in_at: string; clock_out_at: string } | null;
}

export interface AdminCorrectionList {
  rows: AdminCorrection[];
  pendingAdmin: number;
  pendingMentor: number;
  interns: AdminRef[];
}

// ---- Presentasi akhir admin ----

export type AdminPresentationTab = "pending" | "revision" | "approved" | "not_submitted";

export interface AdminPresentationRow {
  id: number | null;
  intern: AdminPerson;
  mentor: AdminRef;
  airport: AdminRef;
  end_date: string;
  days_left: number;
  status: string;
  evidence_url: string | null;
  submitted_at: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  can_decide: boolean;
}

export interface AdminPresentationList {
  rows: AdminPresentationRow[];
  counts: Record<AdminPresentationTab, number>;
}

// ---- Penilaian admin ----

export type AdminAssessmentStatus = "ready" | "blocked" | "draft" | "submitted";
export type AdminAssessmentFilter = AdminAssessmentStatus | "";

export interface AdminAssessmentBlocker {
  code: string;
  text: string;
}

export interface AdminAssessmentRow {
  intern: AdminPerson;
  mentor: AdminRef | null;
  airport: AdminRef | null;
  end_date: string | null;
  presentation_status: string | null;
  unapproved_logbooks: number;
  status: AdminAssessmentStatus;
  blockers: AdminAssessmentBlocker[];
  can_assess: boolean;
  final_score: number | null;
  submitted_at: string | null;
  assessed_by: string | null;
}

export interface AdminAssessmentList {
  rows: AdminAssessmentRow[];
  counts: Record<AdminAssessmentStatus, number>;
}

export interface AdminAssessmentIndicator {
  id: number;
  category: string | null;
  name: string;
  description: string | null;
  weight: number | null;
  score: number | null;
}

export interface AdminAssessmentDetail {
  intern: AdminPerson;
  start_date: string;
  end_date: string;
  presentation: {
    id: number;
    status: string;
    evidence_url: string;
    submitted_at: string;
    decision_note: string | null;
    decided_by: string | null;
    decided_at: string | null;
  } | null;
  presentation_status: string | null;
  unapproved_logbooks: number;
  status: AdminAssessmentStatus;
  blockers: AdminAssessmentBlocker[];
  can_assess: boolean;
  final_score: number | null;
  submitted_at: string | null;
  unapproved_logbook_days: string[];
  assessed_by: string | null;
  indicators: AdminAssessmentIndicator[];
  predicate: string | null;
  notes: string | null;
  can_edit: boolean;
}

// ---- Warning ----

export interface AdminWarningSummary {
  id: number;
  name: string;
  warnings: number;
}

export interface AdminWarning {
  id: number;
  body: string;
  author: AdminRef | null;
  created_at: string | null;
  updated_at: string | null;
  can_edit: boolean;
}

export interface AdminWarningDetail {
  mentor: AdminRef | null;
  late_this_month: number;
  leave_quota: ApiLeaveQuota | null;
  warnings: AdminWarning[];
}

// ---- Pengumuman ----

export interface AdminAnnouncement {
  id: number;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  for_intern: boolean;
  for_mentor: boolean;
}

export interface AdminAnnouncementInput {
  title: string;
  body: string;
  for_intern: boolean;
  for_mentor: boolean;
}

// ---- Pengaturan ----

export interface AdminGeneralSettings {
  late_tolerance_minutes: number;
  leave_quota: number;
  end_reminder_days: number;
  leave_escalation_hours: number;
}

export interface AdminUnit {
  id: number;
  name: string;
  is_active: boolean;
  user_count: number;
}

export interface AdminHoliday {
  id: number;
  date: string;
  name: string;
  /** Tanggal lampau: menyimpannya butuh konfirmasi (presensi dihitung ulang). */
  is_past: boolean;
}

export interface AdminHolidayInput {
  date: string;
  name: string;
  confirm?: boolean;
}

// ---- Lokasi & jadwal ----

export interface AdminOfficeAirport {
  id: number;
  name: string;
}

export interface AdminOffice {
  id: number;
  airport_id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
  is_active: boolean;
  airport: AdminOfficeAirport | null;
}

export interface AdminOfficeInput {
  airport_id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
}

export type AdminOfficeUpdateInput = Omit<AdminOfficeInput, "airport_id">;

export interface WeeklyDay {
  day_of_week: number;
  is_workday: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface WeeklySet {
  effective_from: string;
  days: WeeklyDay[];
  summary: string;
}

export interface AdminSpecialSchedule {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  state: "upcoming" | "running" | "finished";
  can_edit: boolean;
}

export type AdminSpecialScheduleInput = Omit<AdminSpecialSchedule, "id" | "state" | "can_edit">;

export interface AdminAirport {
  id: number;
  name: string;
  city: string;
  is_active: boolean;
  active_offices: number;
  active_interns: number;
  weekly_schedule: WeeklySet | null;
}

export interface AdminAirportDetail extends AdminAirport {
  offices: Omit<AdminOffice, "airport" | "airport_id">[];
  upcoming_weekly_schedules: WeeklySet[];
  special_schedules: AdminSpecialSchedule[];
}

export interface AdminAirportCreateInput {
  name: string;
  city: string;
  effective_from: string;
  days: WeeklyDay[];
}

export interface AdminAirportUpdateInput {
  name: string;
  city?: string;
}

// ---- Laporan ----

export interface AdminReportOptions {
  interns: { id: number; name: string; email: string }[];
  mentors: { id: number; name: string; is_active: boolean }[];
  airports: { id: number; name: string; is_active: boolean }[];
  sheets: Record<string, string>;
}

export interface AdminReportFilters {
  from: string;
  to: string;
  airport_id?: number | null;
  mentor_id?: number | null;
  intern_ids?: number[];
  sheets?: string[];
  quota_exhausted?: boolean;
}

export interface AdminAttendancePdfInput {
  intern_id: number;
  month: string;
}

export interface AdminAssessmentPdfInput {
  intern_id: number;
}

// ---- Log aktivitas ----

export interface AdminAuditLog {
  id: number;
  created_at: string | null;
  admin: AdminRef;
  action: string;
  object: string;
  detail: string;
}

export interface AdminAuditLogList {
  rows: AdminAuditLog[];
  meta: PaginationMeta;
}

export interface AdminAuditLogFilters {
  from?: string;
  to?: string;
  admin_id?: number;
  action?: string;
  page?: number;
}

export interface AdminAuditLogOptions {
  admins: AdminRef[];
  actions: string[];
}

const query = (params: Record<string, string | number | boolean | null | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const value = search.toString();
  return value === "" ? "" : `?${value}`;
};

const tokenOnly = (token: string) => ({ token });

export const adminApi = {
  dashboard(token: string, airportId: number | null = null): Promise<AdminDashboardData> {
    return request<{ data: AdminDashboardData }>(
      `/api/admin/dashboard${query({ airport_id: airportId })}`,
      tokenOnly(token),
    ).then(unwrap<AdminDashboardData>);
  },

  endingInternships(token: string): Promise<AdminEndingInternship[]> {
    return request<{ data: AdminEndingInternship[] }>("/api/admin/ending-internships", {
      token,
    }).then(unwrap<AdminEndingInternship[]>);
  },

  users: {
    list(token: string, filters: AdminUserFilters = {}): Promise<AdminUserList> {
      return request<{
        data: AdminUser[];
        meta: PaginationMeta;
      }>(`/api/admin/users${query({ ...filters })}`, tokenOnly(token)).then((body) => ({
        rows: body.data ?? [],
        meta: body.meta ?? {
          current_page: 1,
          last_page: 1,
          per_page: 10,
          total: body.data?.length ?? 0,
        },
      }));
    },

    mentors(token: string): Promise<AdminMentorOption[]> {
      return request<{ data: AdminMentorOption[] }>("/api/admin/mentors", tokenOnly(token)).then(
        unwrap<AdminMentorOption[]>,
      );
    },

    show(token: string, id: number): Promise<AdminUser> {
      return request<{ data: AdminUser }>(`/api/admin/users/${id}`, tokenOnly(token)).then(
        unwrap<AdminUser>,
      );
    },

    create(
      token: string,
      input: AdminUserCreateInput,
    ): Promise<{ data: AdminUser; temporary_password: string }> {
      return request<{ data: AdminUser; temporary_password: string }>("/api/admin/users", {
        method: "POST",
        body: input,
        token,
      });
    },

    update(
      token: string,
      id: number,
      input: AdminUserUpdateInput,
    ): Promise<AdminMutation<AdminUser>> {
      return request<AdminMutation<AdminUser>>(`/api/admin/users/${id}`, {
        method: "PUT",
        body: input,
        token,
      });
    },

    mentorChange(token: string, id: number): Promise<AdminMentorChangeImpact> {
      return request<{ data: AdminMentorChangeImpact }>(
        `/api/admin/users/${id}/mentor-change`,
        tokenOnly(token),
      ).then(unwrap<AdminMentorChangeImpact>);
    },

    changeMentor(token: string, id: number, mentorId: number): Promise<AdminMutation<AdminUser>> {
      return request<AdminMutation<AdminUser>>(`/api/admin/users/${id}/mentor`, {
        method: "POST",
        body: { mentor_id: mentorId },
        token,
      });
    },

    deactivate(token: string, id: number): Promise<AdminMutation<AdminUser>> {
      return request<AdminMutation<AdminUser>>(`/api/admin/users/${id}/deactivate`, {
        method: "POST",
        token,
      });
    },

    activate(token: string, id: number): Promise<AdminMutation<AdminUser>> {
      return request<AdminMutation<AdminUser>>(`/api/admin/users/${id}/activate`, {
        method: "POST",
        token,
      });
    },

    extend(token: string, id: number, endDate: string): Promise<AdminMutation<AdminUser>> {
      return request<AdminMutation<AdminUser>>(`/api/admin/users/${id}/extend`, {
        method: "POST",
        body: { end_date: endDate },
        token,
      });
    },

    resetPassword(token: string, id: number): Promise<string> {
      return request<{ temporary_password: string }>(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
        token,
      }).then((body) => body.temporary_password);
    },

    /** Detail intern yang dipakai tab-tab di halaman Pengguna. */
    attendance(
      token: string,
      id: number,
      month: string | null,
    ): Promise<{
      month: string;
      selectable_months: { first: string; last: string };
      recap: AdminAttendanceRecap;
      days: {
        date: string;
        status: string;
        clock_in_at: string | null;
        clock_out_at: string | null;
        late_minutes: number | null;
        missed_clock_out: boolean;
        is_corrected: boolean;
        logbook_state: string | null;
        holiday_name: string | null;
        leave_type: ApiLeaveType | null;
        logbook_work: string | null;
        has_active_correction: boolean;
      }[];
    }> {
      return request<{ data: never }>(
        `/api/admin/users/${id}/attendance${query({ month })}`,
        tokenOnly(token),
      ).then(unwrap);
    },

    attendanceDay(
      token: string,
      id: number,
      date: string,
    ): Promise<{
      date: string;
      status: string;
      clock_in_at: string | null;
      clock_out_at: string | null;
      late_minutes: number | null;
      missed_clock_out: boolean;
      is_corrected: boolean;
      logbook_state: string | null;
      holiday_name: string | null;
      leave_type: ApiLeaveType | null;
      scheduled: { start: string; end: string } | null;
      clock_in_office: AdminRef | null;
      clock_out_office: AdminRef | null;
      logbook: {
        work: string;
        notes: string | null;
        status: string;
        submitted_at: string | null;
      } | null;
    }> {
      return request<{ data: never }>(
        `/api/admin/users/${id}/attendance/days/${date}`,
        tokenOnly(token),
      ).then(unwrap);
    },

    logbooks(
      token: string,
      id: number,
      month: string | null,
    ): Promise<{
      month: string;
      selectable_months: { first: string; last: string };
      days: {
        date: string;
        status: string;
        leave_type: ApiLeaveType | null;
        logbook_state: string | null;
        logbook: {
          work: string;
          notes: string | null;
          status: string;
          submitted_at: string | null;
        } | null;
      }[];
    }> {
      return request<{ data: never }>(
        `/api/admin/users/${id}/logbooks${query({ month })}`,
        tokenOnly(token),
      ).then(unwrap);
    },

    leaves(token: string, id: number): Promise<AdminInternLeave[]> {
      return request<{ data: AdminInternLeave[] }>(`/api/admin/users/${id}/leaves`, {
        token,
      }).then(unwrap<AdminInternLeave[]>);
    },

    corrections(token: string, id: number): Promise<AdminInternCorrection[]> {
      return request<{ data: AdminInternCorrection[] }>(`/api/admin/users/${id}/corrections`, {
        token,
      }).then(unwrap<AdminInternCorrection[]>);
    },
  },

  attendance: {
    month(
      token: string,
      params: { month?: string; airport_id?: number | null; q?: string } = {},
    ): Promise<AdminAttendanceMonth> {
      return request<{ data: AdminAttendanceMonth }>(
        `/api/admin/attendance${query({ ...params })}`,
        tokenOnly(token),
      ).then(unwrap<AdminAttendanceMonth>);
    },

    daily(
      token: string,
      params: { date?: string; airport_id?: number | null; q?: string } = {},
    ): Promise<AdminAttendanceDaily> {
      return request<{ data: AdminAttendanceDaily }>(
        `/api/admin/attendance/daily${query({ ...params })}`,
        tokenOnly(token),
      ).then(unwrap<AdminAttendanceDaily>);
    },
  },

  corrections: {
    list(
      token: string,
      params: {
        tab?: AdminCorrectionTab;
        intern_id?: number | null;
        airport_id?: number | null;
      } = {},
    ): Promise<AdminCorrectionList> {
      return request<{
        data: AdminCorrection[];
        meta: { pending_admin: number; pending_mentor: number; interns: AdminRef[] };
      }>(`/api/admin/corrections${query({ ...params })}`, tokenOnly(token)).then((body) => ({
        rows: body.data ?? [],
        pendingAdmin: body.meta?.pending_admin ?? 0,
        pendingMentor: body.meta?.pending_mentor ?? 0,
        interns: body.meta?.interns ?? [],
      }));
    },

    show(token: string, id: number): Promise<AdminCorrection> {
      return request<AdminCorrection>(`/api/admin/corrections/${id}`, tokenOnly(token));
    },

    approve(
      token: string,
      id: number,
      note: string,
    ): Promise<{ message: string; data: AdminCorrection }> {
      return request(`/api/admin/corrections/${id}/approve`, {
        method: "POST",
        body: { note },
        token,
      });
    },

    reject(
      token: string,
      id: number,
      note: string,
    ): Promise<{ message: string; data: AdminCorrection }> {
      return request(`/api/admin/corrections/${id}/reject`, {
        method: "POST",
        body: { note },
        token,
      });
    },
  },

  presentations: {
    list(
      token: string,
      params: { tab?: AdminPresentationTab; airport_id?: number | null } = {},
    ): Promise<AdminPresentationList> {
      return request<{
        data: AdminPresentationRow[];
        meta: Record<string, number>;
      }>(`/api/admin/presentations${query({ ...params })}`, tokenOnly(token)).then((body) => ({
        rows: body.data ?? [],
        counts: {
          pending: body.meta?.["pending"] ?? 0,
          revision: body.meta?.["revision"] ?? 0,
          approved: body.meta?.["approved"] ?? 0,
          not_submitted: body.meta?.["not_submitted"] ?? 0,
        },
      }));
    },

    show(token: string, id: number): Promise<AdminPresentationRow> {
      return request<{ data: AdminPresentationRow }>(`/api/admin/presentations/${id}`, {
        token,
      }).then(unwrap<AdminPresentationRow>);
    },

    approve(token: string, id: number): Promise<{ message: string; data: AdminPresentationRow }> {
      return request(`/api/admin/presentations/${id}/approve`, {
        method: "POST",
        token,
      });
    },

    revise(
      token: string,
      id: number,
      note: string,
    ): Promise<{ message: string; data: AdminPresentationRow }> {
      return request(`/api/admin/presentations/${id}/revise`, {
        method: "POST",
        body: { note },
        token,
      });
    },
  },

  assessments: {
    list(
      token: string,
      params: { status?: AdminAssessmentFilter; airport_id?: number | null } = {},
    ): Promise<AdminAssessmentList> {
      return request<{
        data: AdminAssessmentRow[];
        meta: Record<string, number>;
      }>(`/api/admin/assessments${query({ ...params })}`, tokenOnly(token)).then((body) => ({
        rows: body.data ?? [],
        counts: {
          ready: body.meta?.["ready"] ?? 0,
          blocked: body.meta?.["blocked"] ?? 0,
          draft: body.meta?.["draft"] ?? 0,
          submitted: body.meta?.["submitted"] ?? 0,
        },
      }));
    },

    show(token: string, id: number): Promise<AdminAssessmentDetail> {
      return request<{ data: AdminAssessmentDetail }>(`/api/admin/assessments/${id}`, {
        token,
      }).then(unwrap<AdminAssessmentDetail>);
    },
  },

  warnings: {
    list(token: string, search?: string): Promise<AdminWarningSummary[]> {
      return request<{ data: AdminWarningSummary[] }>(
        `/api/admin/warnings${query({ q: search })}`,
        tokenOnly(token),
      ).then(unwrap<AdminWarningSummary[]>);
    },

    forIntern(token: string, id: number): Promise<AdminWarningDetail> {
      return request<{ data: AdminWarningDetail }>(`/api/admin/users/${id}/warnings`, {
        token,
      }).then(unwrap<AdminWarningDetail>);
    },

    create(token: string, id: number, body: string): Promise<AdminMutation<AdminWarning>> {
      return request<AdminMutation<AdminWarning>>(`/api/admin/users/${id}/warnings`, {
        method: "POST",
        body: { body },
        token,
      });
    },

    update(token: string, id: number, body: string): Promise<AdminMutation<AdminWarning>> {
      return request<AdminMutation<AdminWarning>>(`/api/admin/warnings/${id}`, {
        method: "PUT",
        body: { body },
        token,
      });
    },
  },

  announcements: {
    list(token: string): Promise<AdminAnnouncement[]> {
      return request<{ data: AdminAnnouncement[] }>("/api/admin/announcements", {
        token,
      }).then(unwrap<AdminAnnouncement[]>);
    },

    create(
      token: string,
      input: AdminAnnouncementInput,
    ): Promise<AdminMutation<AdminAnnouncement>> {
      return request<AdminMutation<AdminAnnouncement>>("/api/admin/announcements", {
        method: "POST",
        body: input,
        token,
      });
    },

    update(
      token: string,
      id: number,
      input: AdminAnnouncementInput,
    ): Promise<AdminMutation<AdminAnnouncement>> {
      return request<AdminMutation<AdminAnnouncement>>(`/api/admin/announcements/${id}`, {
        method: "PUT",
        body: input,
        token,
      });
    },

    remove(token: string, id: number): Promise<string> {
      return request<{ message: string }>(`/api/admin/announcements/${id}`, {
        method: "DELETE",
        token,
      }).then((body) => body.message);
    },
  },

  settings: {
    show(token: string): Promise<AdminGeneralSettings> {
      return request<{ data: AdminGeneralSettings }>("/api/admin/settings", {
        token,
      }).then(unwrap<AdminGeneralSettings>);
    },

    update(
      token: string,
      input: AdminGeneralSettings,
    ): Promise<AdminMutation<AdminGeneralSettings>> {
      return request<AdminMutation<AdminGeneralSettings>>("/api/admin/settings", {
        method: "PUT",
        body: input,
        token,
      });
    },
  },

  holidays: {
    list(token: string): Promise<AdminHoliday[]> {
      return request<{ data: AdminHoliday[] }>("/api/admin/holidays", tokenOnly(token)).then(
        unwrap<AdminHoliday[]>,
      );
    },

    save(
      token: string,
      input: AdminHolidayInput,
      id?: number,
    ): Promise<AdminMutation<AdminHoliday>> {
      return request<AdminMutation<AdminHoliday>>(
        id === undefined ? "/api/admin/holidays" : `/api/admin/holidays/${id}`,
        { method: id === undefined ? "POST" : "PUT", body: input, token },
      );
    },

    remove(token: string, id: number): Promise<string> {
      return request<{ message: string }>(`/api/admin/holidays/${id}`, {
        method: "DELETE",
        token,
      }).then((body) => body.message);
    },
  },

  units: {
    list(token: string): Promise<AdminUnit[]> {
      return request<{ data: AdminUnit[] }>("/api/admin/units", tokenOnly(token)).then(
        unwrap<AdminUnit[]>,
      );
    },

    create(token: string, name: string): Promise<AdminMutation<AdminUnit>> {
      return request<AdminMutation<AdminUnit>>("/api/admin/units", {
        method: "POST",
        body: { name },
        token,
      });
    },

    update(token: string, id: number, name: string): Promise<AdminMutation<AdminUnit>> {
      return request<AdminMutation<AdminUnit>>(`/api/admin/units/${id}`, {
        method: "PUT",
        body: { name },
        token,
      });
    },

    setActive(token: string, id: number, active: boolean): Promise<AdminMutation<AdminUnit>> {
      return request<AdminMutation<AdminUnit>>(
        `/api/admin/units/${id}/${active ? "activate" : "deactivate"}`,
        { method: "POST", token },
      );
    },
  },

  airports: {
    list(token: string): Promise<AdminAirport[]> {
      return request<{ data: AdminAirport[] }>("/api/admin/airports", tokenOnly(token)).then(
        unwrap<AdminAirport[]>,
      );
    },

    show(token: string, id: number): Promise<AdminAirportDetail> {
      return request<{ data: AdminAirportDetail }>(
        `/api/admin/airports/${id}`,
        tokenOnly(token),
      ).then(unwrap<AdminAirportDetail>);
    },

    create(
      token: string,
      input: AdminAirportCreateInput,
    ): Promise<AdminMutation<AdminAirportDetail>> {
      return request<AdminMutation<AdminAirportDetail>>("/api/admin/airports", {
        method: "POST",
        body: input,
        token,
      });
    },

    update(
      token: string,
      id: number,
      input: AdminAirportUpdateInput,
    ): Promise<AdminMutation<AdminAirportDetail>> {
      return request<AdminMutation<AdminAirportDetail>>(`/api/admin/airports/${id}`, {
        method: "PUT",
        body: input,
        token,
      });
    },

    setActive(
      token: string,
      id: number,
      active: boolean,
    ): Promise<AdminMutation<AdminAirportDetail>> {
      return request<AdminMutation<AdminAirportDetail>>(
        `/api/admin/airports/${id}/${active ? "activate" : "deactivate"}`,
        { method: "POST", token },
      );
    },

    weeklyHistory(token: string, airport: number): Promise<WeeklySet[]> {
      return request<{ data: WeeklySet[] }>(
        `/api/admin/airports/${airport}/weekly-schedules`,
        tokenOnly(token),
      ).then(unwrap<WeeklySet[]>);
    },

    saveWeekly(
      token: string,
      airport: number,
      input: { effective_from: string; days: WeeklyDay[] },
    ): Promise<AdminMutation<WeeklySet>> {
      return request<AdminMutation<WeeklySet>>(`/api/admin/airports/${airport}/weekly-schedule`, {
        method: "PUT",
        body: input,
        token,
      });
    },

    specials(token: string, airport: number): Promise<AdminSpecialSchedule[]> {
      return request<{ data: AdminSpecialSchedule[] }>(
        `/api/admin/airports/${airport}/special-schedules`,
        tokenOnly(token),
      ).then(unwrap<AdminSpecialSchedule[]>);
    },

    createSpecial(
      token: string,
      airport: number,
      input: AdminSpecialScheduleInput,
    ): Promise<AdminMutation<AdminSpecialSchedule>> {
      return request<AdminMutation<AdminSpecialSchedule>>(
        `/api/admin/airports/${airport}/special-schedules`,
        { method: "POST", body: input, token },
      );
    },

    updateSpecial(
      token: string,
      id: number,
      input: AdminSpecialScheduleInput,
    ): Promise<AdminMutation<AdminSpecialSchedule>> {
      return request<AdminMutation<AdminSpecialSchedule>>(`/api/admin/special-schedules/${id}`, {
        method: "PUT",
        body: input,
        token,
      });
    },

    deleteSpecial(token: string, id: number): Promise<string> {
      return request<{ message: string }>(`/api/admin/special-schedules/${id}`, {
        method: "DELETE",
        token,
      }).then((body) => body.message);
    },
  },

  offices: {
    list(
      token: string,
      airportId?: number | null,
    ): Promise<{ offices: AdminOffice[]; activeCount: number }> {
      return request<{ data?: AdminOffice[]; meta?: { active_count?: number } }>(
        `/api/admin/offices${query({ airport_id: airportId })}`,
        tokenOnly(token),
      ).then((body) => ({
        offices: body.data ?? [],
        activeCount: body.meta?.active_count ?? 0,
      }));
    },

    create(token: string, input: AdminOfficeInput): Promise<AdminMutation<AdminOffice>> {
      return request<AdminMutation<AdminOffice>>("/api/admin/offices", {
        method: "POST",
        body: input,
        token,
      });
    },

    update(
      token: string,
      id: number,
      input: AdminOfficeUpdateInput,
    ): Promise<AdminMutation<AdminOffice>> {
      return request<AdminMutation<AdminOffice>>(`/api/admin/offices/${id}`, {
        method: "PUT",
        body: input,
        token,
      });
    },

    setActive(token: string, id: number, active: boolean): Promise<AdminMutation<AdminOffice>> {
      return request<AdminMutation<AdminOffice>>(
        `/api/admin/offices/${id}/${active ? "activate" : "deactivate"}`,
        { method: "POST", token },
      );
    },
  },

  reports: {
    options(token: string): Promise<AdminReportOptions> {
      return request<{ data: AdminReportOptions }>("/api/admin/reports/options", {
        token,
      }).then(unwrap<AdminReportOptions>);
    },

    preview(token: string, filters: AdminReportFilters): Promise<number> {
      return request<{ data: { interns: number } }>("/api/admin/reports/preview", {
        method: "POST",
        body: filters,
        token,
      }).then((body) => body.data.interns);
    },

    export(token: string, filters: AdminReportFilters): Promise<string> {
      return downloadFile("/api/admin/reports/export", {
        body: filters,
        token,
        fallbackName: "laporan-injourney.xlsx",
      });
    },

    attendancePdf(token: string, input: AdminAttendancePdfInput): Promise<string> {
      return downloadFile("/api/admin/reports/attendance-pdf", {
        body: input,
        token,
        fallbackName: "daftar-kehadiran.pdf",
      });
    },

    assessmentPdf(token: string, input: AdminAssessmentPdfInput): Promise<string> {
      return downloadFile("/api/admin/reports/assessment-pdf", {
        body: input,
        token,
        fallbackName: "penilaian.pdf",
      });
    },
  },

  auditLogs: {
    list(token: string, filters: AdminAuditLogFilters = {}): Promise<AdminAuditLogList> {
      return request<{ data: AdminAuditLog[]; meta: PaginationMeta }>(
        `/api/admin/audit-logs${query({ ...filters })}`,
        tokenOnly(token),
      ).then((body) => ({
        rows: body.data ?? [],
        meta: body.meta ?? {
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: body.data?.length ?? 0,
        },
      }));
    },

    options(token: string): Promise<AdminAuditLogOptions> {
      return request<{ data: AdminAuditLogOptions }>("/api/admin/audit-logs/options", {
        token,
      }).then(unwrap<AdminAuditLogOptions>);
    },
  },
};

/** Nama lama dipertahankan agar pemanggil lama tetap bisa dipindah bertahap. */
export const officeApi = {
  list: (token: string) => adminApi.offices.list(token),
  airports: (token: string) => adminApi.airports.list(token),
  store: (token: string, input: AdminOfficeInput) => adminApi.offices.create(token, input),
  update: (token: string, id: number, input: AdminOfficeInput) =>
    adminApi.offices.update(token, id, {
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      clock_in_radius_meters: input.clock_in_radius_meters,
      clock_out_radius_meters: input.clock_out_radius_meters,
    }),
  deactivate: (token: string, id: number) => adminApi.offices.setActive(token, id, false),
  activate: (token: string, id: number) => adminApi.offices.setActive(token, id, true),
};

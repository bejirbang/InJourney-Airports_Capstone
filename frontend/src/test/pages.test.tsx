import { forwardRef, type ReactNode } from "react";
import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/mock-rules";
import { UNAUTHORIZED_EVENT } from "@/lib/api";
import type {
  MentorAssessmentDetail,
  MentorAssessmentRow,
  MentorAttendanceMonth,
  MentorCorrection,
  MentorCorrectionList,
  MentorDashboard,
  MentorInternDetail,
  MentorInternLeave,
  MentorInternList,
  MentorInternLogbooks,
  MentorLeaveCalendar,
  MentorLogbookDetail,
  MentorLogbookList,
  MentorLogbookRow,
  MentorPerformance,
  MentorPerson,
  ReviewerLeave,
  ReviewerLeaveList,
} from "@/lib/endpoints/mentor";
import type { ApiAttendanceDayDetail } from "@/lib/endpoints/intern";
import type {
  ApiAnnouncement,
  ApiChatConversation,
  ApiChatMessage,
  ApiChatPerson,
  ApiNotificationItem,
} from "@/lib/endpoints/shared";

// Suite ini menjalankan 150+ render penuh; beri waktu tunggu DOM lebih longgar
// agar pengujian tidak gagal karena beban paralel Vitest, bukan karena UI.
configure({ asyncUtilTimeout: 3000 });

// Router tiruan: halaman cukup butuh Link, useSearch, useNavigate, dan useLocation.
// `navigations` merekam tujuan navigate() untuk menguji alur setelah login.
const router = vi.hoisted(() => ({
  search: {} as Record<string, string>,
  pathname: "/",
  navigations: [] as { to: string }[],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: forwardRef<
    HTMLAnchorElement,
    { to: string; children?: ReactNode; className?: string; search?: unknown }
  >(function Link({ to, children, search: _search, ...rest }, ref) {
    return (
      <a ref={ref} href={to} {...rest}>
        {children}
      </a>
    );
  }),
  useSearch: () => router.search,
  useNavigate: () => (opts: { to: string }) => {
    router.navigations.push(opts);
    return Promise.resolve();
  },
  useLocation: () => ({ pathname: router.pathname }),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: router.pathname } }),
}));

// Leaflet butuh SVG renderer yang tidak ada di jsdom, jadi peta absensi di-stub.
// Spy dipakai untuk memeriksa isi peta: lingkaran radius kantor dan marker posisi user.
// Klik peta (pemilihan titik kantor) ditangkap di `mapClick` agar alur admin bisa diuji.
const leafletSpy = vi.hoisted(() => ({
  circle: vi.fn(),
  circleMarker: vi.fn(),
  fitBounds: vi.fn(),
  marker: vi.fn(),
  mapClick: null as null | ((lat: number, lng: number) => void),
}));

vi.mock("leaflet", () => {
  const layer = {
    addTo: () => layer,
    remove: () => undefined,
    on: () => layer,
    getBounds: () => ({ extend: () => ({}) }),
  };
  leafletSpy.circle.mockImplementation(() => layer);
  leafletSpy.circleMarker.mockImplementation(() => layer);
  leafletSpy.marker.mockImplementation(() => ({
    ...layer,
    getLatLng: () => ({ lat: -6.1256, lng: 106.6559 }),
  }));
  const instance = {
    setView: () => instance,
    remove: () => undefined,
    fitBounds: leafletSpy.fitBounds,
    invalidateSize: () => undefined,
    on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => {
      if (event === "click")
        leafletSpy.mapClick = (lat: number, lng: number) => handler({ latlng: { lat, lng } });
      return instance;
    },
  };
  const L = {
    map: () => instance,
    tileLayer: () => layer,
    circle: leafletSpy.circle,
    circleMarker: leafletSpy.circleMarker,
    marker: leafletSpy.marker,
    divIcon: () => ({ className: "office-pin" }),
    latLng: (lat: number, lng: number) => ({ lat, lng }),
    latLngBounds: () => ({ extend: () => ({}) }),
  };
  return { default: L, ...L };
});

// Realtime tiruan: event WebSocket disuntikkan lewat `emit`, bukan koneksi Echo asli.
const realtime = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const presence = new Set<(users: { id: number; name: string }[]) => void>();
  let online: { id: number; name: string }[] = [];
  let typingHandler: ((userId: number) => void) | null = null;

  return {
    connectEcho: vi.fn(async () => undefined),
    disconnectEcho: vi.fn(),
    isRealtimeEnabled: () => true,
    onUserEvent: (event: string, handler: (payload: unknown) => void) => {
      const set = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      set.add(handler);
      listeners.set(event, set);
      return () => {
        set.delete(handler);
        if (set.size === 0) listeners.delete(event);
      };
    },
    onPresence: (handler: (users: { id: number; name: string }[]) => void) => {
      presence.add(handler);
      handler(online);
      return () => presence.delete(handler);
    },
    getOnlineUsers: () => online,
    subscribeChatWhisper: vi.fn(
      (_meId: number, _partnerId: number, handler: (userId: number) => void) => {
        typingHandler = handler;
        return () => {
          typingHandler = null;
        };
      },
    ),
    sendChatWhisper: vi.fn(),
    emit: (event: string, payload: unknown) => {
      for (const handler of listeners.get(event) ?? []) handler(payload);
    },
    setOnline: (users: { id: number; name: string }[]) => {
      online = users;
      for (const handler of presence) handler(online);
    },
    emitTyping: (userId: number) => typingHandler?.(userId),
    reset: () => {
      listeners.clear();
      presence.clear();
      online = [];
      typingHandler = null;
    },
  };
});
vi.mock("@/lib/realtime", () => realtime);

const { MockProvider } = await import("@/components/internspace/shared/model");
const { AuthProvider, useAuth } = await import("@/lib/auth");
const { Workspace } = await import("@/components/internspace/shared/shell");
const {
  Dashboard,
  AttendancePage,
  LeavePage,
  LogbookPage,
  PresentationPage,
  NotesPage,
  AssessmentPage,
  CorrectionsPage,
} = await import("@/components/internspace/shared/role-pages");
const { ChatPage } = await import("@/components/internspace/shared/chat");
const { ProfilePage } = await import("@/components/internspace/shared/profile");
const { LoginPage, ChangePasswordPage } = await import("@/components/internspace/shared/account");
const { MyInternsPage } = await import("@/components/internspace/mentor/interns");
const { PerformancePage } = await import("@/components/internspace/mentor/performance");
const { LeaveCalendarPage } = await import("@/components/internspace/mentor/leave-calendar");
const { OfficesPage } = await import("@/components/internspace/admin/offices");
const admin = {
  ...(await import("@/components/internspace/admin/users")),
  ...(await import("@/components/internspace/admin/corrections")),
  ...(await import("@/components/internspace/admin/warnings")),
  ...(await import("@/components/internspace/admin/announcements")),
  ...(await import("@/components/internspace/admin/reports")),
  ...(await import("@/components/internspace/admin/settings")),
  ...(await import("@/components/internspace/admin/logs")),
};

// Halaman absensi intern kini memakai API, jadi alur Hari Ini ditopang fetch dan GPS palsu.
type TodayMock = {
  state: string;
  schedule: { start: string; end: string } | null;
  status: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  clock_out_from: string | null;
  can_clock_out: boolean;
  logbook: { status: string; work: string; notes: string | null } | null;
  holiday_name: string | null;
  leave_type: string | null;
  has_active_office: boolean;
};
type OfficeMock = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
};
/** Logbook satu hari (`InternLogbooks::day`). `action` null = terkunci (menunggu review/disetujui). */
type ReportMock = {
  id: number;
  work: string;
  notes: string | null;
  status: "draft" | "pending_review" | "revision" | "approved";
  updated_at: string;
};
type LogbookReviewMock = {
  action: "revision" | "approved";
  comment: string | null;
  mentor: string | null;
  created_at: string | null;
};
type LogbookDayMock = {
  date: string;
  attendance: null | {
    status: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    missed_clock_out: boolean;
    is_corrected: boolean;
  };
  logbook_state: string | null;
  logbook: ReportMock | null;
  reviews: LogbookReviewMock[];
  action: "save" | "submit" | "resubmit" | null;
};
/** Baris daftar logbook (`InternLogbooks::month`). */
type LogbookListDayMock = {
  date: string;
  attendance_status: string;
  leave_type: "sick" | "urgent" | null;
  logbook_state: string | null;
  work: string | null;
  action: "save" | "submit" | "resubmit" | null;
};
/** Rekap bulanan & kuota izin dari dashboard. */
type RecapMock = {
  month: string;
  present: number;
  late: number;
  missed_clock_in: number;
  leave: number;
  absent: number;
  missed_clock_out: number;
  corrected: number;
  working_days: number;
};
type QuotaMock = { used: number; limit: number; remaining: number; exhausted: boolean };
/** Satu baris riwayat presensi (`AttendanceHistory`). */
type AttendanceDayMock = {
  date: string;
  status: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  missed_clock_out: boolean;
  is_corrected: boolean;
  logbook_state: string | null;
  holiday_name: string | null;
  leave_type: "sick" | "urgent" | null;
  has_active_correction: boolean;
  can_request_correction: boolean;
};
/** Koreksi presensi (`AttendanceCorrectionResource`). */
type CorrectionMock = {
  id: number;
  date: string;
  recorded_status: string;
  recorded_missed_clock_out: boolean;
  reason: string;
  status: string;
  submitted_at: string | null;
  mentor: { id: number; name: string } | null;
  mentor_note: string | null;
  mentor_decided_at: string | null;
  admin: { id: number; name: string } | null;
  admin_note: string | null;
  admin_decided_at: string | null;
  can_cancel: boolean;
};
/** Presentasi akhir (`FinalPresentations::forIntern`). */
type PresentationMock = {
  state: "not_open" | "not_submitted" | "pending" | "revision" | "approved";
  end_date: string;
  days_left: number;
  opens_on: string;
  message: string | null;
  evidence_url: string | null;
  submitted_at: string | null;
  decision_note: string | null;
  decided_at: string | null;
  can_submit: boolean;
};
type WarningMock = {
  id: number;
  body: string;
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
};
type AssessmentMock =
  | { available: false; message: string }
  | {
      available: true;
      final_score: number;
      predicate: string;
      notes: string | null;
      submitted_at: string | null;
      assessed_by: string | null;
      indicators: {
        id: number;
        category: string | null;
        name: string;
        description: string | null;
        weight: number | null;
        score: number;
      }[];
    };

/** Bentuk respon `GET /api/intern/logbooks/{date}` menurut state stub. */
const logbookDay = (): LogbookDayMock => ({
  date: "2026-10-12",
  attendance:
    apiState.today.state === "not_clocked_in" || apiState.today.state === "holiday"
      ? null
      : {
          status:
            apiState.today.state === "clocked_out" || apiState.today.state === "clocked_in"
              ? "present"
              : "missed_clock_in",
          clock_in_at: apiState.today.clock_in_at,
          clock_out_at: apiState.today.clock_out_at,
          missed_clock_out: false,
          is_corrected: false,
        },
  logbook_state: apiState.report
    ? apiState.report.status
    : apiState.today.state === "not_clocked_in"
      ? null
      : "missing",
  logbook: apiState.report ? { ...apiState.report } : null,
  reviews: apiState.logbookReviews.map(clone),
  // Draft hari ini masih bisa disimpan lagi; setelah clock out terkunci di mentor.
  action:
    apiState.report === null
      ? apiState.today.state === "not_clocked_in"
        ? null
        : "save"
      : apiState.report.status === "draft" || apiState.report.status === "revision"
        ? apiState.report.status === "draft"
          ? "save"
          : "resubmit"
        : null,
});
/** Jadwal mingguan & libur admin (stub untuk halaman Pengaturan). */
type WeeklySetMock = {
  effective_from: string;
  days: {
    day_of_week: number;
    is_workday: boolean;
    start_time: string | null;
    end_time: string | null;
  }[];
  summary: string;
};
type HolidayMock = { id: number; date: string; name: string; is_past: boolean };

const KANTOR_T3: OfficeMock = {
  id: 1,
  name: "Kantor Pusat Terminal 3",
  latitude: -6.1256,
  longitude: 106.6559,
  clock_in_radius_meters: 100,
  clock_out_radius_meters: 300,
};

/** Kantor kedua, dipakai untuk menguji dropdown kantor. */
const KANTOR_T2: OfficeMock = {
  id: 2,
  name: "Kantor Terminal 2",
  latitude: -6.1314,
  longitude: 106.6559,
  clock_in_radius_meters: 80,
  clock_out_radius_meters: 150,
};

// ---- Lokasi kantor admin (API AdminOfficeResource) ----
type AdminOfficeMock = OfficeMock & {
  airport_id: number;
  is_active: boolean;
  airport: { id: number; name: string } | null;
};
type AirportMock = {
  id: number;
  name: string;
  city: string;
  is_active: boolean;
  active_offices: number;
  active_interns: number;
  weekly_schedule: WeeklySetMock | null;
};

const BANDARA_CGK: AirportMock = {
  id: 1,
  name: "Bandara Soekarno-Hatta",
  city: "Jakarta",
  is_active: true,
  active_offices: 1,
  active_interns: 3,
  weekly_schedule: null,
};

type AdminUserMock = {
  id: number;
  name: string;
  email: string;
  role: "intern" | "mentor" | "admin";
  unit: { id: number; name: string } | null;
  status: "active" | "not_started" | "inactive";
  mentor: { id: number; name: string } | null;
  airport: { id: number; name: string } | null;
  institution_type: "universitas" | "sekolah" | null;
  university: string | null;
  major: string | null;
  student_number: string | null;
  start_date: string | null;
  end_date: string | null;
};

/** Satu kantor aktif + satu nonaktif: dasar uji peringatan kantor aktif terakhir. */
const ADMIN_KANTOR_T3: AdminOfficeMock = {
  ...KANTOR_T3,
  airport_id: BANDARA_CGK.id,
  is_active: true,
  airport: { id: BANDARA_CGK.id, name: BANDARA_CGK.name },
};

const ADMIN_KANTOR_T1: AdminOfficeMock = {
  id: 3,
  name: "Kantor Cabang Terminal 1",
  latitude: -6.1275,
  longitude: 106.6537,
  clock_in_radius_meters: 150,
  clock_out_radius_meters: 150,
  airport_id: BANDARA_CGK.id,
  is_active: false,
  airport: { id: BANDARA_CGK.id, name: BANDARA_CGK.name },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ---- Izin intern (Alur 11): riwayat, pengajuan, hari kerja, pembatalan ----
type LeaveMock = {
  id: number;
  type: "sick" | "urgent";
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  evidence_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submitted_at: string;
  submitted_late: boolean;
  decided_by: { name: string; role: "intern" | "mentor" | "admin" } | null;
  decision_note: string | null;
  decided_at: string | null;
  can_cancel: boolean;
};

const LEAVE_PENDING: LeaveMock = {
  id: 11,
  type: "sick",
  start_date: "2026-10-13",
  end_date: "2026-10-14",
  working_days: 2,
  reason: "Demam sejak semalam, istirahat di rumah.",
  evidence_url: "https://drive.google.com/file/d/surat-dokter/view",
  status: "pending",
  submitted_at: "2026-10-12T09:12:00+07:00",
  submitted_late: false,
  decided_by: null,
  decision_note: null,
  decided_at: null,
  can_cancel: true,
};

const LEAVE_REJECTED: LeaveMock = {
  id: 8,
  type: "urgent",
  start_date: "2026-09-28",
  end_date: "2026-09-29",
  working_days: 2,
  reason: "Keperluan keluarga mendesak.",
  evidence_url: null,
  status: "rejected",
  submitted_at: "2026-09-27T08:05:00+07:00",
  submitted_late: true,
  decided_by: { name: "Dewi Lestari", role: "mentor" },
  decision_note: "Tidak ada bukti surat resmi.",
  decided_at: "2026-09-27T14:30:00+07:00",
  can_cancel: false,
};

/** Hari kerja versi server (Sabtu, Minggu, dan libur tidak dihitung). */
const countWorkingDays = (start: string, end: string) => {
  const last = Date.parse(`${end}T00:00:00Z`);
  let n = 0;
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= last; t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
};

// ---- Data mentor (Fase 3) ----
const MENTOR_PERSON: MentorPerson = {
  id: 21,
  name: "Rizky Pratama",
  short_name: "Rizky",
};

const MENTOR_LEAVE: ReviewerLeave = {
  id: 701,
  intern: MENTOR_PERSON,
  type: "sick",
  start_date: "2026-10-13",
  end_date: "2026-10-14",
  working_days: 2,
  evidence_url: "https://drive.google.com/file/d/surat-dokter/view",
  status: "pending",
  submitted_at: "2026-10-12T09:12:00+07:00",
  submitted_late: false,
  pending_hours: 30,
  is_overdue: true,
  decided_by: null,
  decided_at: null,
  can_decide: true,
  reason: "Demam sejak semalam, istirahat di rumah.",
  decision_note: null,
  quota: { used: 1, limit: 3, remaining: 2, exhausted: false },
};

type MentorMockState = {
  dashboard: MentorDashboard;
  interns: MentorInternList;
  internDetail: MentorInternDetail;
  attendance: MentorAttendanceMonth;
  attendanceDay: ApiAttendanceDayDetail;
  internLogbooks: MentorInternLogbooks;
  internLeaves: MentorInternLeave[];
  internCorrections: MentorCorrection[];
  internWarnings: WarningMock[];
  logbookList: MentorLogbookList;
  logbookDetail: MentorLogbookDetail;
  corrections: MentorCorrectionList;
  reviewerLeaves: ReviewerLeaveList;
  adminLeaves: ReviewerLeaveList;
  calendar: MentorLeaveCalendar;
  performance: MentorPerformance;
  assessments: MentorAssessmentRow[];
  assessmentDetail: MentorAssessmentDetail;
  lastLogbookBody: { comment?: string | null; ids?: number[] } | null;
  lastCorrectionBody: { note?: string } | null;
  lastLeaveBody: { note?: string; evidence_checked?: boolean } | null;
  lastAssessmentBody: {
    scores: { indicator_id: number; score: number | null }[];
    notes: string | null;
  } | null;
};

const mentorDefault = (): MentorMockState => {
  const internRow = {
    id: MENTOR_PERSON.id,
    name: MENTOR_PERSON.name,
    unit: "Divisi IT",
    airport: "Bandara Soekarno-Hatta",
    institution_type: "universitas" as const,
    university: "Telkom University",
    major: "Sistem Informasi",
    student_number: "1301210001",
    start_date: "2026-10-01",
    end_date: "2026-12-31",
    is_active: true,
    relation: "current" as const,
    ends_in_days: 80,
    today_state: "present",
  };
  const detail: MentorInternDetail = {
    ...internRow,
    email: "rizky@injourney.test",
    phone: "081234567890",
    current_mentor: { id: 2, name: "Sari Wulandari" },
    leave_quota: { used: 1, limit: 3, remaining: 2, exhausted: false },
    selectable_months: { first: "2026-10", last: "2026-10" },
  };
  const logbookRow: MentorLogbookRow = {
    id: 501,
    intern: MENTOR_PERSON,
    date: "2026-10-09",
    work: "Rekap data penerbangan",
    status: "pending_review",
    submitted_at: "2026-10-09T17:00:00+07:00",
    is_corrected: false,
    revision_count: 0,
  };
  const correction: MentorCorrection = {
    id: 601,
    intern: MENTOR_PERSON,
    date: "2026-10-08",
    recorded_status: "late",
    recorded_missed_clock_out: false,
    reason: "Jam masuk tercatat terlambat karena macet.",
    status: "pending_mentor",
    submitted_at: "2026-10-09T08:00:00+07:00",
    mentor: null,
    mentor_note: null,
    mentor_decided_at: null,
    admin: null,
    admin_note: null,
    admin_decided_at: null,
    can_cancel: false,
    can_decide: true,
    recorded: { clock_in_at: "08:20", clock_out_at: "17:00" },
  };
  const assessment: MentorAssessmentDetail = {
    intern: MENTOR_PERSON,
    end_date: "2026-12-31",
    presentation_status: "approved",
    unapproved_logbooks: 0,
    status: "ready",
    blockers: [],
    can_assess: true,
    final_score: null,
    submitted_at: null,
    assessed_by: null,
    start_date: "2026-10-01",
    presentation: {
      id: 1,
      status: "approved",
      evidence_url: "https://drive.google.com/file/d/presentasi/view",
      submitted_at: "2026-10-10T10:00:00+07:00",
      decision_note: "Presentasi disetujui.",
      decided_by: "Admin Sinta",
      decided_at: "2026-10-11T10:00:00+07:00",
    },
    unapproved_logbook_days: [],
    indicators: [
      {
        id: 1,
        category: "Motivasi",
        name: "Disiplin Kerja",
        description: "Kehadiran dan ketepatan waktu.",
        weight: 1,
        score: null,
      },
      {
        id: 2,
        category: "Kemampuan Kerja",
        name: "Kualitas Pekerjaan",
        description: null,
        weight: 1,
        score: null,
      },
    ],
    predicate: null,
    notes: null,
    can_edit: true,
  };
  const adminLeave: ReviewerLeave = {
    id: 6,
    intern: MENTOR_PERSON,
    type: "urgent",
    start_date: "2026-09-29",
    end_date: "2026-09-30",
    working_days: 2,
    evidence_url: null,
    status: "pending",
    submitted_at: "2026-09-28T09:12:00+07:00",
    submitted_late: false,
    pending_hours: 30,
    is_overdue: true,
    decided_by: null,
    decided_at: null,
    can_decide: true,
    can_approve: false,
    mentor: { id: 2, name: "Sari Wulandari" },
    reason: "Keperluan keluarga mendesak.",
    decision_note: null,
    quota: { used: 1, limit: 3, remaining: 2, exhausted: false },
  };
  const leaves: ReviewerLeave[] = [clone(MENTOR_LEAVE)];

  return {
    dashboard: {
      date: "2026-10-12",
      interns_total: 1,
      holiday: null,
      today: {
        interns: 1,
        clocked_in: 1,
        late: 0,
        on_leave: 0,
        not_clocked_in: 0,
        rows: [
          {
            intern: MENTOR_PERSON,
            status: "present",
            clock_in_at: "08:05",
            late_minutes: 0,
            missed_clock_out: false,
            leave_type: null,
          },
        ],
      },
      pending_logbooks: { total: 1, items: [clone(logbookRow)] },
      pending_corrections: {
        total: 1,
        items: [
          {
            id: correction.id,
            intern: MENTOR_PERSON,
            date: correction.date,
            recorded_status: correction.recorded_status,
            recorded_missed_clock_out: correction.recorded_missed_clock_out,
            reason: correction.reason,
          },
        ],
      },
      pending_leaves: {
        total: 1,
        items: [
          {
            id: MENTOR_LEAVE.id,
            intern: MENTOR_PERSON,
            type: MENTOR_LEAVE.type,
            start_date: MENTOR_LEAVE.start_date,
            end_date: MENTOR_LEAVE.end_date,
            created_at: MENTOR_LEAVE.submitted_at,
            pending_hours: MENTOR_LEAVE.pending_hours,
            is_overdue: MENTOR_LEAVE.is_overdue,
          },
        ],
      },
      ready_to_assess: {
        total: 1,
        items: [{ intern: MENTOR_PERSON, end_date: "2026-12-31", status: "ready" }],
      },
      announcements: [],
    },
    interns: {
      interns: [internRow],
      current_total: 1,
      former_total: 0,
    },
    internDetail: detail,
    attendance: {
      month: "2026-10",
      selectable_months: { first: "2026-10", last: "2026-10" },
      recap: {
        month: "2026-10",
        present: 1,
        late: 0,
        missed_clock_in: 0,
        leave: 0,
        absent: 0,
        missed_clock_out: 0,
        corrected: 0,
        working_days: 1,
      },
      days: [
        {
          date: "2026-10-09",
          status: "present",
          clock_in_at: "08:05",
          clock_out_at: "17:00",
          late_minutes: 0,
          missed_clock_out: false,
          is_corrected: false,
          logbook_state: "pending_review",
          holiday_name: null,
          leave_type: null,
        },
      ],
    },
    attendanceDay: {
      date: "2026-10-09",
      status: "present",
      clock_in_at: "08:05",
      clock_out_at: "17:00",
      late_minutes: 0,
      missed_clock_out: false,
      is_corrected: false,
      logbook_state: "pending_review",
      holiday_name: null,
      leave_type: null,
      scheduled: { start: "08:00", end: "17:00" },
      clock_in_office: { id: 1, name: "Kantor Pusat Terminal 3" },
      clock_out_office: { id: 1, name: "Kantor Pusat Terminal 3" },
      logbook: {
        work: "Rekap data penerbangan",
        notes: null,
        status: "pending_review",
        submitted_at: "2026-10-09T17:00:00+07:00",
      },
    },
    internLogbooks: {
      month: "2026-10",
      selectable_months: { first: "2026-10", last: "2026-10" },
      days: [
        {
          date: "2026-10-09",
          status: "present",
          leave_type: null,
          logbook_state: "pending_review",
          logbook: {
            work: "Rekap data penerbangan",
            notes: null,
            status: "pending_review",
            submitted_at: "2026-10-09T17:00:00+07:00",
          },
        },
      ],
    },
    internLeaves: [
      {
        id: MENTOR_LEAVE.id,
        type: "sick",
        start_date: MENTOR_LEAVE.start_date,
        end_date: MENTOR_LEAVE.end_date,
        working_days: 2,
        status: "pending",
        evidence_url: MENTOR_LEAVE.evidence_url,
        submitted_at: MENTOR_LEAVE.submitted_at,
        decided_by: null,
        can_open: true,
      },
    ],
    internCorrections: [clone(correction)],
    internWarnings: [
      {
        id: 1,
        body: "Terlambat tiga kali dalam sebulan.",
        author: "Admin Sinta",
        created_at: "2026-10-10T09:00:00+07:00",
        updated_at: "2026-10-10T09:00:00+07:00",
      },
    ],
    logbookList: {
      logbooks: [clone(logbookRow)],
      counts: { pending_review: 1, revision: 0 },
    },
    logbookDetail: {
      ...clone(logbookRow),
      notes: null,
      approved_at: null,
      attendance: {
        status: "present",
        clock_in_at: "08:05",
        clock_out_at: "17:00",
      },
      reviews: [],
      intern_inactive: false,
      warning: null,
      can_approve: true,
      can_request_revision: true,
      previous_id: null,
      next_id: null,
    },
    corrections: {
      corrections: [clone(correction)],
      pendingCount: 1,
    },
    reviewerLeaves: { leaves, pendingCount: 1, interns: [MENTOR_PERSON] },
    adminLeaves: { leaves: [clone(adminLeave)], pendingCount: 1, interns: [MENTOR_PERSON] },
    calendar: {
      month: "2026-10",
      days: [
        {
          date: "2026-10-12",
          weekday: 1,
          is_today: true,
          is_off: false,
          holiday_name: null,
          entries: [
            {
              leave_id: MENTOR_LEAVE.id,
              intern_id: MENTOR_PERSON.id,
              short_name: MENTOR_PERSON.short_name,
              type: "sick",
              status: "pending",
            },
          ],
        },
      ],
      leaves: [
        {
          id: MENTOR_LEAVE.id,
          intern: MENTOR_PERSON,
          type: "sick",
          start_date: MENTOR_LEAVE.start_date,
          end_date: MENTOR_LEAVE.end_date,
          status: "pending",
        },
      ],
    },
    performance: {
      month: "2026-10",
      selectable_months: { first: "2026-08", last: "2026-10" },
      interns_total: 1,
      summary: {
        attendance_rate: 1,
        on_time_rate: 1,
        logbook_approved_rate: 0.8,
      },
      interns: [
        {
          intern: MENTOR_PERSON,
          is_active: true,
          recap: {
            present: 1,
            late: 0,
            missed_clock_in: 0,
            missed_clock_out: 0,
            leave: 1,
            absent: 0,
            working_days: 2,
          },
          kpi: {
            enough_data: true,
            attendance_rate: 1,
            on_time_rate: 1,
            logbook_approved_rate: 0.8,
            logbook_revisions: 1,
          },
          dates: {
            present: ["2026-10-09"],
            late: [],
            missed_clock_in: [],
            missed_clock_out: [],
            leave: ["2026-10-13"],
            absent: [],
            logbook_not_approved: ["2026-10-09"],
            logbook_revisions: ["2026-10-08"],
          },
        },
      ],
    },
    assessments: [
      {
        intern: MENTOR_PERSON,
        end_date: "2026-12-31",
        presentation_status: "approved",
        unapproved_logbooks: 0,
        status: "ready",
        blockers: [],
        can_assess: true,
        final_score: null,
        submitted_at: null,
        assessed_by: null,
      },
    ],
    assessmentDetail: clone(assessment),
    lastLogbookBody: null,
    lastCorrectionBody: null,
    lastLeaveBody: null,
    lastAssessmentBody: null,
  };
};

const CHAT_PARTNER: ApiChatPerson = {
  id: 2,
  name: "Sari Wijaya",
  role: "mentor",
  unit: "Operasional",
  can_send: true,
};

const CHAT_MESSAGE: ApiChatMessage = {
  id: 1,
  sender_id: 2,
  receiver_id: 1,
  body: "Halo, apa kabar?",
  read_at: null,
  created_at: "2026-10-12T09:00:00+07:00",
};

const NOTIFICATION_UNREAD: ApiNotificationItem = {
  id: 1,
  text: "Logbook 8 Okt perlu direvisi.",
  link_path: "/logbook",
  link_params: { date: "2026-10-08" },
  read_at: null,
  created_at: "2026-10-12T08:00:00+07:00",
};

const apiState = {
  today: {} as TodayMock,
  offices: [] as OfficeMock[],
  report: null as ReportMock | null,
  /** Rekap bulanan & kuota izin dari GET /api/intern/dashboard. */
  recap: {} as RecapMock,
  quota: {} as QuotaMock,
  announcements: [] as {
    id: number;
    title: string;
    body: string;
    author_name: string | null;
    created_at: string | null;
  }[],
  actionNeeded: {
    logbooks: [],
    warnings: [],
    corrections: [],
    leaves: [],
  } as {
    logbooks: { date: string; logbook_state: string; comment: string | null }[];
    warnings: { id: number; created_at: string | null }[];
    corrections: { id: number; date: string; status: string }[];
    leaves: {
      id: number;
      type: "sick" | "urgent";
      start_date: string;
      end_date: string;
      status: string;
    }[];
  },
  presentationBanner: null as {
    state: "not_submitted" | "pending" | "revision";
    end_date: string;
    days_left: number;
  } | null,
  /** Riwayat presensi (GET /api/intern/attendance). */
  attendanceDays: [] as AttendanceDayMock[],
  /** Query bulan yang diminta server untuk riwayat presensi. */
  attendanceParams: null as Record<string, string> | null,
  /** Daftar logbook (GET /api/intern/logbooks). */
  logbookDays: [] as LogbookListDayMock[],
  logbookActionNeeded: [] as { date: string; logbook_state: string; comment: string | null }[],
  /** Riwayat review pada detail logbook. */
  logbookReviews: [] as LogbookReviewMock[],
  logbookParams: null as Record<string, string> | null,
  /** Body PUT logbook terakhir, untuk membuktikan tanggal + isian yang dikirim. */
  logbookPosted: [] as { date: string; work: string; notes: string | null }[],
  corrections: [] as CorrectionMock[],
  correctionsPosted: [] as { date: string; reason: string }[],
  presentation: {} as PresentationMock,
  presentationPosted: [] as string[],
  warnings: [] as WarningMock[],
  assessment: null as AssessmentMock | null,
  clockInResult: null as null | { status: number; body: unknown },
  clockOutResult: null as null | { status: number; body: unknown },
  /** Clock in yang tidak pernah selesai, untuk menguji tombol nonaktif saat request berjalan. */
  clockInPending: false,
  leaves: [] as LeaveMock[],
  /** Query izin terakhir yang diterima server, untuk membuktikan filter status dikirim. */
  leaveParams: null as Record<string, string> | null,
  leavesPosted: [] as {
    type: string;
    start_date: string;
    evidence_url: string | null;
  }[],
  leaveCancelled: [] as number[],
  /** Mentor memproses izin tepat sebelum intern menekan "Ya, batalkan" (422). */
  leaveProcessedElsewhere: false,
  leaveListError: false,
  adminOffices: [] as AdminOfficeMock[],
  adminAirports: [] as AirportMock[],
  adminDashboard: {} as Record<string, unknown>,
  adminUsers: [] as AdminUserMock[],
  adminAnnouncements: [] as Record<string, unknown>[],
  adminWarnings: [] as Record<string, unknown>[],
  adminAuditLogs: [] as Record<string, unknown>[],
  adminUnits: [] as Record<string, unknown>[],
  adminSettings: {
    late_tolerance_minutes: 15,
    leave_quota: 3,
    end_reminder_days: 7,
    leave_escalation_hours: 24,
  },
  weeklySets: [] as WeeklySetMock[],
  holidays: [] as HolidayMock[],
  holidaySeq: 1,
  /** Body terakhir PUT /api/auth/profile, untuk membuktikan hanya `phone` yang dikirim. */
  profileBody: null as Record<string, unknown> | null,
  /** Menu contoh yang menggantikan GET /api/{role}/menu (uji sumber menu sidebar). */
  menuOverride: null as { key: string; path: string; badge: number | null }[] | null,
  /** Notifikasi dan chat Fase 5; setiap tes mengubah salinan baru lewat resetApi(). */
  notifications: [] as ApiNotificationItem[],
  notificationReads: [] as number[],
  chatConversations: [] as ApiChatConversation[],
  chatContacts: [] as ApiChatPerson[],
  chatMessages: [] as ApiChatMessage[],
  chatReads: [] as number[],
  chatSent: [] as string[],
  announcementDetail: null as ApiAnnouncement | null,
  /** Data mentor Fase 3; setiap tes mengubah salinan baru lewat resetApi(). */
  mentor: mentorDefault(),
};

const resetApi = () => {
  apiState.today = {
    state: "not_clocked_in",
    schedule: { start: "08:00", end: "17:00" },
    status: null,
    clock_in_at: null,
    clock_out_at: null,
    late_minutes: null,
    clock_out_from: "17:00",
    can_clock_out: false,
    logbook: null,
    holiday_name: null,
    leave_type: null,
    has_active_office: true,
  };
  apiState.offices = [KANTOR_T3];
  apiState.report = null;
  apiState.recap = {
    month: "2026-10",
    present: 8,
    late: 1,
    missed_clock_in: 0,
    leave: 1,
    absent: 0,
    missed_clock_out: 0,
    corrected: 0,
    working_days: 20,
  };
  apiState.quota = { used: 1, limit: 3, remaining: 2, exhausted: false };
  apiState.announcements = [
    {
      id: 1,
      title: "WFA besok",
      body: "Besok WFA, presensi tetap wajib.",
      author_name: "Admin Sinta",
      created_at: "2026-10-10T09:00:00+07:00",
    },
  ];
  apiState.actionNeeded = { logbooks: [], warnings: [], corrections: [], leaves: [] };
  apiState.presentationBanner = null;
  apiState.attendanceDays = [];
  apiState.attendanceParams = null;
  apiState.logbookDays = [];
  apiState.logbookActionNeeded = [];
  apiState.logbookReviews = [];
  apiState.logbookParams = null;
  apiState.logbookPosted = [];
  apiState.corrections = [];
  apiState.correctionsPosted = [];
  apiState.presentation = {
    state: "not_submitted",
    end_date: "2026-12-31",
    days_left: 7,
    opens_on: "2026-12-24",
    message: null,
    evidence_url: null,
    submitted_at: null,
    decision_note: null,
    decided_at: null,
    can_submit: true,
  };
  apiState.presentationPosted = [];
  apiState.warnings = [];
  apiState.assessment = { available: false, message: "Nilai akhir belum tersedia." };
  apiState.clockInResult = null;
  apiState.clockOutResult = null;
  apiState.clockInPending = false;
  apiState.leaves = [LEAVE_PENDING, LEAVE_REJECTED].map(clone);
  apiState.leaveParams = null;
  apiState.leavesPosted = [];
  apiState.leaveCancelled = [];
  apiState.leaveProcessedElsewhere = false;
  apiState.leaveListError = false;
  apiState.adminOffices = [ADMIN_KANTOR_T3, ADMIN_KANTOR_T1].map(clone);
  apiState.adminAirports = [BANDARA_CGK].map(clone);
  apiState.adminDashboard = {
    date: "2026-10-12",
    airport_id: null,
    holiday: null,
    has_active_office: true,
    today: {
      interns: 3,
      clocked_in: 2,
      late: 0,
      on_leave: 1,
      not_clocked_in: 0,
      rows: [],
    },
    yesterday: null,
    pending_corrections: { total: 0, items: [] },
    overdue_leaves: { total: 0, items: [] },
    pending_presentations: { total: 0, items: [] },
    ending_internships: {
      total: 1,
      items: [
        {
          intern: { id: 4, name: "Rizky Pratama", short_name: "Rizky" },
          end_date: "2026-10-19",
          ends_in_days: 7,
          mentor: { id: 2, name: "Budi Santoso" },
        },
      ],
    },
    quota_exhausted: { total: 0, items: [] },
    new_assessments: { total: 0, items: [] },
    campuses: [],
  };
  apiState.adminUsers = [
    {
      id: 4,
      name: "Rizky Pratama",
      email: "intern@injourney.test",
      role: "intern",
      unit: { id: 1, name: "Operasional" },
      status: "active",
      mentor: { id: 2, name: "Budi Santoso" },
      airport: { id: BANDARA_CGK.id, name: BANDARA_CGK.name },
      institution_type: "universitas",
      university: "Telkom University",
      major: "Sistem Informasi",
      student_number: "2023001",
      start_date: "2026-07-01",
      end_date: "2026-10-19",
    },
  ];
  apiState.adminAnnouncements = [];
  apiState.adminWarnings = [];
  apiState.adminAuditLogs = [];
  apiState.adminUnits = [{ id: 1, name: "Operasional", is_active: true, user_count: 3 }];
  apiState.adminSettings = {
    late_tolerance_minutes: 15,
    leave_quota: 3,
    end_reminder_days: 7,
    leave_escalation_hours: 24,
  };
  // Bandara sudah punya jadwal mingguan berlaku (contoh: Sabtu-Minggu libur).
  apiState.weeklySets = [
    {
      effective_from: "2026-10-01",
      days: [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
        day_of_week: dow,
        is_workday: dow <= 5,
        start_time: dow <= 5 ? "08:00" : null,
        end_time: dow <= 5 ? "17:00" : null,
      })),
      summary: "Sen-Jum 08:00-17:00",
    },
  ].map(clone);
  apiState.holidays = [{ id: 1, date: "2026-12-25", name: "Libur Natal", is_past: false }].map(
    clone,
  );
  apiState.holidaySeq = 2;
  apiState.profileBody = null;
  apiState.menuOverride = null;
  apiState.notifications = [clone(NOTIFICATION_UNREAD)];
  apiState.notificationReads = [];
  apiState.chatConversations = [
    { partner: clone(CHAT_PARTNER), last_message: clone(CHAT_MESSAGE), unread_count: 1 },
  ];
  apiState.chatContacts = [clone(CHAT_PARTNER)];
  apiState.chatMessages = [clone(CHAT_MESSAGE)];
  apiState.chatReads = [];
  apiState.chatSent = [];
  apiState.announcementDetail = {
    id: 1,
    title: "WFA besok",
    body: "Besok WFA, presensi tetap wajib.",
    author_name: "Admin Sinta",
    created_at: "2026-10-10T09:00:00+07:00",
    updated_at: "2026-10-10T09:00:00+07:00",
  };
  apiState.mentor = mentorDefault();
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

/** Path tanpa query, untuk mencocokkan endpoint di stub fetch. */
const path0 = (url: string) => url.split("?")[0] ?? url;

/** Role akun untuk stub `/api/auth/me`; disetel `show()` agar selari dengan MockProvider. */
let authRole: Role = "Intern";

/** Data intern contoh (bentuk `intern_profile` pada UserResource). */
const INTERN_PROFILE_MOCK = {
  mentor: { id: 2, name: "Sari Wulandari" },
  airport: { id: 1, name: "Kantor Pusat Terminal 3" },
  institution_type: "universitas",
  university: "Telkom University",
  major: "Sistem Informasi",
  student_number: "1301210001",
  start_date: "2026-10-01",
  end_date: "2027-01-31",
};

/** Bentuk `GET /api/auth/me` (UserResource) sesuai role yang sedang masuk. */
const apiUser = (role: Role, options: { mustChange?: boolean; phone?: string | null } = {}) => ({
  id: 1,
  name: "Budi Santoso",
  email: `${role.toLowerCase()}@injourney.test`,
  role: role.toLowerCase(),
  unit: { id: 1, name: "Divisi IT" },
  phone: options.phone ?? null,
  is_active: true,
  must_change_password: options.mustChange ?? false,
  home_path: "/",
  ...(role === "Intern" ? { intern_profile: clone(INTERN_PROFILE_MOCK) } : {}),
});

/** Menu contoh per role — key dan urut seperti `MenuController` backend. */
const MENU_MOCK: Record<string, { key: string; path: string; badge: number | null }[]> = {
  intern: [
    { key: "dashboard", path: "/intern/dashboard", badge: null },
    { key: "attendance", path: "/intern/attendance", badge: null },
    { key: "logbooks", path: "/intern/logbooks", badge: 2 },
    { key: "leaves", path: "/intern/leaves", badge: 1 },
    { key: "presentation", path: "/intern/presentation", badge: null },
    { key: "notes", path: "/intern/notes", badge: null },
  ],
  mentor: [
    { key: "dashboard", path: "/mentor/dashboard", badge: null },
    { key: "interns", path: "/mentor/interns", badge: null },
    { key: "logbooks", path: "/mentor/logbooks", badge: 3 },
    { key: "corrections", path: "/mentor/corrections", badge: 4 },
    { key: "leaves", path: "/mentor/leaves", badge: 1 },
    { key: "leave_calendar", path: "/mentor/leave-calendar", badge: null },
    { key: "performance", path: "/mentor/performance", badge: null },
    { key: "assessments", path: "/mentor/assessments", badge: null },
  ],
  admin: [
    { key: "dashboard", path: "/admin/dashboard", badge: null },
    { key: "users", path: "/admin/users", badge: null },
    { key: "attendance", path: "/admin/attendance", badge: null },
    { key: "corrections", path: "/admin/corrections", badge: 5 },
    { key: "leaves", path: "/admin/leaves", badge: 2 },
    { key: "presentations", path: "/admin/presentations", badge: null },
    { key: "assessments", path: "/admin/assessments", badge: null },
    { key: "warnings", path: "/admin/warnings", badge: 1 },
    { key: "announcements", path: "/admin/announcements", badge: null },
    { key: "reports", path: "/admin/reports", badge: null },
    { key: "settings", path: "/admin/settings", badge: null },
    { key: "offices", path: "/admin/offices", badge: null },
    { key: "audit_log", path: "/admin/audit-log", badge: null },
  ],
};

const installFetch = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/auth/me")) return jsonResponse({ data: apiUser(authRole) });

      // ---- Autentikasi (Fase 1): login dan simpan profil ----
      if (method === "POST" && url.endsWith("/api/auth/login")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          email?: string;
          password?: string;
        };
        const email = String(body.email ?? "");
        if (!email || body.password !== "password")
          return jsonResponse({ message: "Email atau password salah." }, 422);
        const loginRole: Role = email.startsWith("admin")
          ? "Admin"
          : email.startsWith("mentor")
            ? "Mentor"
            : "Intern";
        return jsonResponse({
          token: "token-uji",
          user: apiUser(loginRole, { mustChange: email.startsWith("intern.baru") }),
        });
      }
      if (method === "PUT" && url.endsWith("/api/auth/profile")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        apiState.profileBody = body;
        if (!("phone" in body))
          return jsonResponse({ message: "Nomor telepon wajib dikirim." }, 422);
        const raw = body["phone"];
        const phone = raw === null || raw === undefined || raw === "" ? null : String(raw);
        if (phone !== null && !/^\+?\d[\d\s-]{6,}$/.test(phone))
          return jsonResponse({ message: "Format nomor telepon tidak valid." }, 422);
        return jsonResponse({
          message: "Perubahan tersimpan.",
          data: apiUser(authRole, { phone }),
        });
      }

      // ---- Menu sidebar (Fase 1): key + badge dari GET /api/{role}/menu ----
      const menuMatch = /\/api\/(intern|mentor|admin)\/menu$/.exec(url);
      if (menuMatch) {
        const items = apiState.menuOverride ?? MENU_MOCK[menuMatch[1] ?? ""] ?? [];
        return jsonResponse({ data: items.map(clone) });
      }

      // ---- Lonceng, chat, dan detail pengumuman (Fase 5) ----
      if (method === "GET" && path0(url).endsWith("/api/notifications")) {
        const cursor = new URL(url).searchParams.get("cursor");
        const start = cursor ? Number(cursor) : 0;
        const items = apiState.notifications.slice(start, start + 20);
        const next = start + 20 < apiState.notifications.length ? String(start + 20) : null;
        return jsonResponse({
          data: clone(items),
          meta: {
            next_cursor: next,
            unread_count: apiState.notifications.filter((item) => item.read_at === null).length,
          },
        });
      }

      const notificationRead = /\/api\/notifications\/(\d+)\/read$/.exec(path0(url));
      if (method === "POST" && notificationRead) {
        const id = Number(notificationRead[1]);
        const found = apiState.notifications.find((item) => item.id === id);
        if (!found) return jsonResponse({ message: "Notifikasi tidak ditemukan." }, 404);
        found.read_at = found.read_at ?? "2026-10-12T10:00:00+07:00";
        apiState.notificationReads.push(id);
        return jsonResponse({
          data: clone(found),
          meta: {
            unread_count: apiState.notifications.filter((item) => item.read_at === null).length,
          },
        });
      }

      if (method === "POST" && path0(url).endsWith("/api/notifications/read-all")) {
        for (const item of apiState.notifications) {
          item.read_at = item.read_at ?? "2026-10-12T10:00:00+07:00";
        }
        return jsonResponse({ meta: { unread_count: 0 } });
      }

      if (method === "GET" && path0(url).endsWith("/api/chats")) {
        const q = (new URL(url).searchParams.get("q") ?? "").toLowerCase();
        const conversations = apiState.chatConversations.filter((item) =>
          item.partner.name.toLowerCase().includes(q),
        );
        return jsonResponse({
          data: clone(conversations),
          meta: {
            unread_total: conversations.reduce((total, item) => total + item.unread_count, 0),
          },
        });
      }

      if (method === "GET" && path0(url).endsWith("/api/chats/contacts")) {
        const q = (new URL(url).searchParams.get("q") ?? "").toLowerCase();
        return jsonResponse({
          data: clone(apiState.chatContacts.filter((item) => item.name.toLowerCase().includes(q))),
        });
      }

      const chatMessages = /\/api\/chats\/(\d+)\/messages$/.exec(path0(url));
      if (chatMessages) {
        const partnerId = Number(chatMessages[1]);
        const partner = apiState.chatContacts.find((item) => item.id === partnerId);
        if (!partner) return jsonResponse({ message: "Pengguna tidak ditemukan." }, 404);

        if (method === "GET") {
          const items = apiState.chatMessages.filter(
            (item) =>
              (item.sender_id === 1 && item.receiver_id === partnerId) ||
              (item.sender_id === partnerId && item.receiver_id === 1),
          );
          return jsonResponse({
            data: clone(items),
            meta: { partner: clone(partner), has_more: false },
          });
        }

        if (method === "POST") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { body?: string };
          apiState.chatSent.push(String(body.body ?? ""));
          const message: ApiChatMessage = {
            id: Math.max(0, ...apiState.chatMessages.map((item) => item.id)) + 1,
            sender_id: 1,
            receiver_id: partnerId,
            body: String(body.body ?? ""),
            read_at: null,
            created_at: "2026-10-12T10:00:00+07:00",
          };
          apiState.chatMessages.push(message);
          const conversation = apiState.chatConversations.find(
            (item) => item.partner.id === partnerId,
          );
          if (conversation) conversation.last_message = clone(message);
          return jsonResponse({ data: clone(message) }, 201);
        }
      }

      const chatRead = /\/api\/chats\/(\d+)\/read$/.exec(path0(url));
      if (method === "POST" && chatRead) {
        const partnerId = Number(chatRead[1]);
        apiState.chatReads.push(partnerId);
        for (const item of apiState.chatMessages) {
          if (item.sender_id === partnerId && item.receiver_id === 1) {
            item.read_at = item.read_at ?? "2026-10-12T10:00:00+07:00";
          }
        }
        const conversation = apiState.chatConversations.find(
          (item) => item.partner.id === partnerId,
        );
        if (conversation) conversation.unread_count = 0;
        return jsonResponse({
          meta: {
            unread_total: apiState.chatConversations.reduce(
              (total, item) => total + item.unread_count,
              0,
            ),
          },
        });
      }

      const announcementDetail = /\/api\/announcements\/(\d+)$/.exec(path0(url));
      if (method === "GET" && announcementDetail) {
        const id = Number(announcementDetail[1]);
        if (apiState.announcementDetail?.id !== id)
          return jsonResponse({ message: "Pengumuman tidak ditemukan." }, 404);
        return jsonResponse({ data: clone(apiState.announcementDetail) });
      }

      // ---- Data mentor (Fase 3) ----
      const mentor = apiState.mentor;
      if (method === "GET" && url.endsWith("/api/mentor/dashboard"))
        return jsonResponse({ data: clone(mentor.dashboard) });

      if (method === "GET" && path0(url).endsWith("/api/mentor/interns")) {
        const params = new URL(url).searchParams;
        const status = params.get("status") ?? "active";
        const q = (params.get("q") ?? "").toLowerCase();
        const rows = mentor.interns.interns.filter((row) => {
          const statusOk =
            status === "all" ||
            (status === "former"
              ? row.relation === "former"
              : status === "active"
                ? row.is_active
                : !row.is_active);
          return statusOk && row.name.toLowerCase().includes(q);
        });
        return jsonResponse({
          data: clone(rows),
          meta: {
            current_total: mentor.interns.current_total,
            former_total: mentor.interns.former_total,
          },
        });
      }

      const mentorInternDay =
        /\/api\/mentor\/interns\/(\d+)\/attendance\/days\/(\d{4}-\d{2}-\d{2})$/.exec(path0(url));
      if (method === "GET" && mentorInternDay) {
        if (mentorInternDay[2] !== mentor.attendanceDay.date)
          return jsonResponse({ message: "Presensi tidak ditemukan." }, 404);
        return jsonResponse({ data: clone(mentor.attendanceDay) });
      }

      const mentorInternTab =
        /\/api\/mentor\/interns\/(\d+)\/(attendance|logbooks|leaves|corrections|warnings)$/.exec(
          path0(url),
        );
      if (method === "GET" && mentorInternTab) {
        const tab = mentorInternTab[2];
        if (tab === "attendance") return jsonResponse({ data: clone(mentor.attendance) });
        if (tab === "logbooks") return jsonResponse({ data: clone(mentor.internLogbooks) });
        if (tab === "leaves") return jsonResponse({ data: clone(mentor.internLeaves) });
        if (tab === "corrections") return jsonResponse({ data: clone(mentor.internCorrections) });
        return jsonResponse({ data: clone(mentor.internWarnings) });
      }

      const mentorInternDetail = /\/api\/mentor\/interns\/(\d+)$/.exec(path0(url));
      if (method === "GET" && mentorInternDetail)
        return jsonResponse({ data: clone(mentor.internDetail) });

      if (method === "POST" && path0(url).endsWith("/api/mentor/logbooks/approve")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { ids?: number[] };
        mentor.lastLogbookBody = body;
        const ids = body.ids ?? [];
        const approved = mentor.logbookList.logbooks
          .filter((row) => ids.includes(row.id) && row.status === "pending_review")
          .map((row) => row.id);
        mentor.logbookList.logbooks = mentor.logbookList.logbooks.filter(
          (row) => !approved.includes(row.id),
        );
        mentor.logbookList.counts.pending_review = Math.max(
          0,
          mentor.logbookList.counts.pending_review - approved.length,
        );
        mentor.dashboard.pending_logbooks.total = mentor.logbookList.counts.pending_review;
        mentor.dashboard.pending_logbooks.items = mentor.dashboard.pending_logbooks.items.filter(
          (row) => !approved.includes(row.id),
        );
        return jsonResponse({
          message: `${approved.length} logbook disetujui.`,
          data: { approved, skipped: [] },
        });
      }

      if (method === "GET" && path0(url).endsWith("/api/mentor/logbooks")) {
        const params = new URL(url).searchParams;
        const tab = params.get("tab") ?? "pending_review";
        const internId = params.get("intern_id");
        const rows = mentor.logbookList.logbooks.filter(
          (row) =>
            (tab === "all" || row.status === tab) &&
            (!internId || row.intern.id === Number(internId)),
        );
        return jsonResponse({
          data: clone(rows),
          meta: clone(mentor.logbookList.counts),
        });
      }

      const mentorLogbookAction = /\/api\/mentor\/logbooks\/(\d+)\/(approve|revise)$/.exec(
        path0(url),
      );
      if (method === "POST" && mentorLogbookAction) {
        const id = Number(mentorLogbookAction[1]);
        const action = mentorLogbookAction[2];
        const body = JSON.parse(String(init?.body ?? "{}")) as { comment?: string | null };
        mentor.lastLogbookBody = body;
        if (id !== mentor.logbookDetail.id)
          return jsonResponse({ message: "Logbook tidak ditemukan." }, 404);
        if (mentor.logbookDetail.status !== "pending_review")
          return jsonResponse({ message: "Logbook ini sudah diproses." }, 422);
        if (action === "revise" && !String(body.comment ?? "").trim())
          return jsonResponse({ message: "Tulis komentar revisi." }, 422);
        mentor.logbookDetail.status = action === "approve" ? "approved" : "revision";
        mentor.logbookDetail.can_approve = false;
        mentor.logbookDetail.can_request_revision = false;
        mentor.logbookDetail.approved_at =
          action === "approve" ? "2026-10-12T10:00:00+07:00" : null;
        mentor.logbookList.logbooks = mentor.logbookList.logbooks.filter((row) => row.id !== id);
        mentor.logbookList.counts.pending_review = 0;
        if (action === "revise") mentor.logbookList.counts.revision = 1;
        mentor.dashboard.pending_logbooks.total = 0;
        mentor.dashboard.pending_logbooks.items = [];
        return jsonResponse({
          message: action === "approve" ? "Logbook disetujui." : "Revisi diminta.",
          data: clone(mentor.logbookDetail),
        });
      }

      const mentorLogbookDetail = /\/api\/mentor\/logbooks\/(\d+)$/.exec(path0(url));
      if (method === "GET" && mentorLogbookDetail) {
        if (Number(mentorLogbookDetail[1]) !== mentor.logbookDetail.id)
          return jsonResponse({ message: "Logbook tidak ditemukan." }, 404);
        return jsonResponse({ data: clone(mentor.logbookDetail) });
      }

      if (method === "GET" && path0(url).endsWith("/api/mentor/corrections")) {
        const params = new URL(url).searchParams;
        const tab = params.get("tab") ?? "waiting";
        const internId = params.get("intern_id");
        const rows = mentor.corrections.corrections.filter(
          (row) =>
            (tab === "all" || row.status === "pending_mentor") &&
            (!internId || row.intern.id === Number(internId)),
        );
        return jsonResponse({
          data: clone(rows),
          meta: { pending_count: mentor.corrections.pendingCount },
        });
      }

      const mentorCorrectionAction = /\/api\/mentor\/corrections\/(\d+)\/(approve|reject)$/.exec(
        path0(url),
      );
      if (method === "POST" && mentorCorrectionAction) {
        const id = Number(mentorCorrectionAction[1]);
        const action = mentorCorrectionAction[2];
        const body = JSON.parse(String(init?.body ?? "{}")) as { note?: string };
        mentor.lastCorrectionBody = body;
        const found = mentor.corrections.corrections.find((row) => row.id === id);
        if (!found) return jsonResponse({ message: "Koreksi tidak ditemukan." }, 404);
        if (action === "reject" && !String(body.note ?? "").trim())
          return jsonResponse({ message: "Catatan wajib diisi." }, 422);
        found.status = action === "approve" ? "pending_admin" : "rejected_by_mentor";
        found.mentor_note = body.note ?? null;
        found.mentor_decided_at = "2026-10-12T10:00:00+07:00";
        found.mentor = { id: 2, name: "Sari Wulandari" };
        found.can_decide = false;
        mentor.corrections.pendingCount = Math.max(0, mentor.corrections.pendingCount - 1);
        mentor.dashboard.pending_corrections.total = mentor.corrections.pendingCount;
        mentor.dashboard.pending_corrections.items =
          mentor.dashboard.pending_corrections.items.filter((row) => row.id !== id);
        return jsonResponse({
          message: action === "approve" ? "Koreksi diteruskan ke admin." : "Koreksi ditolak.",
          data: clone(found),
        });
      }

      const mentorCorrectionDetail = /\/api\/mentor\/corrections\/(\d+)$/.exec(path0(url));
      if (method === "GET" && mentorCorrectionDetail) {
        const found = mentor.corrections.corrections.find(
          (row) => row.id === Number(mentorCorrectionDetail[1]),
        );
        if (!found) return jsonResponse({ message: "Koreksi tidak ditemukan." }, 404);
        return jsonResponse({
          data: clone({ ...found, recorded: { clock_in_at: "08:20", clock_out_at: "17:00" } }),
        });
      }

      if (method === "GET" && path0(url).endsWith("/api/mentor/leaves")) {
        const params = new URL(url).searchParams;
        const tab = params.get("tab") ?? "pending";
        const type = params.get("type");
        const internId = params.get("intern_id");
        const rows = mentor.reviewerLeaves.leaves.filter(
          (row) =>
            (tab === "all" || row.status === "pending") &&
            (!type || row.type === type) &&
            (!internId || row.intern.id === Number(internId)),
        );
        return jsonResponse({
          data: clone(rows),
          meta: {
            pending_count: mentor.reviewerLeaves.pendingCount,
            interns: clone(mentor.reviewerLeaves.interns),
          },
        });
      }

      const mentorLeaveAction = /\/api\/mentor\/leaves\/(\d+)\/(approve|reject)$/.exec(path0(url));
      if (method === "POST" && mentorLeaveAction) {
        const id = Number(mentorLeaveAction[1]);
        const action = mentorLeaveAction[2];
        const body = JSON.parse(String(init?.body ?? "{}")) as { note?: string };
        mentor.lastLeaveBody = body;
        const found = mentor.reviewerLeaves.leaves.find((row) => row.id === id);
        if (!found) return jsonResponse({ message: "Izin tidak ditemukan." }, 404);
        if (!String(body.note ?? "").trim())
          return jsonResponse({ message: "Catatan wajib diisi." }, 422);
        found.status = action === "approve" ? "approved" : "rejected";
        found.decision_note = body.note ?? null;
        found.decided_by = { name: "Sari Wulandari", role: "mentor" };
        found.decided_at = "2026-10-12T10:00:00+07:00";
        found.can_decide = false;
        mentor.reviewerLeaves.pendingCount = Math.max(0, mentor.reviewerLeaves.pendingCount - 1);
        mentor.dashboard.pending_leaves.total = mentor.reviewerLeaves.pendingCount;
        mentor.dashboard.pending_leaves.items = mentor.dashboard.pending_leaves.items.filter(
          (row) => row.id !== id,
        );
        return jsonResponse({
          message: action === "approve" ? "Izin disetujui." : "Izin ditolak.",
          data: clone(found),
        });
      }

      const mentorLeaveDetail = /\/api\/mentor\/leaves\/(\d+)$/.exec(path0(url));
      if (method === "GET" && mentorLeaveDetail) {
        const found = mentor.reviewerLeaves.leaves.find(
          (row) => row.id === Number(mentorLeaveDetail[1]),
        );
        if (!found) return jsonResponse({ message: "Izin tidak ditemukan." }, 404);
        return jsonResponse({ data: clone(found) });
      }

      if (method === "GET" && path0(url).endsWith("/api/mentor/leave-calendar"))
        return jsonResponse({ data: clone(mentor.calendar) });
      if (method === "GET" && path0(url).endsWith("/api/mentor/performance"))
        return jsonResponse({ data: clone(mentor.performance) });

      if (method === "GET" && path0(url).endsWith("/api/mentor/assessments"))
        return jsonResponse({ data: clone(mentor.assessments) });

      const mentorSubmitAssessment = /\/api\/mentor\/assessments\/(\d+)\/submit$/.exec(path0(url));
      if (method === "POST" && mentorSubmitAssessment) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          scores?: { indicator_id: number; score: number | null }[];
          notes?: string | null;
        };
        mentor.lastAssessmentBody = {
          scores: body.scores ?? [],
          notes: body.notes ?? null,
        };
        const scores = body.scores ?? [];
        if (scores.some((row) => row.score === null))
          return jsonResponse({ message: "Isi semua nilai sebelum submit." }, 422);
        if (
          scores.some(
            (row) =>
              row.score !== null &&
              (!Number.isInteger(row.score) || row.score < 0 || row.score > 100),
          )
        )
          return jsonResponse({ message: "Nilai harus antara 0 dan 100." }, 422);
        for (const indicator of mentor.assessmentDetail.indicators) {
          const found = scores.find((row) => row.indicator_id === indicator.id);
          indicator.score = found?.score ?? null;
        }
        const average =
          scores.reduce((total, row) => total + (row.score ?? 0), 0) / Math.max(1, scores.length);
        mentor.assessmentDetail.status = "submitted";
        mentor.assessmentDetail.can_edit = false;
        mentor.assessmentDetail.can_assess = false;
        mentor.assessmentDetail.final_score = Math.round(average * 100) / 100;
        mentor.assessmentDetail.predicate = average >= 86 ? "Baik Sekali" : "Baik";
        mentor.assessmentDetail.notes = body.notes ?? null;
        mentor.assessmentDetail.submitted_at = "2026-10-12T10:00:00+07:00";
        mentor.assessmentDetail.assessed_by = "Sari Wulandari";
        mentor.assessments = mentor.assessments.map((row) =>
          row.intern.id === mentor.assessmentDetail.intern.id
            ? {
                ...row,
                status: "submitted",
                can_assess: false,
                final_score: mentor.assessmentDetail.final_score,
                submitted_at: mentor.assessmentDetail.submitted_at,
                assessed_by: mentor.assessmentDetail.assessed_by,
              }
            : row,
        );
        return jsonResponse({
          message: "Penilaian disubmit.",
          data: clone(mentor.assessmentDetail),
        });
      }

      const mentorAssessment = /\/api\/mentor\/assessments\/(\d+)$/.exec(path0(url));
      if (mentorAssessment) {
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            scores?: { indicator_id: number; score: number | null }[];
            notes?: string | null;
          };
          mentor.lastAssessmentBody = {
            scores: body.scores ?? [],
            notes: body.notes ?? null,
          };
          for (const indicator of mentor.assessmentDetail.indicators) {
            const found = (body.scores ?? []).find((row) => row.indicator_id === indicator.id);
            indicator.score = found?.score ?? null;
          }
          mentor.assessmentDetail.notes = body.notes ?? null;
          mentor.assessmentDetail.status = "draft";
          return jsonResponse({
            message: "Draf penilaian tersimpan.",
            data: clone(mentor.assessmentDetail),
          });
        }
        if (method === "GET") return jsonResponse({ data: clone(mentor.assessmentDetail) });
      }

      // ---- Izin admin (dipakai halaman bersama; data rinci menyusul Fase 4) ----
      if (method === "GET" && path0(url).endsWith("/api/admin/leaves")) {
        return jsonResponse({
          data: clone(apiState.mentor.adminLeaves.leaves),
          meta: {
            pending_count: apiState.mentor.adminLeaves.pendingCount,
            interns: clone(apiState.mentor.adminLeaves.interns),
          },
        });
      }

      const adminLeaveAction = /\/api\/admin\/leaves\/(\d+)\/(approve|reject)$/.exec(path0(url));
      if (method === "POST" && adminLeaveAction) {
        const id = Number(adminLeaveAction[1]);
        const action = adminLeaveAction[2];
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          note?: string;
          evidence_checked?: boolean;
        };
        apiState.mentor.lastLeaveBody = body;
        const found = apiState.mentor.adminLeaves.leaves.find((row) => row.id === id);
        if (!found) return jsonResponse({ message: "Izin tidak ditemukan." }, 404);
        if (!String(body.note ?? "").trim())
          return jsonResponse({ message: "Catatan wajib diisi." }, 422);
        if (action === "approve" && body.evidence_checked !== true)
          return jsonResponse({ message: "Konfirmasi pemeriksaan bukti wajib dicentang." }, 422);
        if (action === "approve" && !found.evidence_url)
          return jsonResponse({ message: "Tidak ada surat resmi atau bukti." }, 422);
        found.status = action === "approve" ? "approved" : "rejected";
        found.decision_note = body.note ?? null;
        found.decided_by = { name: "Admin Sinta", role: "admin" };
        found.decided_at = "2026-10-12T10:00:00+07:00";
        found.can_decide = false;
        found.can_approve = false;
        return jsonResponse({
          message: action === "approve" ? "Izin disetujui admin." : "Izin ditolak admin.",
          data: clone(found),
        });
      }

      const adminLeaveDetail = /\/api\/admin\/leaves\/(\d+)$/.exec(path0(url));
      if (method === "GET" && adminLeaveDetail) {
        const found = apiState.mentor.adminLeaves.leaves.find(
          (row) => row.id === Number(adminLeaveDetail[1]),
        );
        if (!found) return jsonResponse({ message: "Izin tidak ditemukan." }, 404);
        return jsonResponse({ data: clone(found) });
      }

      if (url.endsWith("/api/intern/dashboard"))
        return jsonResponse({
          data: {
            date: "2026-10-12",
            presentation_banner: apiState.presentationBanner
              ? clone(apiState.presentationBanner)
              : null,
            today: apiState.today,
            logbook_reminder:
              apiState.today.state === "clocked_in" && apiState.today.logbook === null,
            action_needed: clone(apiState.actionNeeded),
            monthly_recap: clone(apiState.recap),
            leave_quota: clone(apiState.quota),
            internship: {
              start_date: "2026-10-01",
              end_date: "2027-01-31",
              mentor: { id: 2, name: "Sari Wulandari" },
            },
            announcements: clone(apiState.announcements),
          },
        });
      if (url.endsWith("/api/intern/offices")) return jsonResponse({ data: apiState.offices });
      if (url.includes("/api/intern/logbooks/")) {
        const logDate =
          /\/api\/intern\/logbooks\/(\d{4}-\d{2}-\d{2})$/.exec(url.split("?")[0] ?? "")?.[1] ??
          "2026-10-12";
        // Tanggal selain hari ini hanya dipakai halaman daftar: hari hasil koreksi yang belum diisi.
        const detailDay = (date: string): LogbookDayMock =>
          date === "2026-10-12"
            ? logbookDay()
            : {
                date,
                attendance: {
                  status: "present",
                  clock_in_at: "08:00",
                  clock_out_at: "17:00",
                  missed_clock_out: false,
                  is_corrected: false,
                },
                logbook_state:
                  apiState.logbookDays.find((d) => d.date === date)?.logbook_state ?? "missing",
                logbook: null,
                reviews: [],
                action: "submit",
              };
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body)) as {
            work: string;
            notes: string | null;
          };
          apiState.logbookPosted.push({ date: logDate, work: body.work, notes: body.notes });
          if (logDate === "2026-10-12") {
            apiState.report = {
              id: 9,
              work: body.work,
              notes: body.notes,
              status: "draft",
              updated_at: "2026-10-12T10:00:00+07:00",
            };
            // Server mengizinkan clock out setelah logbook ada (dan jam pulang lewat; disimulasikan).
            apiState.today = {
              ...apiState.today,
              logbook: { status: "draft", work: body.work, notes: body.notes },
              can_clock_out: true,
            };
          }
          return jsonResponse({ message: "Logbook tersimpan.", data: detailDay(logDate) });
        }
        return jsonResponse({ data: detailDay(logDate) });
      }
      if (url.endsWith("/api/intern/attendance/clock-in")) {
        if (apiState.clockInResult)
          return jsonResponse(apiState.clockInResult.body, apiState.clockInResult.status);
        if (apiState.clockInPending)
          // Request ditahan: tombol harus tetap nonaktif sampai ada jawaban server.
          return new Promise<Response>(() => {});
        apiState.today = {
          ...apiState.today,
          state: "clocked_in",
          clock_in_at: "15:00",
          can_clock_out: false,
        };
        return jsonResponse(
          {
            message: "Clock in berhasil pukul 15:00.",
            data: {
              id: 1,
              date: "2026-10-12",
              clock_in_at: "15:00",
              clock_out_at: null,
              late_minutes: 0,
              is_corrected: false,
            },
          },
          201,
        );
      }
      if (url.endsWith("/api/intern/attendance/clock-out")) {
        if (apiState.clockOutResult)
          return jsonResponse(apiState.clockOutResult.body, apiState.clockOutResult.status);
        // Logbook yang diisi di dialog clock out ikut tersimpan sebagai draft.
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          work?: string | null;
          notes?: string | null;
        };
        if (typeof body.work === "string" && body.work.trim() !== "") {
          apiState.report = {
            id: 9,
            work: body.work,
            notes: body.notes ?? null,
            status: "draft",
            updated_at: "2026-10-12T17:00:00+07:00",
          };
        }
        apiState.today = {
          ...apiState.today,
          state: "clocked_out",
          clock_out_at: "17:00",
          can_clock_out: false,
          logbook: apiState.today.logbook
            ? { ...apiState.today.logbook, status: "pending_review" }
            : null,
        };
        // Setelah clock out logbook terkunci di mentor (action null).
        if (apiState.report) apiState.report = { ...apiState.report, status: "pending_review" };
        return jsonResponse({
          message: "Clock out berhasil pukul 17:00. Terima kasih.",
          data: {
            id: 1,
            date: "2026-10-12",
            clock_in_at: "15:00",
            clock_out_at: "17:00",
            late_minutes: 0,
            is_corrected: false,
          },
        });
      }
      const path = url.split("?")[0] ?? url;

      // ---- Dashboard intern lanjutan: logbook, riwayat presensi, koreksi ----
      if (method === "GET" && path.endsWith("/api/intern/logbooks")) {
        const params = new URL(url).searchParams;
        apiState.logbookParams = Object.fromEntries(params.entries());
        const status = params.get("status");
        return jsonResponse({
          data: {
            month: params.get("month") ?? "2026-10",
            selectable_months: { first: "2026-10", last: "2026-10" },
            action_needed: clone(apiState.logbookActionNeeded),
            days: apiState.logbookDays
              .filter((d) => !status || d.logbook_state === status)
              .map(clone),
          },
        });
      }
      const attendanceDayMatch = /\/api\/intern\/attendance\/days\/(\d{4}-\d{2}-\d{2})$/.exec(path);
      if (method === "GET" && attendanceDayMatch) {
        const date = attendanceDayMatch[1] ?? "";
        const found = apiState.attendanceDays.find((d) => d.date === date);
        if (!found) return jsonResponse({ message: "Presensi tidak ditemukan." }, 404);
        return jsonResponse({
          data: {
            ...clone(found),
            scheduled: { start: "08:00", end: "17:00" },
            clock_in_office: { id: 1, name: "Kantor Pusat Terminal 3" },
            clock_out_office: null,
            logbook: null,
          },
        });
      }
      if (method === "GET" && path.endsWith("/api/intern/attendance")) {
        const params = new URL(url).searchParams;
        apiState.attendanceParams = Object.fromEntries(params.entries());
        const status = params.get("status");
        return jsonResponse({
          data: {
            month: params.get("month") ?? "2026-10",
            selectable_months: { first: "2026-09", last: "2026-10" },
            recap: clone(apiState.recap),
            days: apiState.attendanceDays.filter((d) => !status || d.status === status).map(clone),
          },
        });
      }
      if (method === "GET" && path.endsWith("/api/intern/attendance-corrections")) {
        return jsonResponse({ data: apiState.corrections.map(clone) });
      }
      if (method === "POST" && path.endsWith("/api/intern/attendance-corrections")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          date?: string;
          reason?: string;
        };
        const date = String(body.date ?? "");
        const reason = String(body.reason ?? "");
        if (!date) return jsonResponse({ message: "Tanggal presensi wajib diisi." }, 422);
        if (!reason.trim()) return jsonResponse({ message: "Alasan wajib diisi." }, 422);
        apiState.correctionsPosted.push({ date, reason });
        const created: CorrectionMock = {
          id: Math.max(0, ...apiState.corrections.map((c) => c.id)) + 1,
          date,
          recorded_status: "late",
          recorded_missed_clock_out: false,
          reason,
          status: "pending_mentor",
          submitted_at: "2026-10-12T15:00:00+07:00",
          mentor: null,
          mentor_note: null,
          mentor_decided_at: null,
          admin: null,
          admin_note: null,
          admin_decided_at: null,
          can_cancel: true,
        };
        apiState.corrections = [created, ...apiState.corrections];
        return jsonResponse(
          { message: "Pengajuan koreksi terkirim. Menunggu mentor.", data: clone(created) },
          201,
        );
      }
      const correctionCancel = /\/api\/intern\/attendance-corrections\/(\d+)\/cancel$/.exec(path);
      if (method === "POST" && correctionCancel) {
        const found = apiState.corrections.find((c) => c.id === Number(correctionCancel[1]));
        if (!found) return jsonResponse({ message: "Koreksi tidak ditemukan." }, 404);
        if (!found.can_cancel) return jsonResponse({ message: "Koreksi ini sudah diproses." }, 422);
        found.status = "cancelled";
        found.can_cancel = false;
        return jsonResponse({
          message: "Pengajuan koreksi dibatalkan.",
          data: clone(found),
        });
      }
      const correctionShow = /\/api\/intern\/attendance-corrections\/(\d+)$/.exec(path);
      if (method === "GET" && correctionShow) {
        const found = apiState.corrections.find((c) => c.id === Number(correctionShow[1]));
        if (!found) return jsonResponse({ message: "Koreksi tidak ditemukan." }, 404);
        return jsonResponse({
          data: {
            ...clone(found),
            recorded: { clock_in_at: "08:20", clock_out_at: null },
          },
        });
      }
      if (path.endsWith("/api/intern/presentation")) {
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { evidence_url?: string };
          const link = String(body.evidence_url ?? "");
          if (!/^https:\/\/(drive|docs)\.google\.com\//.test(link))
            return jsonResponse(
              { message: "Link harus berupa Google Drive atau Google Docs." },
              422,
            );
          apiState.presentationPosted.push(link);
          apiState.presentation = {
            ...apiState.presentation,
            state: "pending",
            evidence_url: link,
            submitted_at: "2026-10-12T15:00:00+07:00",
            decision_note: null,
            decided_at: null,
          };
          return jsonResponse({
            message: "Bukti presentasi terkirim. Menunggu verifikasi admin.",
            data: clone(apiState.presentation),
          });
        }
        return jsonResponse({ data: clone(apiState.presentation) });
      }
      if (method === "GET" && path.endsWith("/api/intern/warnings"))
        return jsonResponse({ data: apiState.warnings.map(clone) });
      if (method === "GET" && path.endsWith("/api/intern/assessment"))
        return jsonResponse({ data: clone(apiState.assessment) });

      // ---- Izin intern (API) ----
      if (path.endsWith("/api/intern/leaves/working-days")) {
        const params = new URL(url).searchParams;
        const start = params.get("start_date") ?? "";
        const end = params.get("end_date") ?? "";
        if (!start || !end || end < start)
          return jsonResponse({ message: "Isi tanggal mulai dan selesai." }, 422);
        return jsonResponse({ data: { working_days: countWorkingDays(start, end) } });
      }
      if (method === "POST" && path.endsWith("/api/intern/leaves")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          type?: string;
          start_date?: string;
          end_date?: string;
          reason?: string;
          evidence_url?: string | null;
        };
        const type = String(body.type ?? "");
        const start = String(body.start_date ?? "");
        const end = String(body.end_date ?? "");
        const reason = String(body.reason ?? "");
        const evidenceUrl =
          body.evidence_url === null || body.evidence_url === undefined
            ? null
            : String(body.evidence_url);
        if (type !== "sick" && type !== "urgent")
          return jsonResponse({ message: "Pilih jenis izin." }, 422);
        if (!reason.trim()) return jsonResponse({ message: "Alasan wajib diisi." }, 422);
        if (apiState.quota.exhausted)
          return jsonResponse(
            { message: "Kuota izin habis. Pengajuan berikutnya tidak dapat diproses." },
            422,
          );
        if (evidenceUrl !== null && !/^https:\/\/(drive|docs)\.google\.com\//.test(evidenceUrl))
          return jsonResponse(
            { message: "Link bukti harus berupa tautan Google Drive atau Google Docs." },
            422,
          );
        const leave: LeaveMock = {
          id: Math.max(0, ...apiState.leaves.map((l) => l.id)) + 1,
          type: type as LeaveMock["type"],
          start_date: start,
          end_date: end,
          working_days: countWorkingDays(start, end),
          reason,
          evidence_url: evidenceUrl,
          status: "pending",
          submitted_at: "2026-10-12T15:00:00+07:00",
          submitted_late: false,
          decided_by: null,
          decision_note: null,
          decided_at: null,
          can_cancel: true,
        };
        apiState.leavesPosted.push({
          type,
          start_date: start,
          evidence_url: evidenceUrl,
        });
        apiState.leaves = [...apiState.leaves, leave];
        return jsonResponse(
          { message: "Izin diajukan. Menunggu mentor.", data: clone(leave) },
          201,
        );
      }
      if (method === "GET" && path.endsWith("/api/intern/leaves")) {
        if (apiState.leaveListError) return jsonResponse({ message: "Izin gagal dimuat." }, 500);
        const params = new URL(url).searchParams;
        apiState.leaveParams = Object.fromEntries(params.entries());
        const status = params.get("status");
        const leaves = apiState.leaves
          .filter((l) => !status || l.status === status)
          .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
        return jsonResponse({
          data: leaves.map(clone),
          meta: { quota: clone(apiState.quota) },
        });
      }

      const leaveDetail = /\/api\/intern\/leaves\/(\d+)(?:\/(cancel))?$/.exec(path);
      if (leaveDetail) {
        const id = Number(leaveDetail[1]);
        const action = leaveDetail[2];
        const leave = apiState.leaves.find((l) => l.id === id);
        if (!leave) return jsonResponse({ message: "Izin tidak ditemukan." }, 404);
        if (!action) return jsonResponse({ data: clone(leave) });
        if (method !== "POST") return jsonResponse({ message: "Metode tidak didukung." }, 405);
        if (leave.status !== "pending" || apiState.leaveProcessedElsewhere) {
          // Mentor atau admin memproses sebelum pembatalan sempat dikirim.
          if (apiState.leaveProcessedElsewhere && leave.status === "pending") {
            leave.status = "approved";
            leave.decided_by = { name: "Dewi Lestari", role: "mentor" };
            leave.decision_note = "Sesuai surat dokter.";
            leave.decided_at = "2026-10-12T15:01:00+07:00";
            leave.can_cancel = false;
          }
          return jsonResponse({ message: "Izin ini sudah diproses oleh Dewi Lestari." }, 422);
        }
        leave.status = "cancelled";
        leave.can_cancel = false;
        apiState.leaveCancelled.push(id);
        return jsonResponse({ message: "Pengajuan izin dibatalkan.", data: clone(leave) });
      }

      // ---- Admin (Fase 4): dashboard dan daftar lintas fitur ----
      if (method === "GET" && path0(url).endsWith("/api/admin/dashboard")) {
        return jsonResponse({ data: clone(apiState.adminDashboard) });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/users/mentors")) {
        return jsonResponse({
          data: [
            {
              id: 2,
              name: "Budi Santoso",
              unit: { id: 1, name: "Operasional" },
            },
          ],
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/users")) {
        return jsonResponse({
          data: clone(apiState.adminUsers),
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 20,
            total: apiState.adminUsers.length,
          },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/attendance/daily")) {
        return jsonResponse({
          data: {
            date: new URL(url).searchParams.get("date") ?? "2026-10-12",
            counts: {},
            interns: [],
          },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/attendance")) {
        return jsonResponse({
          data: {
            month: new URL(url).searchParams.get("month") ?? "2026-10",
            selectable_months: null,
            interns: [],
          },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/corrections")) {
        return jsonResponse({
          data: [],
          meta: { pending_admin: 0, pending_mentor: 0, interns: [] },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/presentations")) {
        return jsonResponse({
          data: [],
          meta: { pending: 0, revision: 0, approved: 0, not_submitted: 0 },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/assessments")) {
        return jsonResponse({
          data: [],
          meta: { ready: 0, blocked: 0, draft: 0, submitted: 0 },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/warnings")) {
        return jsonResponse({ data: clone(apiState.adminWarnings) });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/announcements")) {
        return jsonResponse({ data: clone(apiState.adminAnnouncements) });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/settings")) {
        return jsonResponse({ data: clone(apiState.adminSettings) });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/units")) {
        return jsonResponse({ data: clone(apiState.adminUnits) });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/reports/options")) {
        return jsonResponse({
          data: {
            interns: apiState.adminUsers
              .filter((user) => user.role === "intern")
              .map((user) => ({ id: user.id, name: user.name, email: user.email })),
            mentors: [{ id: 2, name: "Budi Santoso", is_active: true }],
            airports: apiState.adminAirports.map((airport) => ({
              id: airport.id,
              name: airport.name,
              is_active: airport.is_active,
            })),
            sheets: {
              attendance: "Rekap Presensi",
              leave: "Rekap Izin",
              logbook: "Rekap Logbook",
              assessment: "Rekap Penilaian",
            },
          },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/audit-logs/options")) {
        return jsonResponse({
          data: { admins: [{ id: 1, name: "Admin Sinta" }], actions: ["login", "update"] },
        });
      }
      if (method === "GET" && path0(url).endsWith("/api/admin/audit-logs")) {
        return jsonResponse({
          data: clone(apiState.adminAuditLogs),
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 20,
            total: apiState.adminAuditLogs.length,
          },
        });
      }

      // ---- Lokasi kantor admin (API) ----
      if (path.endsWith("/api/admin/airports"))
        return jsonResponse({
          data: apiState.adminAirports.map((airport) => ({
            ...clone(airport),
            weekly_schedule: airport.weekly_schedule ?? clone(apiState.weeklySets[0] ?? null),
          })),
          meta: { active_count: apiState.adminAirports.filter((a) => a.is_active).length },
        });
      const airportDetail = /\/api\/admin\/airports\/(\d+)$/.exec(path);
      if (airportDetail && method === "GET") {
        const airport = apiState.adminAirports.find((a) => a.id === Number(airportDetail[1]));
        if (!airport) return jsonResponse({ message: "Bandara tidak ditemukan." }, 404);
        return jsonResponse({
          data: {
            ...clone(airport),
            weekly_schedule: airport.weekly_schedule ?? clone(apiState.weeklySets[0] ?? null),
            offices: clone(
              apiState.adminOffices.filter((office) => office.airport_id === airport.id),
            ),
            upcoming_weekly_schedules: [],
            special_schedules: [],
          },
        });
      }
      if (path.endsWith("/api/admin/offices")) {
        const activeCount = () => apiState.adminOffices.filter((o) => o.is_active).length;
        if (method === "POST") {
          const body = JSON.parse(String(init?.body)) as Partial<AdminOfficeMock>;
          if (!body.airport_id)
            return jsonResponse({ message: "Pilih bandara pemilik titik presensi." }, 422);
          if (!String(body.name ?? "").trim())
            return jsonResponse({ message: "Nama kantor wajib diisi." }, 422);
          const airport = apiState.adminAirports.find((a) => a.id === body.airport_id) ?? null;
          const created: AdminOfficeMock = {
            id: Math.max(0, ...apiState.adminOffices.map((o) => o.id)) + 1,
            airport_id: body.airport_id,
            name: String(body.name).trim(),
            latitude: Number(body.latitude),
            longitude: Number(body.longitude),
            clock_in_radius_meters: Number(body.clock_in_radius_meters),
            clock_out_radius_meters: Number(body.clock_out_radius_meters),
            // Kantor baru selalu aktif, sesuai backend.
            is_active: true,
            airport: airport ? { id: airport.id, name: airport.name } : null,
          };
          apiState.adminOffices = [...apiState.adminOffices, created];
          return jsonResponse(
            {
              message: "Kantor ditambahkan.",
              data: clone(created),
              meta: { active_count: activeCount() },
            },
            201,
          );
        }
        const airportId = new URL(url).searchParams.get("airport_id");
        const rows =
          airportId === null
            ? apiState.adminOffices
            : apiState.adminOffices.filter((office) => office.airport_id === Number(airportId));
        return jsonResponse({
          data: rows.map(clone),
          meta: { active_count: rows.filter((o) => o.is_active).length },
        });
      }
      const officeToggle = /\/api\/admin\/offices\/(\d+)\/(activate|deactivate)$/.exec(path);
      if (officeToggle) {
        const office = apiState.adminOffices.find((o) => o.id === Number(officeToggle[1]));
        if (!office) return jsonResponse({ message: "Kantor tidak ditemukan." }, 404);
        office.is_active = officeToggle[2] === "activate";
        return jsonResponse({
          message: "Perubahan tersimpan.",
          data: clone(office),
          meta: { active_count: apiState.adminOffices.filter((o) => o.is_active).length },
        });
      }
      const officeDetail = /\/api\/admin\/offices\/(\d+)$/.exec(path);
      if (officeDetail && method === "PUT") {
        const index = apiState.adminOffices.findIndex((o) => o.id === Number(officeDetail[1]));
        const previous = index < 0 ? undefined : apiState.adminOffices[index];
        if (!previous) return jsonResponse({ message: "Kantor tidak ditemukan." }, 404);
        const body = JSON.parse(String(init?.body)) as Partial<AdminOfficeMock>;
        const updated: AdminOfficeMock = {
          ...previous,
          name: String(body.name ?? "").trim(),
          latitude: Number(body.latitude),
          longitude: Number(body.longitude),
          clock_in_radius_meters: Number(body.clock_in_radius_meters),
          clock_out_radius_meters: Number(body.clock_out_radius_meters),
        };
        apiState.adminOffices[index] = updated;
        return jsonResponse({
          message: "Perubahan tersimpan.",
          data: clone(updated),
          meta: { active_count: apiState.adminOffices.filter((o) => o.is_active).length },
        });
      }

      // ---- Jam kerja & libur admin (API Pengaturan) ----
      const weekly = /\/api\/admin\/airports\/(\d+)\/weekly-schedules?$/.exec(path);
      if (weekly) {
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body)) as {
            effective_from: string;
            days: WeeklySetMock["days"];
          };
          if (body.effective_from < "2026-10-27")
            return jsonResponse({ message: "Tanggal berlaku tidak boleh sebelum hari ini." }, 422);
          if (body.days.length !== 7)
            return jsonResponse({ message: "Jadwal mingguan harus berisi 7 hari." }, 422);
          const workdays = body.days.filter((d) => d.is_workday);
          if (workdays.some((d) => !d.start_time || !d.end_time))
            return jsonResponse(
              { fields: { days: ["Lengkapi jam masuk dan jam pulang hari kerja."] } },
              422,
            );
          const start = workdays[0]?.start_time ?? "-";
          const end = workdays[0]?.end_time ?? "-";
          const set: WeeklySetMock = {
            effective_from: body.effective_from,
            days: body.days.map((d) => ({ ...d })),
            summary:
              workdays.length === 5 && start === "08:00" && end === "17:00"
                ? "Sen-Jum 08:00-17:00"
                : `${workdays.length} hari kerja ${start}-${end}`,
          };
          // Satu set per tanggal berlaku (set lama dengan tanggal sama diganti).
          apiState.weeklySets = [
            ...apiState.weeklySets.filter((s) => s.effective_from !== set.effective_from),
            set,
          ].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
          return jsonResponse({ message: "Jam kerja tersimpan.", data: clone(set) });
        }
        return jsonResponse({ data: apiState.weeklySets.map(clone) });
      }
      if (path.endsWith("/api/admin/holidays")) {
        if (method === "POST" || method === "PUT") {
          const body = JSON.parse(String(init?.body)) as {
            date: string;
            name: string;
            confirm?: boolean;
          };
          if (!body.date || !body.name.trim())
            return jsonResponse({ message: "Tanggal dan nama libur wajib diisi." }, 422);
          const id =
            method === "PUT" ? Number(/\/api\/admin\/holidays\/(\d+)$/.exec(path)?.[1]) : null;
          const taken = apiState.holidays.find((h) => h.date === body.date && h.id !== id);
          if (taken) return jsonResponse({ message: "Tanggal ini sudah menjadi hari libur." }, 422);
          // Tanggal lampau butuh konfirmasi (server: reason confirm_recalculate).
          if (body.date < "2026-10-27" && !body.confirm)
            return jsonResponse(
              { message: "Tanggal ini sudah lewat.", reason: "confirm_recalculate" },
              422,
            );
          if (method === "PUT") {
            const holiday = apiState.holidays.find((h) => h.id === id);
            if (!holiday) return jsonResponse({ message: "Libur tidak ditemukan." }, 404);
            holiday.date = body.date;
            holiday.name = body.name.trim();
            holiday.is_past = body.date < "2026-10-27";
            return jsonResponse({ message: "Perubahan tersimpan.", data: clone(holiday) });
          }
          const created: HolidayMock = {
            id: apiState.holidaySeq++,
            date: body.date,
            name: body.name.trim(),
            is_past: body.date < "2026-10-27",
          };
          apiState.holidays = [...apiState.holidays, created].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          return jsonResponse({ message: "Perubahan tersimpan.", data: clone(created) }, 201);
        }
        return jsonResponse({ data: apiState.holidays.map(clone) });
      }
      const holidayDetail = /\/api\/admin\/holidays\/(\d+)$/.exec(path);
      if (holidayDetail && method === "DELETE") {
        const id = Number(holidayDetail[1]);
        const holiday = apiState.holidays.find((h) => h.id === id);
        if (!holiday) return jsonResponse({ message: "Libur tidak ditemukan." }, 404);
        apiState.holidays = apiState.holidays.filter((h) => h.id !== id);
        return jsonResponse({ message: "Perubahan tersimpan." });
      }

      return jsonResponse({ message: `Belum ditangani: ${url}` }, 404);
    }),
  );
};

type GeoBehavior = "ok" | "ditolak" | "gagal";
let geoBehavior: GeoBehavior = "ok";
let geoPosition = { lat: KANTOR_T3.latitude, lng: KANTOR_T3.longitude };

const installGeolocation = () => {
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (p: GeolocationPosition) => void,
        error?: (e: GeolocationPositionError) => void,
      ) => {
        // Async seperti browser sungguhan, agar state "Membaca lokasi..." bisa diamati.
        setTimeout(() => {
          if (geoBehavior === "ok") {
            success({
              coords: { latitude: geoPosition.lat, longitude: geoPosition.lng, accuracy: 10 },
            } as GeolocationPosition);
          } else {
            error?.({
              code: geoBehavior === "ditolak" ? 1 : 2,
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          }
        }, 10);
      },
    },
  });
};

const show = (role: Role, page: ReactNode, path = "/") => {
  authRole = role;
  router.pathname = path;
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } },
        })
      }
    >
      <AuthProvider>
        <MockProvider initialRole={role}>
          <Workspace>{page}</Workspace>
        </MockProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

/** Tombol uji untuk memanggil logout dari dalam AuthProvider. */
function LogoutProbe() {
  const auth = useAuth();
  return (
    <button type="button" onClick={() => void auth.logout()}>
      Keluar uji
    </button>
  );
}

beforeEach(() => {
  resetApi();
  realtime.reset();
  realtime.connectEcho.mockClear();
  realtime.disconnectEcho.mockClear();
  realtime.sendChatWhisper.mockClear();
  realtime.subscribeChatWhisper.mockClear();
  authRole = "Intern";
  router.navigations = [];
  router.search = {};
  geoBehavior = "ok";
  geoPosition = { lat: KANTOR_T3.latitude, lng: KANTOR_T3.longitude };
  localStorage.setItem("internspace_token", "token-uji");
  leafletSpy.circle.mockClear();
  leafletSpy.circleMarker.mockClear();
  leafletSpy.fitBounds.mockClear();
  leafletSpy.marker.mockClear();
  leafletSpy.mapClick = null;
  installGeolocation();
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  router.search = {};
  vi.useRealTimers();
});

describe("Menu per role", () => {
  const mainNav = () => within(screen.getByRole("navigation", { name: "Menu utama" }));
  const labels = () =>
    mainNav()
      .getAllByRole("link")
      .map((a) => a.textContent?.replace(/\d+$/, ""));

  it("Intern melihat menu sesuai tabel 4.3 dengan badge dari API", async () => {
    show("Intern", <Dashboard />);
    await waitFor(() => expect(mainNav().getAllByRole("link")).toHaveLength(6));
    expect(labels()).toEqual([
      "Dashboard",
      "Presensi",
      "Logbook",
      "Izin",
      "Presentasi Akhir",
      "Catatan",
    ]);
    // Badge datang dari GET /api/intern/menu (stub: logbooks 2, leaves 1).
    await waitFor(() => expect(mainNav().getByLabelText("2 menunggu")).toBeInTheDocument());
    expect(mainNav().getByLabelText("1 menunggu")).toBeInTheDocument();
  });

  it("Mentor punya Intern Saya, Koreksi Presensi, dan Input Nilai", async () => {
    show("Mentor", <Dashboard />);
    await waitFor(() => expect(mainNav().getAllByRole("link")).toHaveLength(8));
    expect(labels()).toEqual([
      "Dashboard",
      "Intern Saya",
      "Logbook",
      "Koreksi Presensi",
      "Izin",
      "Kalender Izin",
      "Performa Intern",
      "Input Nilai",
    ]);
    await waitFor(() => expect(mainNav().getByLabelText("4 menunggu")).toBeInTheDocument());
  });

  it("Admin punya menu administrasi lengkap", async () => {
    show("Admin", <Dashboard />);
    await waitFor(() => expect(mainNav().getAllByRole("link")).toHaveLength(13));
    expect(labels()).toEqual([
      "Dashboard",
      "Pengguna",
      "Presensi",
      "Koreksi",
      "Izin",
      "Presentasi Akhir",
      "Penilaian",
      "Warning",
      "Pengumuman",
      "Laporan",
      "Pengaturan",
      "Lokasi & Jadwal",
      "Log Aktivitas",
    ]);
    await waitFor(() => expect(mainNav().getByLabelText("5 menunggu")).toBeInTheDocument());
  });

  it("menu sidebar mengikuti data server, bukan daftar statis", async () => {
    apiState.menuOverride = [
      { key: "dashboard", path: "/intern/dashboard", badge: null },
      { key: "logbooks", path: "/intern/logbooks", badge: 7 },
    ];
    show("Intern", <Dashboard />);
    await waitFor(() => expect(mainNav().getAllByRole("link")).toHaveLength(2));
    expect(labels()).toEqual(["Dashboard", "Logbook"]);
    expect(mainNav().getByLabelText("7 menunggu")).toBeInTheDocument();
    expect(mainNav().queryByText("Presensi")).toBeNull();
  });

  it("menolak halaman di luar hak role", async () => {
    show("Intern", <admin.UsersPage />, "/users");
    expect(
      await screen.findByText("Anda tidak memiliki akses ke halaman ini."),
    ).toBeInTheDocument();
  });
});

describe("Setiap halaman dapat dirender", () => {
  const pages: [Role, string, ReactNode, string | RegExp][] = [
    ["Intern", "/", <Dashboard key="d" />, "Rekap bulan ini (Oktober 2026)"],
    ["Intern", "/absensi", <AttendancePage key="a" />, "Hari Ini"],
    ["Intern", "/logbook", <LogbookPage key="lb" />, "Daftar logbook"],
    ["Intern", "/izin", <LeavePage key="l" />, "Riwayat izin"],
    ["Intern", "/presentasi", <PresentationPage key="pr" />, "Presentasi akhir"],
    ["Intern", "/catatan", <NotesPage key="nt" />, "Catatan dari Admin"],
    ["Intern", "/chat", <ChatPage key="c" />, "Sari Wijaya"],
    ["Intern", "/profil", <ProfilePage key="p" />, "Data akun"],
    ["Mentor", "/", <Dashboard key="d" />, /Izin menunggu/],
    ["Mentor", "/intern-saya", <MyInternsPage key="i" />, "Rizky Pratama"],
    ["Mentor", "/logbook", <LogbookPage key="lbm" />, "Daftar logbook"],
    ["Mentor", "/koreksi", <CorrectionsPage key="km" />, "Daftar koreksi"],
    ["Mentor", "/izin", <LeavePage key="l" />, "Menunggu keputusan"],
    ["Mentor", "/kalender-izin", <LeaveCalendarPage key="k" />, "Izin Disetujui"],
    ["Mentor", "/performa", <PerformancePage key="p" />, "KPI per intern"],
    ["Mentor", "/penilaian", <AssessmentPage key="pm" />, "Daftar intern"],
    ["Admin", "/", <Dashboard key="d" />, /Magang berakhir 7 hari/],
    ["Admin", "/absensi", <AttendancePage key="a" />, "Rekap Bulanan"],
    ["Admin", "/users", <admin.UsersPage key="u" />, "Daftar pengguna"],
    ["Admin", "/koreksi", <admin.CorrectionsPage key="k" />, "Koreksi Presensi"],
    ["Admin", "/izin", <LeavePage key="l" />, "Menunggu keputusan"],
    ["Admin", "/presentasi", <PresentationPage key="pr2" />, "Presentasi Akhir"],
    ["Admin", "/penilaian", <AssessmentPage key="pa" />, "Penilaian"],
    ["Admin", "/warning", <admin.WarningsPage key="w" />, "Warning"],
    ["Admin", "/pengumuman", <admin.AnnouncementsPage key="p" />, "Daftar pengumuman"],
    ["Admin", "/laporan", <admin.ReportsPage key="r" />, "Laporan"],
    ["Admin", "/pengaturan", <admin.SettingsPage key="s" />, "Pengaturan"],
    ["Admin", "/log", <admin.LogsPage key="g" />, "Log Aktivitas"],
    ["Admin", "/lokasi-kantor", <OfficesPage key="o" />, "Daftar bandara"],
  ];
  // Sebagian halaman memuat data lewat API, jadi hasil dicek setelah render selesai.
  it.each(pages)("%s %s", async (role, path, page, text) => {
    show(role, page, path);
    await waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0));
  });
  it("halaman akun", () => {
    render(
      <AuthProvider>
        <MockProvider>
          <LoginPage />
        </MockProvider>
      </AuthProvider>,
    );
    expect(screen.getByText("Lupa password? Hubungi admin.")).toBeInTheDocument();
    render(
      <AuthProvider>
        <MockProvider>
          <ChangePasswordPage />
        </MockProvider>
      </AuthProvider>,
    );
    expect(screen.getByText("Simpan Password")).toBeInTheDocument();
  });
});

describe("Fase 3 mentor (API)", () => {
  it("Dashboard menampilkan antrean tindakan dan kartu angka memfilter daftar", async () => {
    show("Mentor", <Dashboard />, "/");
    expect(await screen.findByText(/Logbook menunggu/)).toBeInTheDocument();
    expect(screen.getByText(/Koreksi menunggu/)).toBeInTheDocument();
    expect(screen.getByText(/Izin menunggu/)).toBeInTheDocument();
    expect(screen.getByText(/Siap dinilai/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sudah Presensi/ }));
    expect(screen.getByRole("button", { name: "Tampilkan semua" })).toBeInTheDocument();
    expect(screen.getAllByText("Rizky").length).toBeGreaterThan(0);
  });

  it("Detail intern menampilkan tab dari API, termasuk catatan dan status akhir", async () => {
    router.search = { open: "21" };
    show("Mentor", <MyInternsPage />, "/intern-saya");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Rizky Pratama" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sisa kuota izin: 2 dari 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Catatan" }));
    expect(await screen.findByText("Terlambat tiga kali dalam sebulan.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Akhir Magang" }));
    expect(await screen.findByText("Siap Dinilai")).toBeInTheDocument();
    expect(screen.getByText("Disiplin Kerja")).toBeInTheDocument();
  });

  it("Logbook: minta revisi wajib catatan, setujui massal mengirim id terpilih", async () => {
    show("Mentor", <LogbookPage />, "/logbook");
    expect(await screen.findByText("Rekap data penerbangan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buka" }));
    expect(await screen.findByText(/Logbook · Rizky Pratama · .*9 Okt 2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Minta Revisi" }));
    expect(await screen.findByText("Tulis komentar revisi.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Komentar revisi"), {
      target: { value: "Lengkapi kendala harian." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Minta Revisi" }));
    await waitFor(() =>
      expect(apiState.mentor.lastLogbookBody).toEqual({
        comment: "Lengkapi kendala harian.",
      }),
    );
  });

  it("Logbook: setujui massal mengirim semua id yang dicentang", async () => {
    show("Mentor", <LogbookPage />, "/logbook");
    await screen.findByText("Rekap data penerbangan");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Pilih logbook Rizky Pratama 2026-10-09",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Setujui yang dipilih (1)" }));
    await waitFor(() => expect(apiState.mentor.lastLogbookBody).toEqual({ ids: [501] }));
  });

  it("Koreksi: Tolak wajib catatan, ACC boleh tanpa catatan", async () => {
    show("Mentor", <CorrectionsPage />, "/koreksi");
    expect(
      await screen.findByText("Jam masuk tercatat terlambat karena macet."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buka" }));
    expect(await screen.findByText("Jam tercatat")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tolak" }));
    expect(await screen.findByText("Catatan wajib diisi.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ACC" }));
    await waitFor(() => expect(apiState.mentor.lastCorrectionBody).toEqual({}));
  });

  it("Izin mentor: detail memuat bukti dan Setujui mengirim catatan", async () => {
    show("Mentor", <LeavePage />, "/izin");
    expect((await screen.findAllByText("Rizky Pratama")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Buka" }));
    expect(await screen.findByText("Buka bukti")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Catatan *"), {
      target: { value: "Sesuai surat dokter." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Setujui" }));
    await waitFor(() =>
      expect(apiState.mentor.lastLeaveBody).toEqual({ note: "Sesuai surat dokter." }),
    );
  });

  it("Kalender izin memakai entri server dan menautkan ke izin", async () => {
    show("Mentor", <LeaveCalendarPage />, "/kalender-izin");
    fireEvent.click(await screen.findByRole("button", { name: "Rizky (S)" }));
    expect(await screen.findByText(/13-14 Okt/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buka izin" })).toHaveAttribute("href", "/izin");
  });

  it("Performa menampilkan KPI dan tanggal dari server saat angka diklik", async () => {
    show("Mentor", <PerformancePage />, "/performa");
    expect(await screen.findByText("KPI per intern")).toBeInTheDocument();
    const percentages = screen.getAllByRole("button", { name: "80%" });
    fireEvent.click(percentages[percentages.length - 1]!);
    expect(await screen.findByText("Logbook belum disetujui · Rizky Pratama")).toBeInTheDocument();
    expect(screen.getByText(/9 Okt 2026/)).toBeInTheDocument();
  });

  it("Penilaian: submit butuh semua nilai lalu mengunci form", async () => {
    show("Mentor", <AssessmentPage />, "/penilaian");
    expect(await screen.findByText("Siap Dinilai")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nilai" }));
    expect(await screen.findByText("Formulir penilaian")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Isi semua nilai sebelum submit.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nilai Disiplin Kerja"), {
      target: { value: "90" },
    });
    fireEvent.change(screen.getByLabelText("Nilai Kualitas Pekerjaan"), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText("Penilaian yang sudah disubmit tidak bisa diubah lagi."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit Penilaian" }));
    await waitFor(() =>
      expect(apiState.mentor.lastAssessmentBody?.scores).toEqual([
        { indicator_id: 1, score: 90 },
        { indicator_id: 2, score: 80 },
      ]),
    );
    expect(await screen.findByText("Sudah Disubmit")).toBeInTheDocument();
  });
});

describe("Login dan profil (Fase 1)", () => {
  const fillLogin = (email: string) => {
    fireEvent.change(screen.getByPlaceholderText("nama@example.com"), {
      target: { value: email },
    });
    fireEvent.change(screen.getByPlaceholderText("Masukkan password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
  };

  it.each(["intern@injourney.test", "mentor@injourney.test", "admin@injourney.test"])(
    "login %s masuk ke /",
    async (email) => {
      render(
        <AuthProvider>
          <MockProvider initialRole="Intern">
            <LoginPage />
          </MockProvider>
        </AuthProvider>,
      );
      fillLogin(email);
      await waitFor(() => expect(router.navigations.at(-1)?.to).toBe("/"));
    },
  );

  it("intern.baru@injourney.test diarahkan ke Ganti Password lebih dulu", async () => {
    render(
      <AuthProvider>
        <MockProvider initialRole="Intern">
          <LoginPage />
        </MockProvider>
      </AuthProvider>,
    );
    fillLogin("intern.baru@injourney.test");
    await waitFor(() => expect(router.navigations.at(-1)?.to).toBe("/ganti-password"));
  });

  it("Profil hanya bisa mengubah nomor telepon", async () => {
    show("Intern", <ProfilePage />, "/profil");
    const nameInput = await screen.findByDisplayValue("Budi Santoso");
    expect(nameInput).toHaveAttribute("readonly");
    const phoneInput = screen.getByPlaceholderText("08xx-xxxx-xxxx");
    fireEvent.change(phoneInput, { target: { value: "0812-3456-7890" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(apiState.profileBody).toEqual({ phone: "0812-3456-7890" }));
  });

  it("Mengosongkan telepon mengirim null agar lolos validasi server", async () => {
    show("Intern", <ProfilePage />, "/profil");
    const phoneInput = await screen.findByPlaceholderText("08xx-xxxx-xxxx");
    fireEvent.change(phoneInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(apiState.profileBody).toEqual({ phone: null }));
  });

  it("Judul halaman penilaian mengikuti role", async () => {
    show("Mentor", <AssessmentPage />, "/penilaian");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Input Nilai" }),
    ).toBeInTheDocument();
  });
});

describe("Alur utama", () => {
  it("Intern: clock in, isi logbook, lalu clock out", async () => {
    show("Intern", <AttendancePage />, "/absensi");
    // Tunggu daftar kantor dimuat; tombol Clock In nonaktif selama itu.
    expect(await screen.findByLabelText("Kantor untuk presensi")).toBeInTheDocument();
    // Tombol baru bernama "Clock In" setelah pembacaan GPS selesai.
    fireEvent.click(await screen.findByRole("button", { name: "Clock In" }));
    expect(screen.getByRole("button", { name: /Membaca lokasi/ })).toBeDisabled();
    expect(await screen.findByText(/Hadir sejak 15:00/)).toBeInTheDocument();

    // Logbook hari ini belum ada: form isian tampil langsung di kartu Hari Ini.
    expect(screen.getByLabelText(/Yang saya kerjakan hari ini/)).toBeInTheDocument();
    // Clock Out belum aktif sebelum logbook tersimpan (can_clock_out dari server).
    expect(screen.getByRole("button", { name: /Clock Out/ })).toBeDisabled();

    // Logbook: kosong ditolak, lalu tersimpan sebagai draft.
    fireEvent.click(screen.getByRole("button", { name: "Simpan Logbook" }));
    expect(screen.getByText("Isi apa yang Anda kerjakan hari ini.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Yang saya kerjakan hari ini/), {
      target: { value: "Revisi halaman flight info" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Logbook" }));
    await waitFor(() => expect(apiState.report?.work).toBe("Revisi halaman flight info"));
    expect(await screen.findByText("Revisi halaman flight info")).toBeInTheDocument();

    // Setelah logbook tersimpan, Clock Out aktif (server mengirim can_clock_out = true).
    await waitFor(() => expect(screen.getByRole("button", { name: /Clock Out/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Clock Out/ }));
    expect(screen.getByRole("button", { name: /Membaca lokasi/ })).toBeDisabled();
    expect(
      await screen.findByText("Selesai. Clock out 17:00. Logbook menunggu review mentor."),
    ).toBeInTheDocument();
  });

  it("Admin: tidak bisa menyetujui izin pending tanpa bukti", async () => {
    router.search = { open: "6" };
    show("Admin", <LeavePage />, "/izin");
    expect(
      await screen.findByText(/Admin hanya dapat menolak atau menunggu mentor/),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Setujui" })).toBeDisabled();
  });
});

describe("Izin intern (API)", () => {
  it("Riwayat menampilkan status, detail memuat alasan penolakan dan lampiran", async () => {
    show("Intern", <LeavePage />, "/izin");
    // Tanpa filter, tanpa query: server yang mengurutkan tanggal izin terbaru lebih dulu.
    expect(await screen.findByText(/13-14 Okt/)).toBeInTheDocument();
    expect(apiState.leaveParams).toEqual({});

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("Menunggu")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("2")).toBeInTheDocument();
    // Izin yang sudah diputuskan tidak lagi bisa dibatalkan.
    expect(within(rows[2]!).queryByRole("button", { name: "Batalkan" })).toBeNull();

    fireEvent.click(within(rows[2]!).getByRole("button", { name: "Lihat" }));
    expect(await screen.findByText("Tidak ada bukti surat resmi.")).toBeInTheDocument();
    expect(screen.getByText("Dewi Lestari (mentor)")).toBeInTheDocument();
    expect(screen.getByText("Tanpa bukti")).toBeInTheDocument();
    // Diajukan setelah tanggal izin diberi label.
    expect(screen.getByText("27 Sep 08:05 · Diajukan setelah tanggal izin")).toBeInTheDocument();
  });

  it("Izin Pending menampilkan link bukti, bukan berkas", async () => {
    show("Intern", <LeavePage />, "/izin");
    const rows = await screen.findAllByRole("row");
    fireEvent.click(within(rows[1]!).getByRole("button", { name: "Lihat" }));
    const link = await screen.findByRole("link", { name: "Buka link bukti" });
    expect(link).toHaveAttribute("href", "https://drive.google.com/file/d/surat-dokter/view");
    expect(screen.getByText("Demam sejak semalam, istirahat di rumah.")).toBeInTheDocument();
    expect(screen.queryByText("Tidak ada bukti surat resmi.")).toBeNull();
  });

  it("Memilih status menyaring lewat server", async () => {
    show("Intern", <LeavePage />, "/izin");
    await screen.findByText("13-14 Okt");
    fireEvent.change(screen.getByLabelText("Filter status"), { target: { value: "rejected" } });
    await waitFor(() => expect(apiState.leaveParams?.["status"]).toBe("rejected"));
    expect(await screen.findByText("28-29 Sep")).toBeInTheDocument();
    expect(screen.queryByText("13-14 Okt")).toBeNull();
  });

  it("Ajukan izin: link non-Google ditolak server, lalu link Drive terkirim", async () => {
    show("Intern", <LeavePage />, "/izin");
    await screen.findByText("13-14 Okt");
    fireEvent.click(screen.getByRole("button", { name: /Ajukan Izin/ }));

    // Jenis izin wajib dipilih.
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    expect(await screen.findByText("Pilih jenis izin.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Izin Sakit" }));
    fireEvent.change(screen.getByLabelText(/Tanggal mulai/), { target: { value: "2026-10-19" } });
    fireEvent.change(screen.getByLabelText(/Tanggal selesai/), { target: { value: "2026-10-21" } });
    // "Total: 3 hari kerja" dihitung server dari kalender libur.
    expect(await screen.findByText("3 hari kerja")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Alasan/), {
      target: { value: "Kontrol ke dokter gigi." },
    });
    // Bukan tautan Google Drive/Docs: server menolak dan pesannya ditampilkan apa adanya.
    fireEvent.change(screen.getByLabelText(/Link bukti/), {
      target: { value: "https://example.com/surat.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    expect(
      await screen.findByText("Link bukti harus berupa tautan Google Drive atau Google Docs."),
    ).toBeInTheDocument();
    expect(apiState.leavesPosted).toEqual([]);

    fireEvent.change(screen.getByLabelText(/Link bukti/), {
      target: { value: "https://drive.google.com/file/d/surat-dokter/view" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await waitFor(() =>
      expect(apiState.leavesPosted).toEqual([
        {
          type: "sick",
          start_date: "2026-10-19",
          evidence_url: "https://drive.google.com/file/d/surat-dokter/view",
        },
      ]),
    );
    // Izin baru tampil di riwayat dengan status Menunggu.
    expect(await screen.findByText("19-21 Okt")).toBeInTheDocument();
    expect(screen.getAllByText("Menunggu").length).toBeGreaterThan(1);
  });

  it("Membatalkan izin Pending memakai konfirmasi", async () => {
    show("Intern", <LeavePage />, "/izin");
    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    expect(
      await screen.findByText("Izin Sakit 13-14 Okt akan dibatalkan dan tidak diproses lagi."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ya, batalkan" }));
    await waitFor(() => expect(apiState.leaveCancelled).toEqual([11]));
    // Tidak ada lagi izin Pending, jadi tombol Batalkan hilang seluruhnya.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Batalkan" })).toBeNull());
  });

  it("Izin yang sudah diproses mentor tidak bisa dibatalkan", async () => {
    apiState.leaveProcessedElsewhere = true;
    show("Intern", <LeavePage />, "/izin");
    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    fireEvent.click(screen.getByRole("button", { name: "Ya, batalkan" }));
    await waitFor(() => expect(apiState.leaveCancelled).toEqual([]));
    // Daftar dimuat ulang: izin kini Disetujui dan tidak bisa dibatalkan lagi.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Batalkan" })).toBeNull());
    expect(within(screen.getByRole("table")).getByText("Disetujui")).toBeInTheDocument();
  });
});

describe("Logbook, koreksi, presentasi, dan catatan intern (Fase 2)", () => {
  it("Dashboard menampilkan banner presentasi, Perlu ditindak, kuota, dan pengumuman", async () => {
    apiState.presentationBanner = {
      state: "not_submitted",
      end_date: "2026-12-31",
      days_left: 7,
    };
    apiState.actionNeeded = {
      logbooks: [
        { date: "2026-10-08", logbook_state: "revision", comment: "Tambahkan hasil rapat." },
      ],
      warnings: [{ id: 3, created_at: "2026-10-10T09:00:00+07:00" }],
      corrections: [{ id: 4, date: "2026-10-07", status: "approved" }],
      leaves: [
        {
          id: 11,
          type: "sick",
          start_date: "2026-10-13",
          end_date: "2026-10-14",
          status: "approved",
        },
      ],
    };
    show("Intern", <Dashboard />);
    expect(
      await screen.findByText(/Presentasi akhir: kirim bukti sebelum 31 Des 2026/),
    ).toBeInTheDocument();
    expect(await screen.findByText("Perlu ditindak (4)")).toBeInTheDocument();
    // Tiap baris membuka itemnya (parameter URL detail ditangani router asli).
    expect(screen.getByRole("link", { name: /Logbook Perlu revisi 8 Okt/ })).toHaveAttribute(
      "href",
      "/logbook",
    );
    expect(screen.getByRole("link", { name: /Warning Catatan baru dari admin/ })).toHaveAttribute(
      "href",
      "/catatan",
    );
    expect(screen.getByRole("link", { name: /Koreksi Disetujui 7 Okt/ })).toHaveAttribute(
      "href",
      "/absensi",
    );
    expect(screen.getByRole("link", { name: /Izin Izin Sakit · Disetujui/ })).toHaveAttribute(
      "href",
      "/izin",
    );
    // Sisa kuota dari server, bukan hitungan klien.
    expect(screen.getByText("Sisa kuota izin: 2 dari 3")).toBeInTheDocument();
    expect(screen.getByText("WFA besok")).toBeInTheDocument();
  });

  it("Logbook: daftar, filter status ke server, dan isi hari hasil koreksi", async () => {
    apiState.logbookActionNeeded = [
      { date: "2026-10-06", logbook_state: "missing", comment: null },
    ];
    apiState.logbookDays = [
      {
        date: "2026-10-09",
        attendance_status: "present",
        leave_type: null,
        logbook_state: "pending_review",
        work: "Menyusun ERD tahap 1",
        action: null,
      },
      {
        date: "2026-10-07",
        attendance_status: "leave",
        leave_type: "sick",
        logbook_state: null,
        work: null,
        action: null,
      },
      {
        date: "2026-10-06",
        attendance_status: "present",
        leave_type: null,
        logbook_state: "missing",
        work: null,
        action: "submit",
      },
    ];
    show("Intern", <LogbookPage />, "/logbook");
    expect(await screen.findByText("Daftar logbook")).toBeInTheDocument();
    expect(await screen.findByText("Menyusun ERD tahap 1")).toBeInTheDocument();
    expect(screen.getByText("Menunggu Review")).toBeInTheDocument();
    expect(screen.getByText("Izin Sakit")).toBeInTheDocument();
    expect(screen.getByText("Perlu ditindak (1)")).toBeInTheDocument();

    // Baris "Perlu ditindak" membuka detail hari itu, lalu isian dikirim sebagai `submit`.
    fireEvent.click(screen.getByRole("button", { name: /Koreksi disetujui, logbook belum diisi/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(await within(dialog).findByLabelText(/Yang saya kerjakan hari ini/), {
      target: { value: "Membersihkan data presensi" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kirim" }));
    await waitFor(() =>
      expect(apiState.logbookPosted).toEqual([
        { date: "2026-10-06", work: "Membersihkan data presensi", notes: null },
      ]),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Tutup" }));
    fireEvent.change(screen.getByLabelText("Filter status logbook"), {
      target: { value: "pending_review" },
    });
    await waitFor(() => expect(apiState.logbookParams?.["status"]).toBe("pending_review"));
    expect(await screen.findByText("Menyusun ERD tahap 1")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Izin Sakit")).toBeNull());
  });

  it("Koreksi: detail memuat data tercatat dari server", async () => {
    router.search = { tab: "koreksi" };
    apiState.corrections = [
      {
        id: 4,
        date: "2026-10-07",
        recorded_status: "late",
        recorded_missed_clock_out: false,
        reason: "Lupa clock in.",
        status: "pending_mentor",
        submitted_at: "2026-10-12T09:00:00+07:00",
        mentor: null,
        mentor_note: null,
        mentor_decided_at: null,
        admin: null,
        admin_note: null,
        admin_decided_at: null,
        can_cancel: true,
      },
    ];
    show("Intern", <AttendancePage />, "/absensi");
    expect(await screen.findByText("Menunggu Mentor")).toBeInTheDocument();
    // Baris bisa diklik untuk membuka detail (tanpa tombol Lihat saat masih bisa dibatalkan).
    fireEvent.click(screen.getByText("7 Okt 2026"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Clock in 08:20 | Clock out -")).toBeInTheDocument();
    expect(within(dialog).getByText("Lupa clock in.")).toBeInTheDocument();
    expect(within(dialog).getByText("Kondisi tercatat")).toBeInTheDocument();
  });

  it("Koreksi: tanggal + alasan terkirim dengan pesan server", async () => {
    apiState.attendanceDays = [
      {
        date: "2026-10-09",
        status: "late",
        clock_in_at: "08:20",
        clock_out_at: "17:00",
        late_minutes: 20,
        missed_clock_out: false,
        is_corrected: false,
        logbook_state: "pending_review",
        holiday_name: null,
        leave_type: null,
        has_active_correction: false,
        can_request_correction: true,
      },
    ];
    router.search = { tab: "koreksi" };
    show("Intern", <AttendancePage />, "/absensi");
    fireEvent.click(await screen.findByRole("button", { name: /Ajukan Koreksi/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Kirim" }));
    expect(within(dialog).getByText("Pilih tanggal yang akan dikoreksi.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Tanggal presensi/), {
      target: { value: "2026-10-09" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Alasan/), {
      target: { value: "Lupa clock in." },
    });
    // Kondisi hari yang dipilih dimuat dari server, bukan ditebak klien.
    expect(await within(dialog).findByText(/Clock in 08:20/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Kirim" }));
    await waitFor(() =>
      expect(apiState.correctionsPosted).toEqual([
        { date: "2026-10-09", reason: "Lupa clock in." },
      ]),
    );
  });

  it("Tautan ?date= dari logbook mengisi tanggal koreksi", async () => {
    router.search = { tab: "koreksi", date: "2026-10-09" };
    show("Intern", <AttendancePage />, "/absensi");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Tanggal presensi/)).toHaveValue("2026-10-09");
  });

  it("Presentasi akhir: link non-Google ditolak, lalu link Drive terkirim", async () => {
    show("Intern", <PresentationPage />, "/presentasi");
    const input = await screen.findByLabelText(/Link bukti/);
    fireEvent.change(input, { target: { value: "https://example.com/bukti" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    expect(
      await screen.findByText("Link harus berupa Google Drive atau Google Docs."),
    ).toBeInTheDocument();
    expect(apiState.presentationPosted).toEqual([]);

    fireEvent.change(input, {
      target: { value: "https://drive.google.com/file/d/presentasi/view" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await waitFor(() =>
      expect(apiState.presentationPosted).toEqual([
        "https://drive.google.com/file/d/presentasi/view",
      ]),
    );
    expect(await screen.findByText("Menunggu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buka link bukti" })).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/presentasi/view",
    );
  });

  it("Presentasi belum dibuka: pesan server tampil dan form disembunyikan", async () => {
    apiState.presentation = {
      ...apiState.presentation,
      state: "not_open",
      can_submit: false,
      message: "Presentasi akhir dapat dikirim mulai 24 Des 2026.",
    };
    show("Intern", <PresentationPage />, "/presentasi");
    expect(
      await screen.findByText("Presentasi akhir dapat dikirim mulai 24 Des 2026."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Link bukti/)).toBeNull();
  });

  it("Catatan: warning dan nilai akhir beserta indikator dari server", async () => {
    apiState.warnings = [
      {
        id: 1,
        body: "Terlambat 3 kali bulan ini.",
        author: "Admin Sinta",
        created_at: "2026-10-10T09:00:00+07:00",
        updated_at: null,
      },
    ];
    apiState.assessment = {
      available: true,
      final_score: 87.5,
      predicate: "Baik Sekali",
      notes: "Konsisten dan cepat belajar.",
      submitted_at: "2026-10-11T10:00:00+07:00",
      assessed_by: "Sari Wulandari",
      indicators: [
        {
          id: 1,
          category: "Sikap",
          name: "Disiplin",
          description: null,
          weight: 40,
          score: 90,
        },
        {
          id: 2,
          category: "Teknis",
          name: "Kualitas kerja",
          description: "Ketelitian",
          weight: 60,
          score: 85,
        },
      ],
    };
    show("Intern", <NotesPage />, "/catatan");
    expect(await screen.findByText("Terlambat 3 kali bulan ini.")).toBeInTheDocument();
    expect(screen.getByText(/Admin Sinta/)).toBeInTheDocument();
    expect(await screen.findByText("87.5")).toBeInTheDocument();
    expect(screen.getAllByText("Baik Sekali").length).toBeGreaterThan(0);
    expect(screen.getByText("Konsisten dan cepat belajar.")).toBeInTheDocument();
    // Indikator dikelompokkan per kategori dari server.
    expect(screen.getByText("Sikap")).toBeInTheDocument();
    expect(screen.getByText("Disiplin")).toBeInTheDocument();
    expect(screen.getByText("Teknis")).toBeInTheDocument();
  });

  it("Catatan: keadaan kosong dan nilai belum tersedia memakai pesan server", async () => {
    show("Intern", <NotesPage />, "/catatan");
    expect(await screen.findByText("Tidak ada catatan untuk Anda.")).toBeInTheDocument();
    expect(await screen.findByText("Nilai akhir belum tersedia.")).toBeInTheDocument();
  });
});

describe("Lokasi Kantor", () => {
  it("menonaktifkan kantor aktif terakhir memberi peringatan dan menampilkan banner", async () => {
    router.search = { open: String(BANDARA_CGK.id) };
    show("Admin", <OfficesPage />, "/lokasi-kantor");
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Aksi untuk Kantor Pusat Terminal 3" }),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Nonaktifkan" }));
    expect(screen.getByText(/Ini kantor aktif terakhir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));
    // Daftar dimuat ulang dari server: kantor kini nonaktif dan banner tampil.
    expect(
      await screen.findByText("Belum ada kantor aktif. Intern tidak bisa clock in."),
    ).toBeInTheDocument();
    expect(apiState.adminOffices.find((o) => o.id === ADMIN_KANTOR_T3.id)?.is_active).toBe(false);
  });

  it("menambah kantor baru dikirim ke server lengkap dengan bandara pemilik", async () => {
    router.search = { open: String(BANDARA_CGK.id) };
    show("Admin", <OfficesPage />, "/lokasi-kantor");
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Kantor" }));
    fireEvent.change(screen.getByLabelText(/Nama kantor/), {
      target: { value: "Kantor Bandung" },
    });
    // Pilih titik kantor lewat klik peta (Leaflet di-stub; klik ditangkap mapClick).
    await waitFor(() => expect(leafletSpy.mapClick).not.toBeNull());
    // Klik datang dari efek Leaflet asli, jadi dibungkus act agar state pin tersimpan.
    act(() => leafletSpy.mapClick?.(-6.9175, 107.6191));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    // Kantor baru muncul di daftar dan tersimpan di server dengan bandara yang dipilih.
    expect(await screen.findByText("Kantor Bandung")).toBeInTheDocument();
    expect(screen.getAllByText(BANDARA_CGK.name).length).toBeGreaterThan(0);
    const saved = apiState.adminOffices.at(-1);
    expect(saved).toMatchObject({
      name: "Kantor Bandung",
      airport_id: BANDARA_CGK.id,
      latitude: -6.9175,
      longitude: 107.6191,
      is_active: true,
    });
  });

  it("kantor yang diaktifkan kembali langsung bisa dipakai intern", async () => {
    router.search = { open: String(BANDARA_CGK.id) };
    show("Admin", <OfficesPage />, "/lokasi-kantor");
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Aksi untuk Kantor Cabang Terminal 1" }),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Aktifkan" }));
    // Server menyimpan perubahan; daftar dimuat ulang dan statusnya kini Aktif.
    await waitFor(() =>
      expect(
        apiState.adminOffices.find((o) => o.name === "Kantor Cabang Terminal 1")?.is_active,
      ).toBe(true),
    );
    const rows = screen.getAllByRole("row");
    const row = rows.find((r) => r.textContent?.includes("Kantor Cabang Terminal 1"));
    expect(row?.textContent).toContain("Aktif");
  });
});

describe("Lokasi absensi di kartu Hari Ini", () => {
  it("Clock In tidak aktif bila tidak ada kantor aktif", async () => {
    apiState.today.has_active_office = false;
    apiState.offices = [];
    show("Intern", <AttendancePage />, "/absensi");
    expect(await screen.findByRole("button", { name: /Clock In/ })).toBeDisabled();
    expect(
      screen.getByText("Belum ada kantor aktif. Clock in belum bisa dilakukan. Hubungi admin."),
    ).toBeInTheDocument();
  });

  it("Posisi di luar radius ditolak server, dengan jarak perkiraan dan tombol Coba lagi", async () => {
    // Sekitar 200 m dari Terminal 3: di luar radius clock in 100 m.
    geoPosition = { lat: -6.1238, lng: 106.6559 };
    apiState.clockInResult = {
      status: 422,
      body: {
        message: "Lokasi Anda belum sesuai. Clock in belum bisa dilakukan.",
        reason: "outside_radius",
      },
    };
    show("Intern", <AttendancePage />, "/absensi");
    // Tunggu tombol Clock In aktif (lokasi & kantor sudah dimuat).
    const clockIn = await screen.findByRole("button", { name: /Clock In/ });
    await waitFor(() => expect(clockIn).toBeEnabled());
    fireEvent.click(clockIn);
    expect(
      await screen.findByText("Lokasi Anda belum sesuai. Clock in belum bisa dilakukan."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
    expect(screen.getByText(/Jarak ke Kantor Pusat Terminal 3/)).toBeInTheDocument();
  });

  it("Izin lokasi ditolak menampilkan cara mengaktifkan lokasi", async () => {
    geoBehavior = "ditolak";
    show("Intern", <AttendancePage />, "/absensi");
    expect(
      await screen.findByText("Izinkan akses lokasi di browser untuk melakukan clock in."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cara mengaktifkan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Coba lagi/ })).toBeInTheDocument();
  });

  it("Gagal membaca lokasi menampilkan pesan dan tombol Coba lagi", async () => {
    geoBehavior = "gagal";
    show("Intern", <AttendancePage />, "/absensi");
    expect(await screen.findByText("Lokasi tidak dapat dibaca. Coba lagi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Coba lagi/ })).toBeInTheDocument();
  });

  it("Kantor yang dipilih di dropdown mengubah peta, jarak, dan radius", async () => {
    apiState.offices = [KANTOR_T3, KANTOR_T2];
    show("Intern", <AttendancePage />, "/absensi");
    const select = await screen.findByLabelText("Kantor untuk presensi");
    // Kantor terdekat dari posisi(user) terpilih otomatis.
    expect(await screen.findByText(/Jarak ke Kantor Pusat Terminal 3/)).toBeInTheDocument();
    expect(screen.getByText(/radius clock in 100 m/)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: String(KANTOR_T2.id) } });

    expect(await screen.findByText(/Jarak ke Kantor Terminal 2/)).toBeInTheDocument();
    expect(screen.getByText(/radius clock in 80 m/)).toBeInTheDocument();
  });

  it("Tombol Clock In nonaktif selama request berjalan (cegah klik ganda)", async () => {
    apiState.clockInPending = true;
    show("Intern", <AttendancePage />, "/absensi");
    const clockIn = await screen.findByRole("button", { name: /Clock In/ });
    await waitFor(() => expect(clockIn).toBeEnabled());

    fireEvent.click(clockIn);

    const busy = await screen.findByRole("button", { name: /Memeriksa lokasi/ });
    expect(busy).toBeDisabled();
    // Klik kedua tidak mengirim request lagi.
    fireEvent.click(busy);
    expect(await screen.findByRole("button", { name: /Memeriksa lokasi/ })).toBeDisabled();
    const clockInCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/api/intern/attendance/clock-in"));
    expect(clockInCalls).toHaveLength(1);
  });

  it("Clock Out tanpa logbook membuka dialog logbook dan isian wajib", async () => {
    apiState.today = {
      ...apiState.today,
      state: "clocked_in",
      clock_in_at: "08:00",
      can_clock_out: true,
      logbook: null,
    };
    show("Intern", <AttendancePage />, "/absensi");
    const clockOut = await screen.findByRole("button", { name: /Clock Out/ });
    await waitFor(() => expect(clockOut).toBeEnabled());

    fireEvent.click(clockOut);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Isi Logbook Sebelum Clock Out")).toBeInTheDocument();

    // Kosong ditolak dan clock out belum dikirim.
    fireEvent.click(within(dialog).getByRole("button", { name: "Kirim & Clock Out" }));
    expect(within(dialog).getByText("Isi apa yang Anda kerjakan hari ini.")).toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).endsWith("/api/intern/attendance/clock-out")),
    ).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText(/Yang saya kerjakan hari ini/), {
      target: { value: "Menyusun laporan harian" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kirim & Clock Out" }));
    await waitFor(() => expect(apiState.today.state).toBe("clocked_out"));
    // Isian logbook ikut terkirim bersama clock out.
    expect(apiState.report?.work).toBe("Menyusun laporan harian");
  });

  it("Server yang menolak clock out karena logbook hilang membuka dialog yang sama", async () => {
    apiState.today = {
      ...apiState.today,
      state: "clocked_in",
      clock_in_at: "08:00",
      can_clock_out: true,
      logbook: { status: "draft", work: "Revisi halaman flight info", notes: null },
    };
    apiState.clockOutResult = {
      status: 422,
      body: {
        message: "Isi logbook dulu sebelum clock out.",
        reason: "logbook_missing",
      },
    };
    show("Intern", <AttendancePage />, "/absensi");
    const clockOut = await screen.findByRole("button", { name: /Clock Out/ });
    await waitFor(() => expect(clockOut).toBeEnabled());

    fireEvent.click(clockOut);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Isi Logbook Sebelum Clock Out")).toBeInTheDocument();
    expect(within(dialog).getByText("Isi logbook dulu sebelum clock out.")).toBeInTheDocument();
  });

  it("Peta kecil menampilkan lingkaran radius kantor dan posisi user", async () => {
    // Posisi user ~67 m dari kantor, supaya marker user dan kantor bisa dibedakan.
    geoPosition = { lat: -6.125, lng: 106.6559 };
    show("Intern", <AttendancePage />, "/absensi");
    expect(await screen.findByLabelText("Peta kantor dan posisi Anda")).toBeInTheDocument();

    // Lingkaran radius mengikuti kantor terpilih dan jenis aksi (clock in).
    await waitFor(() =>
      expect(leafletSpy.circle).toHaveBeenCalledWith(
        [KANTOR_T3.latitude, KANTOR_T3.longitude],
        expect.objectContaining({ radius: KANTOR_T3.clock_in_radius_meters }),
      ),
    );
    // Posisi user digambar sebagai marker tersendiri.
    await waitFor(() =>
      expect(leafletSpy.circleMarker).toHaveBeenCalledWith(
        expect.objectContaining({ lat: geoPosition.lat, lng: geoPosition.lng }),
        expect.anything(),
      ),
    );
  });

  it("Pengguna bisa memilih kantor lain dari dropdown kantor aktif", async () => {
    apiState.offices = [KANTOR_T3, KANTOR_T2];
    show("Intern", <AttendancePage />, "/absensi");
    const select = await screen.findByLabelText("Kantor untuk presensi");
    expect(select).toHaveValue(String(KANTOR_T3.id));
    expect(
      within(select).getByRole("option", { name: "Kantor Pusat Terminal 3" }),
    ).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Kantor Terminal 2" })).toBeInTheDocument();
  });
});

describe("Lonceng, chat, dan real-time (Fase 5)", () => {
  it("Lonceng memakai unread_count server; klik menandai dibaca dan membuka link_params", async () => {
    show("Intern", <Dashboard />, "/");
    const bell = await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" });
    fireEvent.click(bell);

    expect(await screen.findByText("Logbook 8 Okt perlu direvisi.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Logbook 8 Okt perlu direvisi."));

    await waitFor(() => expect(apiState.notificationReads).toEqual([1]));
    await waitFor(() => expect(router.navigations.at(-1)?.to).toBe("/logbook"));
    expect(router.navigations.at(-1)).toMatchObject({ search: { date: "2026-10-08" } });
  });

  it("Notifikasi real-time menambah isi lonceng tanpa memuat ulang halaman", async () => {
    show("Intern", <Dashboard />, "/");
    await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" });

    act(() => {
      realtime.emit("notification.sent", {
        notification: {
          id: 2,
          text: "Pengumuman baru dari admin.",
          link_path: "/",
          link_params: { announcement: 1 },
          read_at: null,
          created_at: "2026-10-12T09:30:00+07:00",
        },
        unread_count: 2,
      });
    });

    expect(
      await screen.findByRole("button", { name: "Notifikasi, 2 belum dibaca" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notifikasi, 2 belum dibaca" }));
    expect(await screen.findByText("Pengumuman baru dari admin.")).toBeInTheDocument();
  });

  it("Chat membuka percakapan dari ?to, menandai dibaca, dan mengirim pesan", async () => {
    router.search = { to: "2" };
    show("Intern", <ChatPage />, "/chat");

    expect((await screen.findAllByText("Halo, apa kabar?")).length).toBeGreaterThan(1);
    await waitFor(() => expect(apiState.chatReads).toContain(2));

    fireEvent.change(screen.getByLabelText("Tulis pesan"), {
      target: { value: "Baik, terima kasih." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim pesan" }));

    expect((await screen.findAllByText("Baik, terima kasih.")).length).toBeGreaterThan(1);
    expect(apiState.chatSent).toEqual(["Baik, terima kasih."]);
    expect(screen.getByLabelText("Tulis pesan")).toHaveValue("");
  });

  it("Pesan chat real-time masuk ke percakapan aktif dan indikator online mengikuti presence", async () => {
    router.search = { to: "2" };
    show("Intern", <ChatPage />, "/chat");
    await screen.findAllByText("Halo, apa kabar?");

    act(() => {
      realtime.setOnline([{ id: 2, name: "Sari Wijaya" }]);
      realtime.emit("chat.message", {
        message: {
          id: 2,
          sender_id: 2,
          receiver_id: 1,
          body: "Pesan real-time masuk.",
          read_at: null,
          created_at: "2026-10-12T10:05:00+07:00",
        },
        sender: { id: 2, name: "Sari Wijaya" },
      });
    });

    expect(await screen.findByText("Pesan real-time masuk.")).toBeInTheDocument();
    expect(screen.getByLabelText("Online")).toBeInTheDocument();
  });

  it("Detail pengumuman dari notifikasi dibuka lewat GET /api/announcements/{id}", async () => {
    router.search = { announcement: "1" };
    show("Intern", <Dashboard />, "/");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("WFA besok")).toBeInTheDocument();
    expect(within(dialog).getByText("Besok WFA, presensi tetap wajib.")).toBeInTheDocument();
  });

  it("Logout memutus koneksi realtime", async () => {
    show("Intern", <LogoutProbe />, "/");
    await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" });
    realtime.disconnectEcho.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Keluar uji" }));

    await waitFor(() => expect(realtime.disconnectEcho).toHaveBeenCalled());
  });

  it("401 memutus koneksi realtime", async () => {
    show("Intern", <Dashboard />, "/");
    await screen.findByRole("button", { name: "Notifikasi, 1 belum dibaca" });
    realtime.disconnectEcho.mockClear();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });

    await waitFor(() => expect(realtime.disconnectEcho).toHaveBeenCalled());
  });
});

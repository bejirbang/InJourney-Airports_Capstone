import { forwardRef, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/mock-rules";

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

const { MockProvider } = await import("@/components/internspace/shared/model");
const { AuthProvider } = await import("@/lib/auth");
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
};

const BANDARA_CGK: AirportMock = {
  id: 1,
  name: "Bandara Soekarno-Hatta",
  city: "Jakarta",
  is_active: true,
  active_offices: 1,
  active_interns: 3,
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
  weeklySets: [] as WeeklySetMock[],
  holidays: [] as HolidayMock[],
  holidaySeq: 1,
  /** Body terakhir PUT /api/auth/profile, untuk membuktikan hanya `phone` yang dikirim. */
  profileBody: null as Record<string, unknown> | null,
  /** Menu contoh yang menggantikan GET /api/{role}/menu (uji sumber menu sidebar). */
  menuOverride: null as { key: string; path: string; badge: number | null }[] | null,
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
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

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

      // ---- Lokasi kantor admin (API) ----
      if (path.endsWith("/api/admin/airports"))
        return jsonResponse({
          data: apiState.adminAirports.map(clone),
          meta: { active_count: apiState.adminAirports.filter((a) => a.is_active).length },
        });
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
        return jsonResponse({
          data: apiState.adminOffices.map(clone),
          meta: { active_count: activeCount() },
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

beforeEach(() => {
  resetApi();
  authRole = "Intern";
  router.navigations = [];
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
    ["Intern", "/chat", <ChatPage key="c" />, "Budi Santoso"],
    ["Intern", "/profil", <ProfilePage key="p" />, "Data akun"],
    ["Mentor", "/", <Dashboard key="d" />, /Izin pending/],
    ["Mentor", "/intern-saya", <MyInternsPage key="i" />, "Rizky Pratama"],
    [
      "Mentor",
      "/logbook",
      <LogbookPage key="lbm" />,
      "Bagian ini sedang disiapkan pada fase berikutnya.",
    ],
    [
      "Mentor",
      "/koreksi",
      <CorrectionsPage key="km" />,
      "Bagian ini sedang disiapkan pada fase berikutnya.",
    ],
    ["Mentor", "/izin", <LeavePage key="l" />, "Menunggu keputusan"],
    ["Mentor", "/kalender-izin", <LeaveCalendarPage key="k" />, "Izin Disetujui"],
    ["Mentor", "/performa", <PerformancePage key="p" />, "KPI per intern"],
    [
      "Mentor",
      "/penilaian",
      <AssessmentPage key="pm" />,
      "Bagian ini sedang disiapkan pada fase berikutnya.",
    ],
    ["Admin", "/", <Dashboard key="d" />, /Magang berakhir dalam 7 hari/],
    ["Admin", "/absensi", <AttendancePage key="a" />, "Rekap Bulanan"],
    ["Admin", "/users", <admin.UsersPage key="u" />, "Daftar pengguna"],
    ["Admin", "/koreksi", <admin.CorrectionsPage key="k" />, "Permintaan koreksi"],
    ["Admin", "/izin", <LeavePage key="l" />, "Menunggu keputusan"],
    [
      "Admin",
      "/presentasi",
      <PresentationPage key="pr2" />,
      "Bagian ini sedang disiapkan pada fase berikutnya.",
    ],
    [
      "Admin",
      "/penilaian",
      <AssessmentPage key="pa" />,
      "Bagian ini sedang disiapkan pada fase berikutnya.",
    ],
    ["Admin", "/warning", <admin.WarningsPage key="w" />, "Hanya terlihat oleh admin"],
    ["Admin", "/pengumuman", <admin.AnnouncementsPage key="p" />, "Daftar pengumuman"],
    ["Admin", "/laporan", <admin.ReportsPage key="r" />, "Buat laporan"],
    ["Admin", "/pengaturan", <admin.SettingsPage key="s" />, "Riwayat jam kerja"],
    ["Admin", "/log", <admin.LogsPage key="g" />, "Waktu"],
    ["Admin", "/lokasi-kantor", <OfficesPage key="o" />, "Kantor Pusat Terminal 3"],
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
    expect(await screen.findByText("13-14 Okt")).toBeInTheDocument();
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

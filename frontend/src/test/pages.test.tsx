import { forwardRef, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/mock-rules";

// Router tiruan: halaman cukup butuh Link, useSearch, useNavigate, dan useLocation.
const router = vi.hoisted(() => ({ search: {} as Record<string, string>, pathname: "/" }));
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
  useNavigate: () => () => Promise.resolve(),
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
const { Dashboard, AttendancePage, LeavePage } =
  await import("@/components/internspace/shared/role-pages");
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
type LogbookDayMock = {
  date: string;
  attendance: null | {
    status: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    missed_clock_out: boolean;
    is_corrected: boolean;
  };
  logbook: ReportMock | null;
  action: "save" | "submit" | "resubmit" | null;
};
/** Bentuk respon `GET /api/intern/logbooks/{date}` menurut state stub. */
const logbookDay = (): LogbookDayMock => ({
  date: "2026-10-12",
  attendance:
    apiState.today.state === "not_clocked_in" || apiState.today.state === "holiday"
      ? null
      : {
          status:
            apiState.today.state === "clocked_out"
              ? "hadir"
              : apiState.today.state === "missed_clock_in"
                ? "lupa_clock_in"
                : "belum_clock_in",
          clock_in_at: apiState.today.clock_in_at,
          clock_out_at: apiState.today.clock_out_at,
          missed_clock_out: false,
          is_corrected: false,
        },
  logbook: apiState.report ? { ...apiState.report } : null,
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
  has_evidence: boolean;
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
  has_evidence: true,
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
  has_evidence: false,
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
  clockInResult: null as null | { status: number; body: unknown },
  clockOutResult: null as null | { status: number; body: unknown },
  /** Clock in yang tidak pernah selesai, untuk menguji tombol nonaktif saat request berjalan. */
  clockInPending: false,
  leaves: [] as LeaveMock[],
  /** Query izin terakhir yang diterima server, untuk membuktikan filter status dikirim. */
  leaveParams: null as Record<string, string> | null,
  leavesPosted: [] as { type: string; start_date: string; evidence: string | null }[],
  leaveCancelled: [] as number[],
  /** Mentor memproses izin tepat sebelum intern menekan "Ya, batalkan" (422). */
  leaveProcessedElsewhere: false,
  leaveListError: false,
  adminOffices: [] as AdminOfficeMock[],
  adminAirports: [] as AirportMock[],
  weeklySets: [] as WeeklySetMock[],
  holidays: [] as HolidayMock[],
  holidaySeq: 1,
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
};

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const installFetch = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/api/auth/me"))
        return jsonResponse({
          data: {
            id: 1,
            name: "Budi Santoso",
            email: "intern@injourney.test",
            role: "intern",
            title: null,
            phone: null,
            photo_url: null,
            is_active: true,
            must_change_password: false,
            intern_profile: { mentor_id: 2, start_date: "2026-10-01", end_date: "2027-01-31" },
          },
        });
      if (url.endsWith("/api/intern/dashboard"))
        return jsonResponse({
          data: {
            date: "2026-10-12",
            today: apiState.today,
            logbook_reminder:
              apiState.today.state === "clocked_in" && apiState.today.logbook === null,
          },
        });
      if (url.endsWith("/api/intern/offices")) return jsonResponse({ data: apiState.offices });
      if (url.includes("/api/intern/logbooks/")) {
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body)) as { work: string; notes: string | null };
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
          return jsonResponse({ message: "Logbook tersimpan.", data: logbookDay() });
        }
        return jsonResponse({ data: logbookDay() });
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
        const form = init?.body as FormData;
        const type = String(form.get("type"));
        const start = String(form.get("start_date"));
        const end = String(form.get("end_date"));
        const reason = String(form.get("reason"));
        const evidence = form.get("evidence");
        if (type !== "sick" && type !== "urgent")
          return jsonResponse({ message: "Pilih jenis izin." }, 422);
        if (!reason.trim()) return jsonResponse({ message: "Alasan wajib diisi." }, 422);
        if (evidence instanceof File) {
          const ext = evidence.name.split(".").pop()?.toLowerCase() ?? "";
          if (!["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext))
            return jsonResponse(
              { message: "Jenis file tidak diizinkan. Gunakan PDF, Word, Excel, atau PowerPoint." },
              422,
            );
          if (evidence.size > 2 * 1024 * 1024)
            return jsonResponse({ message: "Ukuran file maksimal 2 MB." }, 422);
        }
        const leave: LeaveMock = {
          id: Math.max(0, ...apiState.leaves.map((l) => l.id)) + 1,
          type: type as LeaveMock["type"],
          start_date: start,
          end_date: end,
          working_days: countWorkingDays(start, end),
          reason,
          has_evidence: evidence instanceof File,
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
          evidence: evidence instanceof File ? evidence.name : null,
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
        return jsonResponse({ data: leaves.map(clone) });
      }

      const leaveDetail = /\/api\/intern\/leaves\/(\d+)(?:\/(cancel|evidence))?$/.exec(path);
      if (leaveDetail) {
        const id = Number(leaveDetail[1]);
        const action = leaveDetail[2];
        const leave = apiState.leaves.find((l) => l.id === id);
        if (!leave) return jsonResponse({ message: "Izin tidak ditemukan." }, 404);
        if (!action) return jsonResponse({ data: clone(leave) });
        if (action === "evidence") {
          if (!leave.has_evidence)
            return jsonResponse({ message: "Lampiran tidak ditemukan." }, 404);
          return new Response("lampiran", {
            status: 200,
            headers: { "Content-Disposition": 'attachment; filename="lampiran-izin.pdf"' },
          });
        }
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
  it("Intern hanya melihat Dashboard, Presensi, dan Izin", () => {
    show("Intern", <Dashboard />);
    const nav = within(screen.getByRole("navigation", { name: "Menu utama" }));
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Dashboard",
      "Presensi",
      "Izin",
    ]);
  });
  it("Mentor punya Intern Saya, Kalender Izin, dan Performa Intern", () => {
    show("Mentor", <Dashboard />);
    const labels = within(screen.getByRole("navigation", { name: "Menu utama" }))
      .getAllByRole("link")
      .map((a) => a.textContent?.replace(/\d+$/, ""));
    expect(labels).toEqual([
      "Dashboard",
      "Intern Saya",
      "Izin",
      "Kalender Izin",
      "Performa Intern",
    ]);
  });
  it("Admin punya menu administrasi lengkap", () => {
    show("Admin", <Dashboard />);
    const labels = within(screen.getByRole("navigation", { name: "Menu utama" }))
      .getAllByRole("link")
      .map((a) => a.textContent?.replace(/\d+$/, ""));
    expect(labels).toEqual([
      "Dashboard",
      "Pengguna",
      "Presensi",
      "Koreksi",
      "Izin",
      "Warning",
      "Pengumuman",
      "Laporan",
      "Pengaturan",
      "Lokasi Kantor",
      "Log Aktivitas",
    ]);
  });
  it("menolak halaman di luar hak role", () => {
    show("Intern", <admin.UsersPage />, "/users");
    expect(screen.getByText("Anda tidak memiliki akses ke halaman ini.")).toBeInTheDocument();
  });
});

describe("Setiap halaman dapat dirender", () => {
  const pages: [Role, string, ReactNode, string | RegExp][] = [
    ["Intern", "/", <Dashboard key="d" />, "Rekap bulan ini (Oktober 2026)"],
    ["Intern", "/absensi", <AttendancePage key="a" />, "Daily Report - Sen, 12 Okt 2026"],
    ["Intern", "/izin", <LeavePage key="l" />, "Riwayat izin"],
    ["Intern", "/chat", <ChatPage key="c" />, "Budi Santoso"],
    ["Intern", "/profil", <ProfilePage key="p" />, "Data akun"],
    ["Mentor", "/", <Dashboard key="d" />, /Izin pending/],
    ["Mentor", "/intern-saya", <MyInternsPage key="i" />, "Rizky Pratama"],
    ["Mentor", "/izin", <LeavePage key="l" />, "Menunggu keputusan"],
    ["Mentor", "/kalender-izin", <LeaveCalendarPage key="k" />, "Izin Disetujui"],
    ["Mentor", "/performa", <PerformancePage key="p" />, "KPI per intern"],
    ["Admin", "/", <Dashboard key="d" />, /Magang berakhir dalam 7 hari/],
    ["Admin", "/absensi", <AttendancePage key="a" />, "Rekap Bulanan"],
    ["Admin", "/users", <admin.UsersPage key="u" />, "Daftar pengguna"],
    ["Admin", "/koreksi", <admin.CorrectionsPage key="k" />, "Permintaan koreksi"],
    ["Admin", "/izin", <LeavePage key="l" />, "Menunggu keputusan"],
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

describe("Alur utama", () => {
  it("Intern: clock in, isi Daily Report, lalu clock out", async () => {
    show("Intern", <AttendancePage />, "/absensi");
    expect(
      await screen.findByText("Clock in dulu untuk mengisi Daily Report."),
    ).toBeInTheDocument();
    // Tunggu daftar kantor dimuat; tombol Clock In nonaktif selama itu.
    expect(await screen.findByLabelText("Kantor untuk presensi")).toBeInTheDocument();
    // Tombol baru bernama "Clock In" setelah pembacaan GPS selesai.
    fireEvent.click(await screen.findByRole("button", { name: "Clock In" }));
    expect(screen.getByRole("button", { name: /Membaca lokasi/ })).toBeDisabled();
    expect(await screen.findByText(/Sudah Clock In/)).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();

    // Clock Out belum aktif sebelum Daily Report terkirim.
    expect(screen.getByRole("button", { name: /Clock Out/ })).toBeDisabled();
    expect(screen.getByText("Isi Daily Report dulu sebelum clock out.")).toBeInTheDocument();

    // Daily Report: kosong ditolak, lalu tersimpan.
    fireEvent.click(screen.getByRole("button", { name: "Simpan Laporan" }));
    expect(screen.getByText("Isi apa yang Anda kerjakan hari ini.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Yang saya kerjakan hari ini/), {
      target: { value: "Revisi halaman flight info" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Laporan" }));
    await waitFor(() => expect(screen.getByText("Revisi halaman flight info")).toBeInTheDocument());

    // Setelah logbook tersimpan, Clock Out aktif (server mengirim can_clock_out = true).
    await waitFor(() => expect(screen.getByRole("button", { name: /Clock Out/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Clock Out/ }));
    expect(screen.getByRole("button", { name: /Membaca lokasi/ })).toBeDisabled();
    expect(await screen.findByText(/Hadir, clock out 17:00/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Laporan terkunci setelah clock out.")).toBeInTheDocument(),
    );
  });

  it("Admin: tidak bisa menyetujui izin pending tanpa bukti", () => {
    router.search = { open: "6" };
    show("Admin", <LeavePage />, "/izin");
    expect(screen.getByText(/Admin hanya dapat menolak atau menunggu mentor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setujui" })).toBeDisabled();
  });
});

describe("Izin intern (API)", () => {
  it("Riwayat menampilkan status, detail memuat alasan penolakan dan lampiran", async () => {
    show("Intern", <LeavePage />, "/izin");
    // Tanpa filter, tanpa query: server yang mengurutkan tanggal izin terbaru lebih dulu.
    expect(await screen.findByText("13-14 Okt")).toBeInTheDocument();
    expect(apiState.leaveParams).toEqual({});

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("Pending")).toBeInTheDocument();
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

  it("Izin Pending membuka Unduh lampiran dan dialog Batalkan", async () => {
    show("Intern", <LeavePage />, "/izin");
    const rows = await screen.findAllByRole("row");
    fireEvent.click(within(rows[1]!).getByRole("button", { name: "Lihat" }));
    expect(await screen.findByText("Lampiran bukti")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh" })).toBeInTheDocument();
    expect(screen.getByText("Demam sejak semalam, istirahat di rumah.")).toBeInTheDocument();
    expect(screen.queryByText("Catatan pemroses")).toBeNull();
  });

  it("Memilih status menyaring lewat server", async () => {
    show("Intern", <LeavePage />, "/izin");
    await screen.findByText("13-14 Okt");
    fireEvent.change(screen.getByLabelText("Filter status"), { target: { value: "rejected" } });
    await waitFor(() => expect(apiState.leaveParams?.["status"]).toBe("rejected"));
    expect(await screen.findByText("28-29 Sep")).toBeInTheDocument();
    expect(screen.queryByText("13-14 Okt")).toBeNull();
  });

  it("Ajukan izin: jenis file lain ditolak di klien, lalu lampiran PDF terkirim", async () => {
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
    // Jenis file lain ditolak di klien sebelum dikirim.
    fireEvent.change(screen.getByLabelText("Lampiran bukti"), {
      target: { files: [new File(["isi"], "surat.png", { type: "image/png" })] },
    });
    expect(await screen.findByText(/Jenis file tidak diizinkan/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Lampiran bukti"), {
      target: { files: [new File(["isi"], "surat-dokter.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    await waitFor(() =>
      expect(apiState.leavesPosted).toEqual([
        { type: "sick", start_date: "2026-10-19", evidence: "surat-dokter.pdf" },
      ]),
    );
    // Izin baru tampil di riwayat dengan status Pending.
    expect(await screen.findByText("19-21 Okt")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(1);
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

  it("Clock Out ditolak server karena logbook belum diisi dan membuka dialog laporan", async () => {
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
    expect(within(dialog).getByText("Daily Report belum dikirim")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Isi Daily Report" })).toBeInTheDocument();
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

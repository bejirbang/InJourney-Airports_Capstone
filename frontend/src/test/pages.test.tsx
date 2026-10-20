import { forwardRef, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const leafletSpy = vi.hoisted(() => ({
  circle: vi.fn(),
  circleMarker: vi.fn(),
  fitBounds: vi.fn(),
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
  const instance = {
    setView: () => instance,
    remove: () => undefined,
    fitBounds: leafletSpy.fitBounds,
    invalidateSize: () => undefined,
  };
  const L = {
    map: () => instance,
    tileLayer: () => layer,
    circle: leafletSpy.circle,
    circleMarker: leafletSpy.circleMarker,
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
const { TasksPage } = await import("@/components/internspace/shared/tasks");
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
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number | null;
  daily_report_sent: boolean;
  holiday_name: string | null;
  leave_type: string | null;
  has_active_office: boolean;
  work_hours: { start: string; end: string } | null;
};
type OfficeMock = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  clock_in_radius_meters: number;
  clock_out_radius_meters: number;
};
type ReportMock = {
  id: number;
  date: string;
  work: string;
  notes: string | null;
  sent_at: string;
  editable: boolean;
};

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

const apiState = {
  today: {} as TodayMock,
  offices: [] as OfficeMock[],
  report: null as ReportMock | null,
  clockInResult: null as null | { status: number; body: unknown },
  clockOutResult: null as null | { status: number; body: unknown },
  /** Clock in yang tidak pernah selesai, untuk menguji tombol nonaktif saat request berjalan. */
  clockInPending: false,
};

const resetApi = () => {
  apiState.today = {
    state: "not_clocked_in",
    clock_in_at: null,
    clock_out_at: null,
    late_minutes: null,
    daily_report_sent: false,
    holiday_name: null,
    leave_type: null,
    has_active_office: true,
    work_hours: { start: "08:00", end: "17:00" },
  };
  apiState.offices = [KANTOR_T3];
  apiState.report = null;
  apiState.clockInResult = null;
  apiState.clockOutResult = null;
  apiState.clockInPending = false;
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
            daily_report_reminder:
              apiState.today.state === "clocked_in" && !apiState.today.daily_report_sent,
          },
        });
      if (url.endsWith("/api/intern/offices")) return jsonResponse({ data: apiState.offices });
      if (url.endsWith("/api/intern/attendance/daily-report")) {
        if (method === "PUT") {
          const body = JSON.parse(String(init?.body)) as { work: string; notes: string | null };
          apiState.report = {
            id: 9,
            date: "2026-10-12",
            work: body.work,
            notes: body.notes,
            sent_at: "2026-10-12T10:00:00+07:00",
            editable: true,
          };
          apiState.today.daily_report_sent = true;
          return jsonResponse({ message: "Daily Report terkirim.", data: apiState.report }, 201);
        }
        return jsonResponse({ data: apiState.report ? { ...apiState.report } : null });
      }
      if (url.endsWith("/api/intern/attendance/clock-in")) {
        if (apiState.clockInResult)
          return jsonResponse(apiState.clockInResult.body, apiState.clockInResult.status);
        if (apiState.clockInPending)
          // Request ditahan: tombol harus tetap nonaktif sampai ada jawaban server.
          return new Promise<Response>(() => {});
        apiState.today = { ...apiState.today, state: "clocked_in", clock_in_at: "15:00" };
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
        apiState.today = { ...apiState.today, state: "clocked_out", clock_out_at: "17:00" };
        if (apiState.report) apiState.report = { ...apiState.report, editable: false };
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
  it("Intern hanya melihat Dashboard, Absensi, Task, Izin", () => {
    show("Intern", <Dashboard />);
    const nav = within(screen.getByRole("navigation", { name: "Menu utama" }));
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Dashboard",
      "Absensi",
      "Task",
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
      "Task",
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
      "Absensi",
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
    ["Intern", "/task", <TasksPage key="t" />, "Redesign halaman informasi penerbangan"],
    ["Intern", "/izin", <LeavePage key="l" />, "Riwayat izin"],
    ["Intern", "/chat", <ChatPage key="c" />, "Budi Santoso"],
    ["Intern", "/profil", <ProfilePage key="p" />, "Data akun"],
    ["Mentor", "/", <Dashboard key="d" />, /Task menunggu review/],
    ["Mentor", "/intern-saya", <MyInternsPage key="i" />, "Rizky Pratama"],
    ["Mentor", "/task", <TasksPage key="t" />, "Laporan uji API login dan absensi"],
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
  it.each(pages)("%s %s", (role, path, page, text) => {
    show(role, page, path);
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
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
    expect(await screen.findByText("Clock in dulu untuk mengisi Daily Report.")).toBeInTheDocument();
    // Tunggu daftar kantor dimuat; tombol Clock In nonaktif selama itu.
    expect(await screen.findByLabelText("Kantor untuk absensi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clock In/ }));
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
    await waitFor(() =>
      expect(screen.getByText("Revisi halaman flight info")).toBeInTheDocument(),
    );

    // Setelah terkirim, Clock Out aktif kembali (daily_report_sent = true).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Clock Out/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Clock Out/ }));
    expect(screen.getByRole("button", { name: /Membaca lokasi/ })).toBeDisabled();
    expect(await screen.findByText(/Hadir, clock out 17:00/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Laporan terkunci setelah clock out.")).toBeInTheDocument(),
    );
  });

  it("Intern: Kanban menolak To Do ke In Review dan menerima To Do ke In Progress", () => {
    show("Intern", <TasksPage />, "/task");
    const card = screen.getByRole("button", { name: "Buka Dokumentasi alur sistem check-in" });
    const column = (name: string) => screen.getByLabelText(`Kolom ${name}`);
    const drag = (target: string) => {
      fireEvent.dragStart(card, { dataTransfer: { setData: () => undefined } });
      fireEvent.drop(column(target), { dataTransfer: { getData: () => "TSK-023" } });
    };
    drag("In Review");
    expect(
      within(column("To Do")).getByText("Dokumentasi alur sistem check-in"),
    ).toBeInTheDocument();
    drag("In Progress");
    expect(
      within(column("In Progress")).getByText("Dokumentasi alur sistem check-in"),
    ).toBeInTheDocument();
  });

  it("Mentor: menyeret kartu In Review ke Done membuka konfirmasi Accept", () => {
    show("Mentor", <TasksPage />, "/task");
    const card = screen.getByRole("button", { name: "Buka Laporan uji API login dan absensi" });
    fireEvent.dragStart(card, { dataTransfer: { setData: () => undefined } });
    fireEvent.drop(screen.getByLabelText("Kolom Done"), {
      dataTransfer: { getData: () => "TSK-022" },
    });
    expect(screen.getByText("Accept Task - Laporan uji API login dan absensi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(
      within(screen.getByLabelText("Kolom Done")).getByText("Laporan uji API login dan absensi"),
    ).toBeInTheDocument();
  });

  it("Admin: tidak bisa menyetujui izin pending tanpa bukti", () => {
    router.search = { open: "6" };
    show("Admin", <LeavePage />, "/izin");
    expect(screen.getByText(/Admin hanya dapat menolak atau menunggu mentor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setujui" })).toBeDisabled();
  });
});

describe("Lokasi Kantor", () => {
  it("menonaktifkan kantor aktif terakhir memberi peringatan dan menampilkan banner", () => {
    show("Admin", <OfficesPage />, "/lokasi-kantor");
    fireEvent.keyDown(screen.getByRole("button", { name: "Aksi untuk Kantor Pusat Terminal 3" }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Nonaktifkan" }));
    expect(screen.getByText(/Ini kantor aktif terakhir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));
    expect(
      screen.getByText("Belum ada kantor aktif. Intern tidak bisa clock in."),
    ).toBeInTheDocument();
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
    const select = await screen.findByLabelText("Kantor untuk absensi");
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

  it("Clock Out ditolak server karena Daily Report belum dikirim dan membuka dialog laporan", async () => {
    apiState.today = {
      ...apiState.today,
      state: "clocked_in",
      clock_in_at: "08:00",
      daily_report_sent: true,
    };
    apiState.clockOutResult = {
      status: 422,
      body: {
        message: "Daily Report belum dikirim. Isi dulu sebelum clock out.",
        reason: "daily_report_missing",
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
    const select = await screen.findByLabelText("Kantor untuk absensi");
    expect(select).toHaveValue(String(KANTOR_T3.id));
    expect(
      within(select).getByRole("option", { name: "Kantor Pusat Terminal 3" }),
    ).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Kantor Terminal 2" })).toBeInTheDocument();
  });
});

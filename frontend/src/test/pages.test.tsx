import { forwardRef, type ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const { MockProvider } = await import("@/components/internspace/shared/model");
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

const show = (role: Role, page: ReactNode, path = "/") => {
  router.pathname = path;
  return render(
    <MockProvider initialRole={role}>
      <Workspace>{page}</Workspace>
    </MockProvider>,
  );
};

afterEach(() => {
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
      <MockProvider>
        <LoginPage />
      </MockProvider>,
    );
    expect(screen.getByText("Lupa password? Hubungi admin.")).toBeInTheDocument();
    render(
      <MockProvider>
        <ChangePasswordPage />
      </MockProvider>,
    );
    expect(screen.getByText("Simpan Password")).toBeInTheDocument();
  });
});

describe("Alur utama", () => {
  it("Intern: clock in, Daily Report, lalu clock out dengan konfirmasi sebelum jam pulang", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
    show("Intern", <AttendancePage />, "/absensi");
    expect(screen.getByText("Clock in dulu untuk mengisi Daily Report.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clock In/ }));
    expect(screen.getByRole("button", { name: /Memeriksa lokasi/ })).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getAllByText("15:00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Clock Out/ }));
    expect(screen.getByText("Daily Report belum dikirim")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nanti" }));

    fireEvent.click(screen.getByRole("button", { name: "Simpan Laporan" }));
    expect(screen.getByText("Isi apa yang Anda kerjakan hari ini.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Yang saya kerjakan hari ini/), {
      target: { value: "Revisi halaman flight info" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Laporan" }));
    expect(screen.getByText("Revisi halaman flight info")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clock Out/ }));
    expect(screen.getByText("Belum jam pulang (17:00)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tetap Clock Out" }));
    expect(screen.getByRole("button", { name: /Memeriksa lokasi/ })).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Hadir, clock out 15:00")).toBeInTheDocument();
    expect(screen.getByText("Laporan terkunci setelah clock out.")).toBeInTheDocument();
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

describe("Intern dan kantor aktif", () => {
  it("Clock In tidak aktif bila belum ada kantor aktif", () => {
    show(
      "Intern",
      <>
        <OfficesPage />
        <AttendancePage />
      </>,
      "/absensi",
    );
    expect(screen.getByRole("button", { name: /Clock In/ })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Aksi untuk Kantor Pusat Terminal 3" }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Nonaktifkan" }));
    fireEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));
    expect(screen.getByRole("button", { name: /Clock In/ })).toBeDisabled();
    expect(
      screen.getByText("Belum ada kantor aktif. Clock in belum bisa dilakukan. Hubungi admin."),
    ).toBeInTheDocument();
  });
});

describe("Simulasi posisi di kartu Hari Ini", () => {
  it("200 m dari Terminal 3: clock in ditolak", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0));
    show("Intern", <AttendancePage />, "/absensi");
    fireEvent.change(screen.getByLabelText("Simulasi posisi intern"), {
      target: { value: "dekat" },
    });
    expect(screen.getByText("Di luar radius")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clock In/ }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText("Lokasi Anda belum sesuai. Clock in belum bisa dilakukan."),
    ).toBeInTheDocument();
  });
});

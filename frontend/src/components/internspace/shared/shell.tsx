import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileDown,
  FileClock,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MapPin,
  Menu,
  MessageSquare,
  NotebookText,
  Plane,
  Presentation,
  Settings,
  ShieldAlert,
  Star,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { TODAY, formatPeriod, formatShortTime, type Role } from "@/lib/mock-rules";
import { toMockRole, type ApiRole } from "@/lib/api";
import { menuLabel, menuRoute } from "@/lib/navigation";
import type { AppPath } from "@/lib/search";
import { useMenu } from "@/components/internspace/shared/menu-data";
import {
  LOCATION_LABELS,
  initials,
  unreadChats,
  useMock,
  type LocationSim,
  type Scenario,
} from "@/components/internspace/shared/model";
import { ErrorState, LoadingState, NoAccess } from "@/components/internspace/shared/ui";
import { useAuth } from "@/lib/auth";
import icon from "@/assets/icon.png";

type NavItem = { to: AppPath; label: string; icon: LucideIcon; count?: number };

const pageLabels: Record<string, string> = {
  "/": "Dashboard",
  "/absensi": "Presensi",
  "/logbook": "Logbook",
  "/izin": "Izin",
  "/presentasi": "Presentasi Akhir",
  "/catatan": "Catatan",
  "/chat": "Chat",
  "/koreksi": "Koreksi",
  "/penilaian": "Penilaian",
  "/intern-saya": "Intern Saya",
  "/kalender-izin": "Kalender Izin",
  "/performa": "Performa Intern",
  "/users": "Pengguna",
  "/warning": "Warning",
  "/pengumuman": "Pengumuman",
  "/laporan": "Laporan",
  "/pengaturan": "Pengaturan",
  "/lokasi-kantor": "Lokasi & Jadwal",
  "/log": "Log Aktivitas",
  "/profil": "Profil",
};
// Halaman yang boleh dibuka tiap role (progress.md 4.3; design-*.md bagian 2.2). Chat dan profil untuk semua.
const allowed: Record<Role, AppPath[]> = {
  Intern: ["/", "/absensi", "/logbook", "/izin", "/presentasi", "/catatan", "/chat", "/profil"],
  Mentor: [
    "/",
    "/intern-saya",
    "/logbook",
    "/koreksi",
    "/izin",
    "/kalender-izin",
    "/performa",
    "/penilaian",
    "/chat",
    "/profil",
  ],
  Admin: [
    "/",
    "/users",
    "/absensi",
    "/koreksi",
    "/izin",
    "/presentasi",
    "/penilaian",
    "/warning",
    "/pengumuman",
    "/laporan",
    "/pengaturan",
    "/lokasi-kantor",
    "/log",
    "/chat",
    "/profil",
  ],
};

// Cadangan tampilan sidebar bila menu belum dimuat atau gagal: key sesuai
// GET /api/{role}/menu (MenuController backend), tanpa badge.
const fallbackMenuKeys: Record<Role, string[]> = {
  Intern: ["dashboard", "attendance", "logbooks", "leaves", "presentation", "notes"],
  Mentor: [
    "dashboard",
    "interns",
    "logbooks",
    "corrections",
    "leaves",
    "leave_calendar",
    "performance",
    "assessments",
  ],
  Admin: [
    "dashboard",
    "users",
    "attendance",
    "corrections",
    "leaves",
    "presentations",
    "assessments",
    "warnings",
    "announcements",
    "reports",
    "settings",
    "offices",
    "audit_log",
  ],
};

/** Ikon per key menu (label di navigation.ts `MENU_LABELS`). */
const menuIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  attendance: Clock3,
  logbooks: BookOpen,
  leaves: CalendarCheck,
  presentation: Presentation,
  notes: NotebookText,
  interns: UsersRound,
  corrections: FileClock,
  leave_calendar: CalendarDays,
  performance: ChartNoAxesCombined,
  assessments: Star,
  users: Users,
  presentations: Presentation,
  warnings: ShieldAlert,
  announcements: Megaphone,
  reports: FileDown,
  settings: Settings,
  offices: MapPin,
  audit_log: History,
};

export function Workspace({ children }: { children: ReactNode }) {
  const m = useMock();
  const auth = useAuth();
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [dataState, setDataState] = useState<"normal" | "memuat" | "gagal">("normal");

  // Kunci di ganti-password selama akun wajib ganti password (mock atau sesi API).
  const needPasswordChange = m.mustChangePassword || auth.user?.must_change_password === true;
  useEffect(() => {
    if (needPasswordChange) void navigate({ to: "/ganti-password" });
  }, [needPasswordChange, navigate]);

  // Role tampilan dari sesi API, bukan dari simulasi prototipe (progress.md 5.2).
  const apiRole: ApiRole | null = auth.user?.role ?? null;
  const role: Role | null = apiRole ? toMockRole[apiRole] : null;

  // Sidebar dari server (key + badge); label Indonesia dan ikon dari frontend.
  // Selama memuat atau bila gagal, tampilkan daftar statis tanpa badge agar navigasi tetap jalan.
  const menu = useMenu(apiRole);
  const nav: NavItem[] = (() => {
    const badges = new Map((menu.data ?? []).map((item) => [item.key, item.badge]));
    const keys = menu.data ? menu.data.map((item) => item.key) : role ? fallbackMenuKeys[role] : [];
    return keys.flatMap<NavItem>((key) => {
      const to = menuRoute(key);
      const label = apiRole ? menuLabel(apiRole, key) : null;
      const icon = menuIcons[key];
      if (!to || !label || !icon) return [];
      const badge = badges.get(key);
      // Badge 0 disembunyikan, sama dengan `!!item.count` saat render.
      return [{ to, label, icon, ...(badge ? { count: badge } : {}) }];
    });
  })();

  const canOpen = role !== null && allowed[role].includes(path as AppPath);
  const chatUnread = unreadChats(m.chats, m.me.name, m.chatRead);

  // Periode magang di sidebar memakai data API bila ada, cadangan data prototipe.
  const internProfile = auth.user?.intern_profile;
  const programStart = internProfile?.start_date ?? m.me.start;
  const programEnd = internProfile?.end_date ?? m.me.end;
  const programMentor = internProfile?.mentor.name ?? m.me.mentor;
  const progress = (() => {
    if (!programStart || !programEnd) return 0;
    const total = Date.parse(programEnd) - Date.parse(programStart);
    return Math.min(
      100,
      Math.max(0, Math.round(((Date.parse(TODAY) - Date.parse(programStart)) / total) * 100)),
    );
  })();

  return (
    <div className={`workspace role-${(role ?? "guest").toLowerCase()}`}>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <img className="brand-mark" src={icon} alt="Logo InJourney Airports" />
          <div className="brand-word">
            InJourney<span>airports</span>
          </div>
          {mobile && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Tutup menu"
              onClick={() => setMobile(false)}
            >
              <X />
            </Button>
          )}
        </div>
        <div className="product-label">INTERN MANAGEMENT</div>
        <nav aria-label="Menu utama">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-item ${path === item.to ? "active" : ""}`}
              onClick={() => setMobile(false)}
            >
              <item.icon />
              {item.label}
              {!!item.count && (
                <span className="nav-count" aria-label={`${item.count} menunggu`}>
                  {item.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {role === "Intern" && programStart && (
            <div className="program-card">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <Plane size={15} className="text-primary" /> Periode magang
              </div>
              <p>{formatPeriod(programStart, programEnd)}</p>
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>Mentor: {programMentor}</span>
                <span className="text-primary font-semibold">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="Buka menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <div className="breadcrumb">
              <span>{role ?? "Memuat"}</span>
              <ChevronRight size={12} />
              <strong>
                {nav.find((item) => item.to === path)?.label ?? pageLabels[path] ?? "Dashboard"}
              </strong>
            </div>
          </div>
          <div className="topbar-right">
            <SimulationControl dataState={dataState} setDataState={setDataState} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Chat, ${chatUnread} pesan baru`}
              asChild
            >
              <Link to="/chat" className="relative">
                <MessageSquare size={19} />
                {chatUnread > 0 && <span className="icon-count">{chatUnread}</span>}
              </Link>
            </Button>
            <NotificationBell role={role} />
            <DropdownMenu>
              <DropdownMenuTrigger className="profile-summary" aria-label="Menu profil">
                <span className="avatar">{initials(auth.user?.name ?? m.me.name)}</span>
                <span className="profile-name">
                  <strong className="text-[11px]">{auth.user?.name ?? m.me.name}</strong>
                  <small>{role ?? ""}</small>
                </span>
                <ChevronDown size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  {auth.user?.name ?? m.me.name}
                  <small className="block font-normal text-muted-foreground">
                    {auth.user?.email ?? m.me.email}
                  </small>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profil">
                    <UserRound />
                    Profil Saya
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void (async () => {
                      await auth.logout();
                      m.setMustChangePassword(false);
                      await navigate({ to: "/login" });
                    })();
                  }}
                >
                  <LogOut />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="content">
          {!role ? (
            <LoadingState />
          ) : !canOpen ? (
            <NoAccess />
          ) : dataState === "memuat" ? (
            <LoadingState />
          ) : dataState === "gagal" ? (
            <ErrorState onRetry={() => setDataState("normal")} />
          ) : (
            children
          )}
          <footer className="workspace-footer">
            <span>© 2026 InJourney Airports. All rights reserved.</span>
            <span>Intern Management & Attendance System · Prototipe</span>
          </footer>
        </main>
      </div>
      {role === "Intern" && (
        <nav className="bottom-nav" aria-label="Menu bawah">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={path === item.to ? "active" : ""}>
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

function NotificationBell({ role }: { role: Role | null }) {
  const m = useMock();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = role ? m.notices.filter((n) => n.role === role) : [];
  const sorted = [...mine].sort((a, b) => b.at.localeCompare(a.at));
  const unread = sorted.filter((n) => !n.read).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifikasi, ${unread} belum dibaca`}
          className="relative"
        >
          <Bell size={19} />
          {unread > 0 && <span className="icon-count">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="notification-popup">
        <h3>
          Notifikasi
          {unread > 0 && role && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => m.markAllRead(role)}
            >
              Tandai semua dibaca
            </Button>
          )}
        </h3>
        <div className="max-h-[360px] overflow-y-auto">
          {sorted.length === 0 && <p className="empty">Belum ada notifikasi.</p>}
          {sorted.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`notification-item ${n.read ? "" : "unread"}`}
              onClick={() => {
                m.markRead(n.id);
                setOpen(false);
                void navigate({ to: n.to, search: (n.search ?? {}) as never });
              }}
            >
              <strong>{n.text}</strong>
              <small>{formatShortTime(n.at)}</small>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const scenarioLabels: Record<Scenario, string> = {
  kerja: "Hari kerja biasa",
  libur: "Hari ini libur",
  izin: "Intern punya izin disetujui hari ini",
  luar: "Intern di luar periode magang",
};

/** Kontrol khusus prototipe: berganti role dan mencoba kondisi khusus di dokumen desain. */
function SimulationControl({
  dataState,
  setDataState,
}: {
  dataState: "normal" | "memuat" | "gagal";
  setDataState: (s: "normal" | "memuat" | "gagal") => void;
}) {
  const m = useMock();
  const navigate = useNavigate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="sim-trigger">
          <FlaskConical />
          Simulasi<span className="sim-role">· {m.role}</span>
          <ChevronDown size={12} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 grid gap-3 text-xs">
        <div>
          <strong className="text-sm">Simulasi prototipe</strong>
          <p className="text-muted-foreground mt-1">
            Tidak ada di sistem sungguhan. Data hidup selama sesi.
          </p>
        </div>
        <label className="form-field">
          Lihat sebagai role
          <select
            value={m.role}
            onChange={(e) => {
              m.setRole(e.target.value as Role);
              void navigate({ to: "/" });
            }}
          >
            <option>Intern</option>
            <option>Mentor</option>
            <option>Admin</option>
          </select>
        </label>
        <label className="form-field">
          Kondisi hari ini (Sen, 12 Okt 2026)
          <select value={m.scenario} onChange={(e) => m.setScenario(e.target.value as Scenario)}>
            {Object.entries(scenarioLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Posisi intern saat clock in dan clock out
          <select
            value={m.locationSim}
            onChange={(e) => m.setLocationSim(e.target.value as LocationSim)}
          >
            {Object.entries(LOCATION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Kondisi layar
          <select
            value={dataState}
            onChange={(e) => setDataState(e.target.value as typeof dataState)}
          >
            <option value="normal">Normal</option>
            <option value="memuat">Memuat</option>
            <option value="gagal">Gagal dimuat</option>
          </select>
        </label>
      </PopoverContent>
    </Popover>
  );
}

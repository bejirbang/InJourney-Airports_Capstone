import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
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
  ListTodo,
  LogOut,
  Megaphone,
  MapPin,
  Menu,
  MessageSquare,
  Plane,
  Settings,
  ShieldAlert,
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
import {
  TODAY,
  formatPeriod,
  formatShortTime,
  isOverduePending,
  type Role,
} from "@/lib/mock-rules";
import type { AppPath } from "@/lib/search";
import {
  LOCATION_LABELS,
  initials,
  unreadChats,
  useMock,
  type LocationSim,
  type Scenario,
} from "@/components/internspace/shared/model";
import { ErrorState, LoadingState, NoAccess } from "@/components/internspace/shared/ui";

type NavItem = { to: AppPath; label: string; icon: LucideIcon; count?: number };

const pageLabels: Record<string, string> = {
  "/": "Dashboard",
  "/absensi": "Absensi",
  "/task": "Task",
  "/izin": "Izin",
  "/chat": "Chat",
  "/koreksi": "Koreksi",
  "/intern-saya": "Intern Saya",
  "/kalender-izin": "Kalender Izin",
  "/performa": "Performa Intern",
  "/users": "Pengguna",
  "/warning": "Warning",
  "/pengumuman": "Pengumuman",
  "/laporan": "Laporan",
  "/pengaturan": "Pengaturan",
  "/lokasi-kantor": "Lokasi Kantor",
  "/log": "Log Aktivitas",
  "/profil": "Profil",
};
// Halaman yang boleh dibuka tiap role (design-*.md bagian 2.2). Chat dan profil untuk semua.
const allowed: Record<Role, AppPath[]> = {
  Intern: ["/", "/absensi", "/task", "/izin", "/chat", "/profil"],
  Mentor: [
    "/",
    "/intern-saya",
    "/task",
    "/izin",
    "/kalender-izin",
    "/performa",
    "/chat",
    "/profil",
  ],
  Admin: [
    "/",
    "/users",
    "/absensi",
    "/koreksi",
    "/izin",
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

export function Workspace({ children }: { children: ReactNode }) {
  const m = useMock();
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [dataState, setDataState] = useState<"normal" | "memuat" | "gagal">("normal");

  useEffect(() => {
    if (m.mustChangePassword) void navigate({ to: "/ganti-password" });
  }, [m.mustChangePassword, navigate]);

  const myInterns = m.internsOf(m.me.name).map((p) => p.name);
  const nav: NavItem[] =
    m.role === "Intern"
      ? [
          { to: "/", label: "Dashboard", icon: LayoutDashboard },
          { to: "/absensi", label: "Absensi", icon: Clock3 },
          { to: "/task", label: "Task", icon: ListTodo },
          { to: "/izin", label: "Izin", icon: CalendarCheck },
        ]
      : m.role === "Mentor"
        ? [
            { to: "/", label: "Dashboard", icon: LayoutDashboard },
            { to: "/intern-saya", label: "Intern Saya", icon: UsersRound },
            { to: "/task", label: "Task", icon: ListTodo },
            {
              to: "/izin",
              label: "Izin",
              icon: CalendarCheck,
              count: m.leaves.filter((l) => l.status === "Pending" && myInterns.includes(l.intern))
                .length,
            },
            { to: "/kalender-izin", label: "Kalender Izin", icon: CalendarDays },
            { to: "/performa", label: "Performa Intern", icon: ChartNoAxesCombined },
          ]
        : [
            { to: "/", label: "Dashboard", icon: LayoutDashboard },
            { to: "/users", label: "Pengguna", icon: Users },
            { to: "/absensi", label: "Absensi", icon: Clock3 },
            {
              to: "/koreksi",
              label: "Koreksi",
              icon: FileClock,
              count: m.corrections.filter((c) => c.status === "Pending").length,
            },
            {
              to: "/izin",
              label: "Izin",
              icon: CalendarCheck,
              count: m.leaves.filter((l) => isOverduePending(l.status, l.submitted)).length,
            },
            { to: "/warning", label: "Warning", icon: ShieldAlert },
            { to: "/pengumuman", label: "Pengumuman", icon: Megaphone },
            { to: "/laporan", label: "Laporan", icon: FileDown },
            { to: "/pengaturan", label: "Pengaturan", icon: Settings },
            { to: "/lokasi-kantor", label: "Lokasi Kantor", icon: MapPin },
            { to: "/log", label: "Log Aktivitas", icon: History },
          ];
  const canOpen = allowed[m.role].includes(path as AppPath);
  const chatUnread = unreadChats(m.chats, m.me.name, m.chatRead);
  const progress = (() => {
    if (!m.me.start) return 0;
    const total = Date.parse(m.me.end) - Date.parse(m.me.start);
    return Math.min(
      100,
      Math.max(0, Math.round(((Date.parse(TODAY) - Date.parse(m.me.start)) / total) * 100)),
    );
  })();

  return (
    <div className={`workspace role-${m.role.toLowerCase()}`}>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
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
          {m.role === "Intern" && m.me.start && (
            <div className="program-card">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <Plane size={15} className="text-primary" /> Periode magang
              </div>
              <p>{formatPeriod(m.me.start, m.me.end)}</p>
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>Mentor: {m.me.mentor}</span>
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
              <span>{m.role}</span>
              <ChevronRight size={12} />
              <strong>{pageLabels[path] ?? "Dashboard"}</strong>
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
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger className="profile-summary" aria-label="Menu profil">
                <span className="avatar">{initials(m.me.name)}</span>
                <span className="profile-name">
                  <strong className="text-[11px]">{m.me.name}</strong>
                  <small>{m.role}</small>
                </span>
                <ChevronDown size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  {m.me.name}
                  <small className="block font-normal text-muted-foreground">{m.me.email}</small>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profil">
                    <UserRound />
                    Profil Saya
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/login">
                    <LogOut />
                    Keluar
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="content">
          {!canOpen ? (
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
      {m.role === "Intern" && (
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

function NotificationBell() {
  const m = useMock();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = m.notices.filter((n) => n.role === m.role).sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.read).length;
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
          {unread > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => m.markAllRead(m.role)}
            >
              Tandai semua dibaca
            </Button>
          )}
        </h3>
        <div className="max-h-[360px] overflow-y-auto">
          {mine.length === 0 && <p className="empty">Belum ada notifikasi.</p>}
          {mine.map((n) => (
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

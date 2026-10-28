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
import { TODAY, formatPeriod, formatShortTime, initials, type Role } from "@/lib/utils";
import { toDisplayRole, type ApiRole } from "@/lib/api";
import { menuLabel, menuRoute, notificationRoute } from "@/lib/navigation";
import { pageSearch, type AppPath } from "@/lib/search";
import { useMenu } from "@/components/internspace/shared/menu-data";
import { LoadingState, NoAccess } from "@/components/internspace/shared/ui";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/components/internspace/shared/notifications-data";
import { useChatConversations } from "@/components/internspace/shared/chat-data";
import { AnnouncementNotificationDialog } from "@/components/internspace/shared/announcement-dialog";
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
  const auth = useAuth();
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);

  // Kunci di ganti-password selama akun wajib ganti password.
  const needPasswordChange = auth.user?.must_change_password === true;
  useEffect(() => {
    if (needPasswordChange) void navigate({ to: "/ganti-password" });
  }, [needPasswordChange, navigate]);

  // Role tampilan dari sesi API (progress.md 5.2).
  const apiRole: ApiRole | null = auth.user?.role ?? null;
  const role: Role | null = apiRole ? toDisplayRole[apiRole] : null;

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
  const chat = useChatConversations("", apiRole !== null);
  const chatUnread = chat.data?.unread_total ?? 0;

  // Periode magang di sidebar dari `intern_profile` pada sesi API.
  const internProfile = auth.user?.intern_profile;
  const programStart = internProfile?.start_date;
  const programEnd = internProfile?.end_date;
  const programMentor = internProfile?.mentor.name ?? "-";
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
          {role === "Intern" && programStart && programEnd && (
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
            <NotificationBell enabled={apiRole !== null} />
            <DropdownMenu>
              <DropdownMenuTrigger className="profile-summary" aria-label="Menu profil">
                <span className="avatar">{initials(auth.user?.name ?? "Memuat")}</span>
                <span className="profile-name">
                  <strong className="text-[11px]">{auth.user?.name ?? "Memuat"}</strong>
                  <small>{role ?? ""}</small>
                </span>
                <ChevronDown size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  {auth.user?.name ?? "Memuat"}
                  <small className="block font-normal text-muted-foreground">
                    {auth.user?.email ?? ""}
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
          {!role ? <LoadingState /> : !canOpen ? <NoAccess /> : children}
          <footer className="workspace-footer">
            <span>© 2026 InJourney Airports. All rights reserved.</span>
            <span>Intern Management & Attendance System</span>
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
      <AnnouncementNotificationDialog />
    </div>
  );
}

function NotificationBell({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(enabled);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.unreadCount;

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
              disabled={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Tandai semua dibaca
            </Button>
          )}
        </h3>
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.isLoading && <p className="empty">Memuat notifikasi...</p>}
          {notifications.isError && (
            <p className="empty">
              {notifications.error instanceof Error
                ? notifications.error.message
                : "Notifikasi gagal dimuat."}
            </p>
          )}
          {!notifications.isLoading &&
            !notifications.isError &&
            notifications.items.length === 0 && <p className="empty">Belum ada notifikasi.</p>}
          {notifications.items.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`notification-item ${notification.read_at === null ? "unread" : ""}`}
              onClick={() => {
                setOpen(false);
                void (async () => {
                  try {
                    await markRead.mutateAsync(notification.id);
                  } catch {
                    // Tetap buka tujuan walau penandaan baca gagal.
                  }
                  const route = notificationRoute(notification.link_path);
                  const search = pageSearch(notification.link_params ?? {});
                  void navigate({
                    to: (route ?? "/") as AppPath,
                    search: search as never,
                  });
                })();
              }}
            >
              <strong>{notification.text}</strong>
              <small>{formatShortTime(notification.created_at ?? "")}</small>
            </button>
          ))}
          {notifications.hasNextPage && (
            <div className="p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={notifications.isFetchingNextPage}
                onClick={() => void notifications.fetchNextPage()}
              >
                {notifications.isFetchingNextPage ? "Memuat..." : "Muat lebih banyak"}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

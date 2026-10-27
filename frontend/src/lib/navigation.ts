// Peta menu dan notifikasi ke route frontend (progress.md 4.3 dan 4.5).
// Path dari server (/intern/dashboard, dst.) tidak dipakai sebagai alamat;
// yang dipakai hanya `key`, `badge`, `link_path`, dan `link_params`.

/** `key` dari GET /api/{role}/menu → route frontend. */
export const MENU_ROUTES: Record<string, string> = {
  dashboard: "/",
  attendance: "/absensi",
  logbooks: "/logbook",
  leaves: "/izin",
  presentation: "/presentasi",
  notes: "/catatan",
  interns: "/intern-saya",
  corrections: "/koreksi",
  leave_calendar: "/kalender-izin",
  performance: "/performa",
  assessments: "/penilaian",
  users: "/users",
  presentations: "/presentasi",
  warnings: "/warning",
  announcements: "/pengumuman",
  reports: "/laporan",
  settings: "/pengaturan",
  offices: "/lokasi-kantor",
  audit_log: "/log",
};

/** Route untuk `key` menu; null bila key tidak dikenal (menu tidak ditampilkan). */
export function menuRoute(key: string): string | null {
  return MENU_ROUTES[key] ?? null;
}

/** `link_path` notifikasi → route frontend. */
export const NOTIFICATION_ROUTES: Record<string, string> = {
  "/": "/",
  "/presensi": "/absensi",
  "/logbook": "/logbook",
  "/koreksi": "/koreksi",
  "/izin": "/izin",
  "/presentasi": "/presentasi",
  "/penilaian": "/penilaian",
  "/catatan": "/catatan",
  "/intern-saya": "/intern-saya",
  "/chat": "/chat",
};

/** Route untuk `link_path` notifikasi; null bila path tidak dikenal. */
export function notificationRoute(linkPath: string): string | null {
  return NOTIFICATION_ROUTES[linkPath] ?? null;
}

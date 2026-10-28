// Peta menu dan notifikasi ke route frontend (progress.md 4.3 dan 4.5).
// Path dari server (/intern/dashboard, dst.) tidak dipakai sebagai alamat;
// yang dipakai hanya `key`, `badge`, `link_path`, dan `link_params`.
import type { ApiRole } from "@/lib/api";
import type { AppPath } from "@/lib/search";

/** `key` dari GET /api/{role}/menu → route frontend. */
export const MENU_ROUTES: Record<string, AppPath> = {
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
export function menuRoute(key: string): AppPath | null {
  return MENU_ROUTES[key] ?? null;
}

/**
 * Label menu Indonesia per role (progress.md 4.3). Key yang sama bisa berbeda
 * label antar role: `corrections` = "Koreksi Presensi" (mentor) vs "Koreksi" (admin).
 */
export const MENU_LABELS: Record<ApiRole, Record<string, string>> = {
  intern: {
    dashboard: "Dashboard",
    attendance: "Presensi",
    logbooks: "Logbook",
    leaves: "Izin",
    presentation: "Presentasi Akhir",
    notes: "Catatan",
  },
  mentor: {
    dashboard: "Dashboard",
    interns: "Intern Saya",
    logbooks: "Logbook",
    corrections: "Koreksi Presensi",
    leaves: "Izin",
    leave_calendar: "Kalender Izin",
    performance: "Performa Intern",
    assessments: "Input Nilai",
  },
  admin: {
    dashboard: "Dashboard",
    users: "Pengguna",
    attendance: "Presensi",
    corrections: "Koreksi",
    leaves: "Izin",
    presentations: "Presentasi Akhir",
    assessments: "Penilaian",
    warnings: "Warning",
    announcements: "Pengumuman",
    reports: "Laporan",
    settings: "Pengaturan",
    offices: "Lokasi & Jadwal",
    audit_log: "Log Aktivitas",
  },
};

/** Label menu untuk role; null bila key tidak dikenal (menu tidak ditampilkan). */
export function menuLabel(role: ApiRole, key: string): string | null {
  return MENU_LABELS[role]?.[key] ?? null;
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

// Parameter URL bersama untuk tautan langsung (misalnya dari bell icon ke detail Task).
export type PageSearch = { tab?: string; open?: string; to?: string };

export const pageSearch = (search: Record<string, unknown>): PageSearch => {
  const out: PageSearch = {};
  for (const key of ["tab", "open", "to"] as const) {
    const value = search[key];
    if (typeof value === "string" || typeof value === "number") out[key] = String(value);
  }
  return out;
};

export type AppPath =
  | "/"
  | "/absensi"
  | "/task"
  | "/izin"
  | "/chat"
  | "/koreksi"
  | "/intern-saya"
  | "/kalender-izin"
  | "/performa"
  | "/users"
  | "/warning"
  | "/pengumuman"
  | "/laporan"
  | "/pengaturan"
  | "/log"
  | "/profil";

// Parameter URL bersama untuk tautan langsung (misalnya dari lonceng notifikasi ke detail).
// `to` berupa id pengguna, `date` berupa tanggal logbook (YYYY-MM-DD), `status` filter
// riwayat presensi yang sudah dipilih dari rekap dashboard.
export type PageSearch = {
  tab?: string;
  open?: string;
  to?: string;
  date?: string;
  status?: string;
};

export const pageSearch = (search: Record<string, unknown>): PageSearch => {
  const out: PageSearch = {};
  for (const key of ["tab", "open", "to", "date", "status"] as const) {
    const value = search[key];
    if (typeof value === "string" || typeof value === "number") out[key] = String(value);
  }
  return out;
};

export type AppPath =
  | "/"
  | "/absensi"
  | "/logbook"
  | "/izin"
  | "/presentasi"
  | "/catatan"
  | "/chat"
  | "/koreksi"
  | "/penilaian"
  | "/intern-saya"
  | "/kalender-izin"
  | "/performa"
  | "/users"
  | "/warning"
  | "/pengumuman"
  | "/laporan"
  | "/pengaturan"
  | "/lokasi-kantor"
  | "/log"
  | "/profil";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Role tampilan (huruf kapital); role API tetap huruf kecil di `ApiRole`. */
export type Role = "Intern" | "Mentor" | "Admin";

export const leaveTypes = ["Izin Sakit", "Izin Urgent"] as const;
export type LeaveType = (typeof leaveTypes)[number];

// ---- Tanggal dan format tampilan ----
// Tanggal acuan untuk chip/heading. Tanggal data presensi tetap dari respons API.
export const TODAY = "2026-10-12";
const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const dayNamesLong = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const monthNamesLong = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const parseDate = (d: string) => {
  const [y = 1970, m = 1, dd = 1] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};

const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d);

export const formatDate = (d: string) => {
  if (!isIsoDate(d)) return "—";
  const x = parseDate(d);
  return `${dayNames[x.getUTCDay()]}, ${x.getUTCDate()} ${monthNames[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

export const formatDateLong = (d: string) => {
  const x = parseDate(d);
  return `${dayNamesLong[x.getUTCDay()]}, ${x.getUTCDate()} ${monthNames[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

export const formatDateTime = (iso: string) => `${formatDate(iso)} ${iso.slice(11, 16)}`;

/** "12 Okt" atau "12 Okt 2026" */
export const formatShort = (d: string, withYear = false) => {
  if (!isIsoDate(d)) return "—";
  const x = parseDate(d);
  return `${x.getUTCDate()} ${monthNames[x.getUTCMonth()]}${withYear ? ` ${x.getUTCFullYear()}` : ""}`;
};

/** "12 Okt 10:00" */
export const formatShortTime = (iso: string) => `${formatShort(iso)} ${iso.slice(11, 16)}`;

/** "13-14 Okt", "13 Okt", atau "30 Sep - 2 Okt" */
export const formatRange = (start: string, end: string) => {
  if (start === end) return formatShort(start);
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${parseDate(start).getUTCDate()}-${formatShort(end)}`;
  return `${formatShort(start)} - ${formatShort(end)}`;
};

export const formatMonth = (ym: string) => {
  const x = parseDate(`${ym}-01`);
  return `${monthNamesLong[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

export const formatPeriod = (start: string, end: string) =>
  `${formatShort(start)} - ${formatShort(end, true)}`;

export const addDays = (d: string, n: number) => {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export const addMonths = (ym: string, n: number) => {
  const x = parseDate(`${ym}-01`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 7);
};

export const formatPercent = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

// ---- Nama dan avatar ----
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");

/** "Rizky P." */
export const shortName = (name: string) => {
  const [first, second] = name.split(" ");
  return second ? `${first} ${second[0]}.` : (first ?? name);
};

// ---- Validasi form sisi klien (aturan final tetap di server) ----
export const validatePassword = (password: string, confirmation: string, temporary: string) => {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password minimal 8 karakter dan berisi huruf serta angka.";
  if (password === temporary) return "Password baru tidak boleh sama dengan password sementara.";
  if (password !== confirmation) return "Ulangi password baru dengan isian yang sama.";
  return null;
};

// ---- Lokasi kantor (design-admin.md Bagian 9A) ----
/** Batas radius masih usulan (design-admin.md 17.2 no. 3), belum diputuskan. */
export const RADIUS_MIN = 10;
export const RADIUS_MAX = 1000;

export type OfficeInput = {
  name: string;
  lat: number | null;
  lng: number | null;
  radiusIn: string;
  radiusOut: string;
};

const radiusValid = (r: string) =>
  /^\d+$/.test(r.trim()) && Number(r) >= RADIUS_MIN && Number(r) <= RADIUS_MAX;

export const validateOffice = (input: OfficeInput, otherNames: string[]) => {
  if (input.lat === null || input.lng === null) return "Pilih titik kantor di peta.";
  if (!input.name.trim()) return "Nama kantor wajib diisi.";
  if (otherNames.some((n) => n.trim().toLowerCase() === input.name.trim().toLowerCase()))
    return "Nama kantor sudah dipakai kantor lain.";
  if (!radiusValid(input.radiusIn) || !radiusValid(input.radiusOut))
    return `Isi radius antara ${RADIUS_MIN} dan ${RADIUS_MAX} meter.`;
  return null;
};

/** Jarak dua titik dalam meter (haversine). */
export const distanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

export const formatCoord = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

/** Hasil pemeriksaan lokasi saat clock in atau clock out (design-intern.md 5.3 dan 7.2). */
export type LocationResult = "ok" | "di-luar" | "tanpa-kantor" | "ditolak" | "gagal";

export const locationMessage = (result: Exclude<LocationResult, "ok">, kind: "in" | "out") => {
  const act = kind === "in" ? "clock in" : "clock out";
  const Act = kind === "in" ? "Clock in" : "Clock out";
  if (result === "tanpa-kantor")
    return `Belum ada kantor aktif. ${Act} belum bisa dilakukan. Hubungi admin.`;
  if (result === "ditolak") return `Izinkan akses lokasi di browser untuk melakukan ${act}.`;
  if (result === "gagal") return "Lokasi tidak dapat dibaca. Coba lagi.";
  return `Lokasi Anda belum sesuai. ${Act} belum bisa dilakukan.`;
};

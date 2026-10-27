// Label Indonesia untuk nilai dari API (progress.md 4.6). Warna badge mengikuti
// "Aturan Tampilan" di docs/design-*.md, teks diambil dari tabel di progress.md.

/** Status presensi (nilai API, ditampilkan apa adanya dari server). */
export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "Hadir",
  late: "Terlambat",
  missed_clock_in: "Lupa Clock In",
  leave: "Izin",
  absent: "Tidak Hadir",
  holiday: "Libur",
  not_clocked_in: "Belum Clock In",
};

/** Tanda presensi, bukan status: ditampilkan sebagai lencana terpisah. */
export const MISSED_CLOCK_OUT_LABEL = "Lupa Clock Out";
export const CORRECTED_LABEL = "Dikoreksi";

/** Status logbook (termasuk `missing` dari respons harian). */
export const LOGBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Menunggu Review",
  revision: "Revisi",
  approved: "Disetujui",
  missing: "Belum Diisi",
};

/** Status koreksi presensi. */
export const CORRECTION_STATUS_LABEL: Record<string, string> = {
  pending_mentor: "Menunggu Mentor",
  rejected_by_mentor: "Ditolak Mentor",
  pending_admin: "Menunggu Admin",
  approved: "Disetujui",
  rejected_by_admin: "Ditolak Admin",
  cancelled: "Dibatalkan",
};

/** Status pengajuan izin. */
export const LEAVE_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

/** Jenis izin. */
export const LEAVE_TYPE_LABEL: Record<string, string> = {
  sick: "Izin Sakit",
  urgent: "Izin Urgent",
};

/** Status presentasi akhir. */
export const PRESENTATION_STATUS_LABEL: Record<string, string> = {
  not_open: "Belum Dibuka",
  not_submitted: "Belum Dikirim",
  pending: "Menunggu",
  revision: "Revisi",
  approved: "Disetujui",
};

/** Status penilaian. */
export const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  ready: "Siap Dinilai",
  blocked: "Belum Bisa Dinilai",
  draft: "Draft",
  submitted: "Sudah Disubmit",
};

/** Jenis institusi asal intern. */
export const INSTITUTION_TYPE_LABEL: Record<string, string> = {
  universitas: "Universitas",
  sekolah: "Sekolah",
};

/** `day_of_week` standar ISO (1 = Senin ... 7 = Minggu). */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

/** Ambil label dari peta; nilai kosong/tidak dikenal memakai `fallback`. */
export function labelOf(
  labels: Record<string, string>,
  value: string | null | undefined,
  fallback = "-",
): string {
  if (value == null) return fallback;
  return labels[value] ?? fallback;
}

// Aturan PRD yang aman dipakai di browser. Sumber: docs/design-intern.md, design-mentor.md,
// design-admin.md. Komponen memanggil fungsi di sini, bukan menulis aturan sendiri.

export type Role = "Intern" | "Mentor" | "Admin";
export type TaskStatus = "To Do" | "In Progress" | "In Review" | "Done";
export type LeaveStatus = "Pending" | "Disetujui" | "Ditolak" | "Dibatalkan";
export type CorrectionStatus = "Pending" | "Disetujui" | "Ditolak" | "Dibatalkan";
export const leaveTypes = ["Izin Sakit", "Izin Urgent"] as const;
export type LeaveType = (typeof leaveTypes)[number];
export const taskStatuses: TaskStatus[] = ["To Do", "In Progress", "In Review", "Done"];

export const canClockOut = (clockedIn: boolean, reportSent: boolean, clockedOut: boolean) =>
  clockedIn && reportSent && !clockedOut;
export const canEditReport = (clockedOut: boolean) => !clockedOut;
export const canProcessLeave = (role: Role, status: LeaveStatus, hasEvidence: boolean) =>
  status === "Pending" && (role === "Mentor" || (role === "Admin" && hasEvidence));
export const canCancelLeave = (status: LeaveStatus) => status === "Pending";
export const canExport = (role: Role) => role === "Admin";
export const canSeeWarnings = (role: Role) => role === "Admin";
export const reviewTask = (accept: boolean): TaskStatus => (accept ? "Done" : "In Progress");

// ---- Tanggal ----
// Prototipe memakai tanggal tetap agar data contoh konsisten dengan dokumen desain.
export const TODAY = "2026-10-12";
export const NOW = "2026-10-12T14:39";
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
export const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d);
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
export const monthEnd = (ym: string) => addDays(`${addMonths(ym, 1)}-01`, -1);
/** 0 = Senin ... 6 = Minggu */
export const weekdayIndex = (d: string) => (parseDate(d).getUTCDay() + 6) % 7;
export const isWeekend = (d: string) => {
  const w = parseDate(d).getUTCDay();
  return w === 0 || w === 6;
};
export const isWorkingDay = (d: string, holidays: string[]) =>
  !isWeekend(d) && !holidays.includes(d);
export const workingDays = (start: string, end: string, holidays: string[]) => {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (isWorkingDay(d, holidays)) n++;
  return n;
};
export const hoursBetween = (from: string, to: string) =>
  (Date.parse(to + ":00Z") - Date.parse(from + ":00Z")) / 3600000;
export const isOverduePending = (status: string, submitted: string, now = NOW) =>
  status === "Pending" && hoursBetween(submitted, now) > 24;
export const pendingHours = (submitted: string, now = NOW) =>
  Math.max(0, Math.floor(hoursBetween(submitted, now)));

// ---- Kehadiran ----
export type AttendanceStatus =
  "Hadir" | "Izin" | "Tidak Hadir" | "Lupa Clock Out" | "Libur" | "Belum Clock In" | "Berjalan";

/**
 * Status otomatis dengan batas 23:59. Hari yang sudah clock in dikecualikan dari izin
 * dan tetap Hadir. Hari berjalan belum final: "Belum Clock In" atau "Berjalan".
 */
export const attendanceStatus = (
  date: string,
  clockIn: string,
  clockOut: string,
  holidays: string[],
  onLeave: boolean,
  today = TODAY,
): AttendanceStatus => {
  if (!isWorkingDay(date, holidays)) return "Libur";
  if (clockIn) {
    if (clockOut) return "Hadir";
    return date < today ? "Lupa Clock Out" : "Berjalan";
  }
  if (onLeave) return "Izin";
  return date >= today ? "Belum Clock In" : "Tidak Hadir";
};

export type TodayState =
  "Belum Clock In" | "Sudah Clock In" | "Sudah Clock Out" | "Libur" | "Izin" | "Di luar periode";
export const todayState = (o: {
  workday: boolean;
  inPeriod: boolean;
  approvedLeave: boolean;
  clockIn: string;
  clockOut: string;
}): TodayState => {
  if (!o.inPeriod) return "Di luar periode";
  if (!o.workday) return "Libur";
  if (o.clockIn) return o.clockOut ? "Sudah Clock Out" : "Sudah Clock In";
  if (o.approvedLeave) return "Izin";
  return "Belum Clock In";
};

/** Clock out hanya mensyaratkan Daily Report terkirim. Sebelum jam pulang perlu konfirmasi. */
export const clockOutCheck = (reportSent: boolean, nowTime: string, workEnd: string) => {
  if (!reportSent) return "need-report" as const;
  if (nowTime < workEnd) return "confirm-early" as const;
  return "ok" as const;
};
export const validateReport = (work: string) =>
  work.trim() ? null : "Isi apa yang Anda kerjakan hari ini.";

// ---- Task ----
export const taskIsLate = (due: string, status: TaskStatus, submittedAt?: string, now = NOW) => {
  if (status === "Done") return false;
  if (status === "In Review" && submittedAt) return submittedAt > due;
  return now > due;
};
export const lateLabel = (due: string, now = NOW) => {
  const h = hoursBetween(due, now);
  if (h < 24) return `Lewat ${Math.max(1, Math.floor(h))} jam`;
  return `Lewat ${Math.floor(h / 24)} hari`;
};
/** Satu-satunya pengingat tenggat: lewat lebih dari 2 hari kerja tanpa dikumpulkan. */
export const needsOverdueReminder = (
  due: string,
  status: TaskStatus,
  everSubmitted: boolean,
  holidays: string[],
  today = TODAY,
) =>
  !everSubmitted &&
  status !== "Done" &&
  today > due.slice(0, 10) &&
  workingDays(addDays(due.slice(0, 10), 1), today, holidays) > 2;

export type MoveResult =
  | { ok: true; action: "start" | "back" | "submit" | "accept" | "revise" }
  | { ok: false; message: string };

export const internTaskMove = (
  from: TaskStatus,
  to: TaskStatus,
  everSubmitted: boolean,
): MoveResult => {
  if (from === to) return { ok: false, message: "" };
  if (from === "In Review") return { ok: false, message: "Task sedang diperiksa mentor." };
  if (from === "Done") return { ok: false, message: "Task sudah selesai dan terkunci." };
  if (to === "Done")
    return { ok: false, message: "Hanya mentor yang bisa menandai Done lewat Accept." };
  if (from === "To Do" && to === "In Progress") return { ok: true, action: "start" };
  if (from === "To Do" && to === "In Review")
    return { ok: false, message: "Mulai kerjakan Task dulu sebelum mengumpulkan." };
  if (from === "In Progress" && to === "In Review") return { ok: true, action: "submit" };
  if (from === "In Progress" && to === "To Do")
    return everSubmitted
      ? { ok: false, message: "Task yang pernah dikumpulkan tidak bisa kembali ke To Do." }
      : { ok: true, action: "back" };
  return { ok: false, message: "Perpindahan ini tidak diizinkan." };
};

export const mentorTaskMove = (from: TaskStatus, to: TaskStatus): MoveResult => {
  if (from === to) return { ok: false, message: "" };
  if (from === "Done") return { ok: false, message: "Task sudah selesai." };
  if (from !== "In Review") return { ok: false, message: "Status ini diubah oleh intern." };
  if (to === "Done") return { ok: true, action: "accept" };
  if (to === "In Progress") return { ok: true, action: "revise" };
  return { ok: false, message: "Perpindahan ini tidak diizinkan." };
};
export const canDragTask = (role: Role, status: TaskStatus) =>
  role === "Intern" ? status === "To Do" || status === "In Progress" : status === "In Review";

export const internTaskAction = (status: TaskStatus) =>
  status === "To Do"
    ? ("Mulai Kerjakan" as const)
    : status === "In Progress"
      ? ("Kumpulkan Hasil" as const)
      : status === "In Review"
        ? ("Ganti Hasil" as const)
        : null;

export const validateSubmission = (link: string, file: string) => {
  if (!link.trim() && !file) return "Isi link atau pilih file.";
  if (link.trim() && !/^https?:\/\//.test(link.trim())) return "Format link tidak valid.";
  return null;
};
export const canEditTask = (status: TaskStatus) => status !== "Done";
export const canDeleteTask = (status: TaskStatus, commentCount: number) =>
  status === "To Do" && commentCount === 0;
export const canComment = (status: TaskStatus) => status !== "Done";
export const validateComment = (text: string) => (text.trim() ? null : "Tulis komentar dulu.");
export const validateRevise = (text: string) =>
  text.trim() ? null : "Komentar revisi wajib diisi.";

export type TaskInput = { intern: string; title: string; description: string; due: string };
export const validateTask = (input: TaskInput, now = NOW) => {
  if (!input.intern) return "Pilih intern untuk Task ini.";
  if (!input.title.trim()) return "Judul wajib diisi.";
  if (!input.description.trim()) return "Deskripsi wajib diisi.";
  if (!input.due || input.due <= now) return "Tenggat harus setelah waktu sekarang.";
  return null;
};
/** Peringatan saja, Task tetap bisa disimpan. */
export const dueOnHoliday = (due: string, holidays: string[]) =>
  !!due && !isWorkingDay(due.slice(0, 10), holidays);

// ---- Izin ----
export type LeaveInput = { type: string; start: string; end: string; reason: string };
export type LeaveContext = {
  periodStart: string;
  periodEnd: string;
  holidays: string[];
  existing: { start: string; end: string; status: LeaveStatus }[];
};
export const validateLeave = (input: LeaveInput, ctx: LeaveContext) => {
  if (!input.type) return "Pilih jenis izin.";
  if (!input.start || !input.end) return "Isi tanggal mulai dan selesai.";
  if (input.end < input.start) return "Tanggal selesai harus sesudah tanggal mulai.";
  if (input.start < ctx.periodStart || input.end > ctx.periodEnd)
    return "Tanggal di luar periode magang.";
  if (workingDays(input.start, input.end, ctx.holidays) === 0)
    return "Tanggal yang dipilih tidak mengandung hari kerja.";
  const clash = ctx.existing.some(
    (l) =>
      (l.status === "Pending" || l.status === "Disetujui") &&
      l.start <= input.end &&
      l.end >= input.start,
  );
  if (clash) return "Sudah ada izin pada tanggal ini.";
  if (!input.reason.trim()) return "Alasan wajib diisi.";
  return null;
};
export const leaveSubmittedLate = (start: string, submitted: string) =>
  submitted.slice(0, 10) > start;
export const canMentorDecideLeave = (status: LeaveStatus, note: string) =>
  status === "Pending" && note.trim().length > 0;

// ---- Koreksi absensi ----
export type CorrectionInput = { date: string; clockIn: string; clockOut: string; reason: string };
export type CorrectionContext = {
  today: string;
  periodStart: string;
  periodEnd: string;
  holidays: string[];
  pendingDates: string[];
};
export const validateCorrection = (input: CorrectionInput, ctx: CorrectionContext) => {
  if (!input.date) return "Pilih tanggal absensi.";
  if (
    input.date > ctx.today ||
    input.date < ctx.periodStart ||
    input.date > ctx.periodEnd ||
    !isWorkingDay(input.date, ctx.holidays)
  )
    return "Pilih hari kerja yang sudah lewat atau hari ini, dalam periode magang.";
  if (ctx.pendingDates.includes(input.date))
    return "Sudah ada permintaan koreksi untuk tanggal ini.";
  if (input.clockIn && input.clockOut && !timeAfter(input.clockIn, input.clockOut))
    return "Jam clock out harus setelah jam clock in.";
  if (!input.reason.trim()) return "Alasan wajib diisi.";
  return null;
};
export const canCancelCorrection = (status: CorrectionStatus) => status === "Pending";

export const timeAfter = (start: string, end: string) => !!start && !!end && end > start;
export const canDecideCorrection = (
  status: string,
  note: string,
  finalIn: string,
  finalOut: string,
) => status === "Pending" && note.trim().length > 0 && timeAfter(finalIn, finalOut);
export const canApproveLeave = (
  status: string,
  hasEvidence: boolean,
  checked: boolean,
  note: string,
) => status === "Pending" && hasEvidence && checked && note.trim().length > 0;
export const canRejectLeave = (status: string, note: string) =>
  status === "Pending" && note.trim().length > 0;

// ---- Akun ----
export const isAutoInactive = (end: string, today = TODAY) => isIsoDate(end) && today > end;
export const notStarted = (start: string | undefined, today = TODAY) =>
  !!start && isIsoDate(start) && today < start;
export const endsWithin = (end: string, days: number, today = TODAY) =>
  isIsoDate(end) && end >= today && end <= addDays(today, days);
export const canExtend = (currentEnd: string, newEnd: string) =>
  isIsoDate(newEnd) && newEnd > currentEnd;
export type Account = {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mentor: string;
  start?: string;
  end: string;
};
export const deactivateBlock = (
  target: Account,
  actorId: number,
  people: Account[],
): string | null => {
  if (target.id === actorId) return "Anda tidak bisa menonaktifkan akun Anda sendiri.";
  if (
    target.role === "Admin" &&
    !people.some((p) => p.role === "Admin" && p.active && p.id !== target.id)
  )
    return "Harus tersisa minimal satu admin aktif.";
  if (
    target.role === "Mentor" &&
    people.some((p) => p.role === "Intern" && p.active && p.mentor === target.name)
  )
    return "Mentor ini masih memiliki intern aktif. Pindahkan intern ke mentor lain lebih dulu.";
  return null;
};
export type AccountInput = {
  name: string;
  email: string;
  role: Role;
  mentor: string;
  start: string;
  end: string;
};
export const validateAccount = (
  input: AccountInput,
  people: Account[],
  selfId?: number,
): string | null => {
  if (!input.name.trim()) return "Nama wajib diisi.";
  if (!input.email.trim()) return "Email wajib diisi.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "Format email tidak valid.";
  if (
    people.some(
      (p) => p.id !== selfId && p.email.toLowerCase() === input.email.trim().toLowerCase(),
    )
  )
    return "Email sudah terdaftar.";
  if (input.role === "Intern") {
    if (!people.some((p) => p.role === "Mentor" && p.active && p.name === input.mentor))
      return "Pilih mentor untuk intern ini.";
    if (!input.start || !input.end || input.end <= input.start)
      return "Tanggal selesai harus sesudah tanggal mulai.";
  }
  return null;
};
export const validatePassword = (password: string, confirmation: string, temporary: string) => {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password minimal 8 karakter dan berisi huruf serta angka.";
  if (password === temporary) return "Password baru tidak boleh sama dengan password sementara.";
  if (password !== confirmation) return "Ulangi password baru dengan isian yang sama.";
  return null;
};
export const canEditWarning = (author: string, me: string, created: string, now = NOW) =>
  author === me && hoursBetween(created, now) <= 24;
export const audienceValid = (intern: boolean, mentor: boolean) => intern || mentor;
export const announcementVisible = (audience: string, role: Role) =>
  role === "Admin" || audience.includes(role);

// ---- KPI mentor (informasi pemantauan, bukan nilai) ----
export const MIN_KPI_DAYS = 5;
export const ratio = (num: number, den: number) => (den > 0 ? num / den : null);
export const formatPercent = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
/** Hari Izin yang disetujui tidak dihitung sebagai ketidakhadiran. */
export const attendanceRate = (hadir: number, workdays: number, izin: number) =>
  ratio(hadir, workdays - izin);

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
/** Clock in memakai radius clock in, clock out memakai radius clock out, di kantor aktif mana pun. */
export const withinOffice = (
  pos: { lat: number; lng: number },
  offices: { lat: number; lng: number; radiusIn: number; radiusOut: number; active: boolean }[],
  kind: "in" | "out",
) =>
  offices.some(
    (o) => o.active && distanceMeters(pos, o) <= (kind === "in" ? o.radiusIn : o.radiusOut),
  );
export const formatCoord = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

/** Hasil pemeriksaan lokasi saat clock in atau clock out (design-intern.md 5.3 dan 7.2). */
export type LocationResult = "ok" | "di-luar" | "tanpa-kantor" | "ditolak" | "gagal";
export const checkLocation = (
  pos: { lat: number; lng: number },
  offices: { lat: number; lng: number; radiusIn: number; radiusOut: number; active: boolean }[],
  kind: "in" | "out",
): LocationResult => {
  if (!offices.some((o) => o.active)) return "tanpa-kantor";
  return withinOffice(pos, offices, kind) ? "ok" : "di-luar";
};
export const locationMessage = (result: Exclude<LocationResult, "ok">, kind: "in" | "out") => {
  const act = kind === "in" ? "clock in" : "clock out";
  const Act = kind === "in" ? "Clock in" : "Clock out";
  if (result === "tanpa-kantor")
    return `Belum ada kantor aktif. ${Act} belum bisa dilakukan. Hubungi admin.`;
  if (result === "ditolak") return `Izinkan akses lokasi di browser untuk melakukan ${act}.`;
  if (result === "gagal") return "Lokasi tidak dapat dibaca. Coba lagi.";
  return `Lokasi Anda belum sesuai. ${Act} belum bisa dilakukan.`;
};

// ---- Batas file (keputusan Draft 2) ----
export const MAX_FILE_MB = 2;
export const validateFileSize = (bytes: number) =>
  bytes > MAX_FILE_MB * 1024 * 1024 ? `Ukuran file maksimal ${MAX_FILE_MB} MB.` : null;

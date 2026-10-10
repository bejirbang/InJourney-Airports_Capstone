export type Role = 'Intern' | 'Mentor' | 'Admin';
export type TaskStatus = 'To Do' | 'In Progress' | 'In Review' | 'Done';
export type LeaveStatus = 'Pending' | 'Disetujui' | 'Ditolak' | 'Dibatalkan';
export const leaveTypes = ['Izin Sakit', 'Izin Urgent'] as const;
export const canClockOut = (clockedIn: boolean, reportSent: boolean, clockedOut: boolean) => clockedIn && reportSent && !clockedOut;
export const canEditReport = (clockedOut: boolean) => !clockedOut;
export const canProcessLeave = (role: Role, status: LeaveStatus, hasEvidence: boolean) => status === 'Pending' && (role === 'Mentor' || (role === 'Admin' && hasEvidence));
export const canCancelLeave = (status: LeaveStatus) => status === 'Pending';
export const canExport = (role: Role) => role === 'Admin';
export const canSeeWarnings = (role: Role) => role === 'Admin';
export const reviewTask = (accept: boolean): TaskStatus => accept ? 'Done' : 'In Progress';
// ---- Admin rules (prototype) ----
export const TODAY = '2026-10-09';
export const NOW = '2026-10-09T14:39';
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const parseDate = (d: string) => { const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
export const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d);
export const formatDate = (d: string) => { if (!isIsoDate(d)) return '—'; const x = parseDate(d); return `${dayNames[x.getUTCDay()]}, ${x.getUTCDate()} ${monthNames[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
export const formatDateTime = (iso: string) => `${formatDate(iso)} ${iso.slice(11, 16)}`;
export const addDays = (d: string, n: number) => { const x = parseDate(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const isWeekend = (d: string) => { const w = parseDate(d).getUTCDay(); return w === 0 || w === 6; };
export const isWorkingDay = (d: string, holidays: string[]) => !isWeekend(d) && !holidays.includes(d);
export const workingDays = (start: string, end: string, holidays: string[]) => { let n = 0; for (let d = start; d <= end; d = addDays(d, 1)) if (isWorkingDay(d, holidays)) n++; return n; };
export const hoursBetween = (from: string, to: string) => (Date.parse(to + ':00Z') - Date.parse(from + ':00Z')) / 3600000;
export const isOverduePending = (status: string, submitted: string, now = NOW) => status === 'Pending' && hoursBetween(submitted, now) > 24;
export type AttendanceStatus = 'Hadir' | 'Izin' | 'Tidak Hadir' | 'Lupa Clock Out' | 'Libur' | 'Belum Clock In';
export const attendanceStatus = (date: string, clockIn: string, clockOut: string, holidays: string[], onLeave: boolean, today = TODAY): AttendanceStatus => {
  if (!isWorkingDay(date, holidays)) return 'Libur';
  if (onLeave) return 'Izin';
  if (!clockIn) return date >= today ? 'Belum Clock In' : 'Tidak Hadir';
  if (!clockOut && date < today) return 'Lupa Clock Out';
  return 'Hadir';
};
export const timeAfter = (start: string, end: string) => !!start && !!end && end > start;
export const canDecideCorrection = (status: string, note: string, finalIn: string, finalOut: string) => status === 'Pending' && note.trim().length > 0 && timeAfter(finalIn, finalOut);
export const canApproveLeave = (status: string, hasEvidence: boolean, checked: boolean, note: string) => status === 'Pending' && hasEvidence && checked && note.trim().length > 0;
export const canRejectLeave = (status: string, note: string) => status === 'Pending' && note.trim().length > 0;
export const isAutoInactive = (end: string, today = TODAY) => isIsoDate(end) && today > end;
export const endsWithin = (end: string, days: number, today = TODAY) => isIsoDate(end) && end >= today && end <= addDays(today, days);
export const canExtend = (currentEnd: string, newEnd: string) => isIsoDate(newEnd) && newEnd > currentEnd;
export type Account = { id: number; name: string; email: string; role: Role; active: boolean; mentor: string; start?: string; end: string };
export const deactivateBlock = (target: Account, actorId: number, people: Account[]): string | null => {
  if (target.id === actorId) return 'Anda tidak bisa menonaktifkan akun Anda sendiri.';
  if (target.role === 'Admin' && !people.some(p => p.role === 'Admin' && p.active && p.id !== target.id)) return 'Harus tersisa minimal satu admin aktif.';
  if (target.role === 'Mentor' && people.some(p => p.role === 'Intern' && p.active && p.mentor === target.name)) return 'Mentor ini masih memiliki intern aktif. Pindahkan intern ke mentor lain lebih dulu.';
  return null;
};
export type AccountInput = { name: string; email: string; role: Role; mentor: string; start: string; end: string };
export const validateAccount = (input: AccountInput, people: Account[], selfId?: number): string | null => {
  if (!input.name.trim()) return 'Nama wajib diisi.';
  if (!input.email.trim()) return 'Email wajib diisi.';
  if (people.some(p => p.id !== selfId && p.email.toLowerCase() === input.email.trim().toLowerCase())) return 'Email sudah terdaftar.';
  if (input.role === 'Intern') {
    if (!people.some(p => p.role === 'Mentor' && p.active && p.name === input.mentor)) return 'Pilih mentor untuk intern ini.';
    if (!input.start || !input.end || input.end <= input.start) return 'Tanggal selesai harus sesudah tanggal mulai.';
  }
  return null;
};
export const canEditWarning = (author: string, me: string, created: string, now = NOW) => author === me && hoursBetween(created, now) <= 24;
export const audienceValid = (intern: boolean, mentor: boolean) => intern || mentor;
export const announcementVisible = (audience: string, role: Role) => role === 'Admin' || audience.includes(role);

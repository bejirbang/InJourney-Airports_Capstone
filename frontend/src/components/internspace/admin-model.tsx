import { createContext, useContext, useState, type ReactNode } from 'react';
import { useMock, type Person } from './model';
import { TODAY, NOW, addDays, isWeekend, attendanceStatus, isAutoInactive, type AttendanceStatus, type LeaveStatus, type Role } from '@/lib/mock-rules';

export const ADMIN_NAME = 'Ayu Wulandari';
export const ADMIN_ID = 4;
export type AttRec = { intern: string; date: string; clockIn: string; clockOut: string; corrected?: boolean };
export type Correction = { id: number; intern: string; date: string; reqIn: string; reqOut: string; reason: string; status: 'Pending' | 'Disetujui' | 'Ditolak'; submitted: string; by?: string; note?: string; finalIn?: string; finalOut?: string; mockIndex?: number };
export type AdminLeave = { id: number; intern: string; type: string; start: string; end: string; reason: string; evidence: string; status: LeaveStatus; submitted: string; by?: string; byRole?: Role; note?: string; mockId?: number };
export type Holiday = { date: string; name: string };
export type Warn = { id: number; intern: string; text: string; author: string; created: string };
export type LogEntry = { time: string; admin: string; action: string; object: string; detail: string };
export type ChatMsg = { mine: boolean; text: string };
export type Row = { intern: string; date: string; clockIn: string; clockOut: string; status: AttendanceStatus; corrected: boolean };

const seedAtt: AttRec[] = (() => {
  const out: AttRec[] = [];
  const interns = ['Nabila Putri', 'Rizky Pratama', 'Sekar Ayuningtyas', 'Dimas Arya', 'Fajar Nugroho'];
  for (let d = '2026-10-01'; d <= TODAY; d = addDays(d, 1)) {
    if (isWeekend(d)) continue;
    interns.forEach((intern, i) => {
      if (intern === 'Dimas Arya' && d > '2026-10-08') return;
      if (intern === 'Rizky Pratama' && d === '2026-10-08') return; // absent
      if (intern === 'Sekar Ayuningtyas' && d === TODAY) return; // not yet clocked in
      if (intern === 'Nabila Putri' && d === '2026-10-05') return; // sick leave
      const inT = `0${7 + (i % 2)}:${String(50 + i * 2).slice(-2)}`.replace('07:5', '07:5');
      let clockOut = d === TODAY ? '' : `17:0${i}`;
      if ((intern === 'Nabila Putri' && d === '2026-10-07') || (intern === 'Sekar Ayuningtyas' && d === '2026-10-06') || (intern === 'Fajar Nugroho' && d === '2026-10-08')) clockOut = '';
      out.push({ intern, date: d, clockIn: i % 2 ? `08:0${i}` : inT.startsWith('07') ? inT : '07:55', clockOut, corrected: intern === 'Rizky Pratama' && d === '2026-10-02' });
    });
  }
  return out;
})();

const seedLeaves: AdminLeave[] = [
  { id: 1, intern: 'Sekar Ayuningtyas', type: 'Izin Sakit', start: '2026-10-08', end: '2026-10-09', reason: 'Demam tinggi, disarankan istirahat dua hari oleh dokter.', evidence: 'surat-dokter-sekar.pdf', status: 'Pending', submitted: '2026-10-07T10:00' },
  { id: 2, intern: 'Fajar Nugroho', type: 'Izin Urgent', start: '2026-10-12', end: '2026-10-13', reason: 'Mengurus dokumen keluarga di kampung halaman.', evidence: '', status: 'Pending', submitted: '2026-10-08T08:00' },
  { id: 3, intern: 'Rizky Pratama', type: 'Izin Urgent', start: '2026-10-01', end: '2026-10-01', reason: 'Keperluan administrasi kampus.', evidence: 'surat-kampus.pdf', status: 'Ditolak', submitted: '2026-09-29T09:00', by: 'Budi Santoso', byRole: 'Mentor', note: 'Mohon jadwalkan ulang di luar jam kerja.' },
  { id: 4, intern: 'Rizky Pratama', type: 'Izin Sakit', start: '2026-10-20', end: '2026-10-20', reason: 'Jadwal kontrol kesehatan.', evidence: '', status: 'Dibatalkan', submitted: '2026-10-06T11:00' },
];
const seedCorrections: Correction[] = [
  { id: 1, intern: 'Sekar Ayuningtyas', date: '2026-10-06', reqIn: '08:10', reqOut: '17:05', reason: 'Lupa clock out karena langsung mengikuti rapat di luar kantor.', status: 'Pending', submitted: '2026-10-07T09:15' },
  { id: 2, intern: 'Rizky Pratama', date: '2026-10-02', reqIn: '08:01', reqOut: '17:00', reason: 'Clock in tercatat terlambat karena aplikasi gangguan.', status: 'Disetujui', submitted: '2026-10-02T18:00', by: 'Rina Hartono', note: 'Sesuai konfirmasi satpam terminal.', finalIn: '08:01', finalOut: '17:00' },
];

type AdminModel = {
  att: AttRec[]; setAtt: React.Dispatch<React.SetStateAction<AttRec[]>>;
  ownLeaves: AdminLeave[]; setOwnLeaves: React.Dispatch<React.SetStateAction<AdminLeave[]>>; leaves: AdminLeave[];
  ownCorrections: Correction[]; setOwnCorrections: React.Dispatch<React.SetStateAction<Correction[]>>; corrections: Correction[];
  holidays: Holiday[]; setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>; holidayDates: string[];
  workHours: { start: string; end: string; from: string }; setWorkHours: (w: { start: string; end: string; from: string }) => void;
  warnings: Warn[]; setWarnings: React.Dispatch<React.SetStateAction<Warn[]>>;
  logs: LogEntry[]; log: (action: string, object: string, detail: string) => void;
  notices: { intern: string; text: string }[]; notify: (intern: string, text: string) => void;
  chats: Record<string, ChatMsg[]>; setChats: React.Dispatch<React.SetStateAction<Record<string, ChatMsg[]>>>;
  draft: { to: string; text: string } | null; setDraft: (d: { to: string; text: string } | null) => void;
  interns: Person[]; activeInterns: Person[]; mentorsActive: Person[];
  isActive: (p: Person) => boolean; rowsFor: (intern: string, from?: string, to?: string) => Row[];
};
const Ctx = createContext<AdminModel | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const m = useMock();
  const [att, setAtt] = useState(seedAtt);
  const [ownLeaves, setOwnLeaves] = useState(seedLeaves);
  const [ownCorrections, setOwnCorrections] = useState(seedCorrections);
  const [holidays, setHolidays] = useState<Holiday[]>([{ date: '2026-10-28', name: 'Libur perusahaan (contoh)' }, { date: '2026-12-25', name: 'Hari Raya Natal' }]);
  const [workHours, setWorkHours] = useState({ start: '08:00', end: '17:00', from: '2026-08-01' });
  const [warnings, setWarnings] = useState<Warn[]>([{ id: 1, intern: 'Nabila Putri', text: 'Pengingat kelengkapan Daily Report pada 2 Oktober 2026.', author: ADMIN_NAME, created: '2026-10-02T16:00' }, { id: 2, intern: 'Rizky Pratama', text: 'Tidak hadir tanpa keterangan pada 8 Oktober 2026. Sudah dikonfirmasi lewat chat.', author: ADMIN_NAME, created: '2026-10-09T09:10' }]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: '2026-10-09T08:30', admin: ADMIN_NAME, action: 'Kalender', object: 'Kalender kerja', detail: 'Menambahkan libur 28 Okt 2026.' },
    { time: '2026-10-09T08:15', admin: ADMIN_NAME, action: 'Akun', object: 'Rizky Pratama', detail: 'Mengubah data akun.' },
    { time: '2026-10-02T18:20', admin: 'Rina Hartono', action: 'Koreksi', object: 'Rizky Pratama', detail: 'Menyetujui koreksi 2 Okt 2026.' },
  ]);
  const [notices, setNotices] = useState<{ intern: string; text: string }[]>([]);
  const [chats, setChats] = useState<Record<string, ChatMsg[]>>({ 'Budi Santoso': [{ mine: false, text: 'Bu Ayu, laporan absensi tim saya bulan ini sudah bisa diunduh?' }, { mine: true, text: 'Sudah, Pak. Saya kirimkan sore ini.' }] });
  const [draft, setDraft] = useState<{ to: string; text: string } | null>(null);
  const holidayDates = holidays.map(h => h.date);
  const nabilaLeaves: AdminLeave[] = m.leaves.map(l => ({ id: 1000 + l.id, mockId: l.id, intern: 'Nabila Putri', type: l.type, start: l.start, end: l.end, reason: l.reason, evidence: l.evidence, status: l.status, submitted: l.submitted || NOW, note: l.note, by: l.by, byRole: l.by === 'Budi Santoso' ? 'Mentor' : l.by ? 'Admin' : undefined }));
  const leaves = [...ownLeaves, ...nabilaLeaves];
  const nabilaCorrections: Correction[] = m.corrections.map((c, i) => ({ id: 1000 + i, mockIndex: i, intern: 'Nabila Putri', date: c.date, reqIn: c.reqIn || '', reqOut: c.reqOut || '', reason: c.reason, status: c.status as Correction['status'], submitted: c.submitted || NOW, by: c.by, note: c.note }));
  const corrections = [...ownCorrections, ...nabilaCorrections];
  const isActive = (p: Person) => p.active && !(p.role === 'Intern' && isAutoInactive(p.end));
  const interns = m.people.filter(p => p.role === 'Intern');
  const activeInterns = interns.filter(isActive);
  const mentorsActive = m.people.filter(p => p.role === 'Mentor' && p.active);
  const rowsFor = (intern: string, from = '2026-10-01', to = TODAY): Row[] => {
    const person = m.people.find(p => p.name === intern); const rows: Row[] = [];
    const last = person && /^\d/.test(person.end) && person.end < to ? person.end : to;
    for (let d = from; d <= last; d = addDays(d, 1)) {
      if (isWeekend(d) || (person?.start && d < person.start)) continue;
      let rec = att.find(r => r.intern === intern && r.date === d);
      if (intern === 'Nabila Putri' && d === TODAY) rec = { intern, date: d, clockIn: m.clockIn, clockOut: m.clockOut };
      const onLeave = leaves.some(l => l.intern === intern && l.status === 'Disetujui' && l.start <= d && l.end >= d);
      rows.push({ intern, date: d, clockIn: rec?.clockIn || '', clockOut: rec?.clockOut || '', status: attendanceStatus(d, rec?.clockIn || '', rec?.clockOut || '', holidayDates, onLeave), corrected: !!rec?.corrected });
    }
    return rows;
  };
  const log = (action: string, object: string, detail: string) => { const t = new Date(); const hh = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; setLogs(old => [{ time: `${TODAY}T${hh}`, admin: ADMIN_NAME, action, object, detail }, ...old]); };
  const notify = (intern: string, text: string) => setNotices(old => [{ intern, text }, ...old]);
  return <Ctx.Provider value={{ att, setAtt, ownLeaves, setOwnLeaves, leaves, ownCorrections, setOwnCorrections, corrections, holidays, setHolidays, holidayDates, workHours, setWorkHours, warnings, setWarnings, logs, log, notices, notify, chats, setChats, draft, setDraft, interns, activeInterns, mentorsActive, isActive, rowsFor }}>{children}</Ctx.Provider>;
}
export function useAdmin() { const c = useContext(Ctx); if (!c) throw new Error('AdminProvider is required'); return c; }

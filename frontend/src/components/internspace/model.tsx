import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Role, TaskStatus, LeaveStatus } from '@/lib/mock-rules';

export type Task = { id: string; title: string; category: string; due: string; status: TaskStatus; description: string; comment?: string; link?: string; file?: string };
export type Leave = { id: number; type: string; start: string; end: string; reason: string; status: LeaveStatus; evidence: string; note?: string };
const initialTasks: Task[] = [
  { id: 'TSK-024', title: 'Redesign halaman informasi penerbangan', category: 'UI/UX Design', due: '12 Okt 2026', status: 'In Progress', description: 'Buat rancangan halaman informasi penerbangan yang memudahkan penumpang menemukan jadwal dan status penerbangan. Sertakan versi desktop dan mobile.' },
  { id: 'TSK-023', title: 'Dokumentasi alur sistem check-in', category: 'Dokumentasi', due: '13 Okt 2026', status: 'To Do', description: 'Dokumentasikan alur check-in penumpang dari awal hingga boarding, termasuk titik layanan dan kebutuhan sistem.' },
  { id: 'TSK-021', title: 'Riset pengalaman pengguna airport app', category: 'Research', due: '9 Okt 2026', status: 'In Review', description: 'Kumpulkan hasil riset kebutuhan pengguna aplikasi bandara dan rangkum temuan utama.', comment: 'Terima kasih, Nabila. Tolong tambahkan insight dari pengguna first-time flyer, ya.', link: 'https://figma.com' },
  { id: 'TSK-020', title: 'Audit komponen design system', category: 'UI/UX Design', due: '8 Okt 2026', status: 'Done', description: 'Lakukan audit konsistensi komponen pada design system.' },
];
type Person = { id: number; name: string; email: string; role: Role; active: boolean; mentor: string; end: string };
type Model = { role: Role; setRole: (r: Role) => void; clockIn: string; setClockIn: (s: string) => void; clockOut: string; setClockOut: (s: string) => void; report: string; setReport: (s: string) => void; reportSent: boolean; setReportSent: (b: boolean) => void; tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; leaves: Leave[]; setLeaves: React.Dispatch<React.SetStateAction<Leave[]>>; people: Person[]; setPeople: React.Dispatch<React.SetStateAction<Person[]>>; announcements: { title: string; text: string; audience: string }[]; setAnnouncements: React.Dispatch<React.SetStateAction<{ title: string; text: string; audience: string }[]>>; warnings: string[]; setWarnings: React.Dispatch<React.SetStateAction<string[]>>; corrections: { date: string; reason: string; status: string }[]; setCorrections: React.Dispatch<React.SetStateAction<{ date: string; reason: string; status: string }[]>>; logs: string[]; log: (text: string) => void; profile: string; setProfile: (s: string) => void };
const Context = createContext<Model | null>(null);
export function MockProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('Intern');
  const [clockIn, setClockIn] = useState('08:02');
  const [clockOut, setClockOut] = useState('');
  const [report, setReport] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [leaves, setLeaves] = useState<Leave[]>([{ id: 1, type: 'Izin Sakit', start: '2026-10-05', end: '2026-10-05', reason: 'Istirahat sesuai anjuran dokter.', status: 'Disetujui', evidence: 'Surat-dokter.pdf', note: 'Semoga lekas pulih.' }, { id: 2, type: 'Izin Urgent', start: '2026-10-14', end: '2026-10-14', reason: 'Keperluan keluarga yang mendesak.', status: 'Pending', evidence: '' }]);
  const [people, setPeople] = useState<Person[]>([{ id: 1, name: 'Nabila Putri', email: 'nabila.putri@example.com', role: 'Intern', active: true, mentor: 'Budi Santoso', end: '2026-12-31' }, { id: 2, name: 'Rizky Pratama', email: 'rizky.pratama@example.com', role: 'Intern', active: true, mentor: 'Budi Santoso', end: '2026-10-16' }, { id: 3, name: 'Budi Santoso', email: 'budi.santoso@example.com', role: 'Mentor', active: true, mentor: '—', end: '—' }, { id: 4, name: 'Ayu Wulandari', email: 'ayu.wulandari@example.com', role: 'Admin', active: true, mentor: '—', end: '—' }]);
  const [announcements, setAnnouncements] = useState([{ title: 'Town Hall Intern — Oktober 2026', text: 'Mari bertemu dan berbagi pengalaman bersama seluruh peserta magang.', audience: 'Intern & Mentor' }, { title: 'Pembaruan panduan Daily Report', text: 'Panduan penulisan laporan harian telah diperbarui oleh tim Human Capital.', audience: 'Intern' }]);
  const [warnings, setWarnings] = useState<string[]>(['Nabila Putri — Pengingat kelengkapan laporan pada 2 Oktober 2026.']);
  const [corrections, setCorrections] = useState([{ date: '2026-10-07', reason: 'Clock out tidak tercatat saat jaringan terputus.', status: 'Pending' }]);
  const [logs, setLogs] = useState(['08:30 • Ayu Wulandari memperbarui kalender kerja.', '08:15 • Ayu Wulandari menambahkan akun Rizky Pratama.']);
  const [profile, setProfile] = useState('Nabila Putri');
  const log = (text: string) => setLogs(old => [`14:39 • ${text}`, ...old]);
  return <Context.Provider value={{ role, setRole, clockIn, setClockIn, clockOut, setClockOut, report, setReport, reportSent, setReportSent, tasks, setTasks, leaves, setLeaves, people, setPeople, announcements, setAnnouncements, warnings, setWarnings, corrections, setCorrections, logs, log, profile, setProfile }}>{children}</Context.Provider>;
}
export function useMock() { const context = useContext(Context); if (!context) throw new Error('MockProvider is required'); return context; }
export const roleName = (role: Role, profile: string) => role === 'Intern' ? profile : role === 'Mentor' ? 'Budi Santoso' : 'Ayu Wulandari';
export const initials = (name: string) => name.split(' ').slice(0, 2).map(s => s[0]).join('');
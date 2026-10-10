import { createContext, useContext, useState, type ReactNode } from "react";
import {
  TODAY,
  NOW,
  addDays,
  attendanceStatus,
  isAutoInactive,
  isWorkingDay,
  notStarted,
  todayState,
  type Account,
  type AttendanceStatus,
  type CorrectionStatus,
  type LeaveStatus,
  type LeaveType,
  type Role,
  type TaskStatus,
} from "@/lib/mock-rules";
import type { AppPath, PageSearch } from "@/lib/search";

export type Person = Account & { phone?: string; title: string; formerMentors?: string[] };
export type Report = { work: string; notes: string; sentAt: string };
export type AttRec = {
  intern: string;
  date: string;
  clockIn: string;
  clockOut: string;
  corrected?: boolean;
  report?: Report;
};
export type Comment = {
  id: number;
  author: string;
  role: Role;
  text: string;
  at: string;
  revise?: boolean;
};
export type Task = {
  id: string;
  title: string;
  description: string;
  intern: string;
  mentor: string;
  due: string;
  status: TaskStatus;
  createdAt: string;
  everSubmitted: boolean;
  submittedAt?: string;
  link?: string;
  file?: string;
  doneAt?: string;
  revisions: number;
  revisePending?: boolean;
  comments: Comment[];
  unread: { Intern: number; Mentor: number };
};
export type Leave = {
  id: number;
  intern: string;
  type: LeaveType;
  start: string;
  end: string;
  reason: string;
  evidence: string;
  status: LeaveStatus;
  submitted: string;
  by?: string;
  byRole?: Role;
  note?: string;
  decidedAt?: string;
};
export type Correction = {
  id: number;
  intern: string;
  date: string;
  recIn: string;
  recOut: string;
  reqIn: string;
  reqOut: string;
  reason: string;
  evidence: string;
  status: CorrectionStatus;
  submitted: string;
  by?: string;
  note?: string;
  finalIn?: string;
  finalOut?: string;
};
export type Holiday = { date: string; name: string };
export type WorkHours = { start: string; end: string; from: string };
export type Warn = { id: number; intern: string; text: string; author: string; created: string };
export type Announcement = {
  id: number;
  title: string;
  text: string;
  audience: string;
  date: string;
  author: string;
};
export type LogEntry = {
  time: string;
  admin: string;
  action: string;
  object: string;
  detail: string;
};
export type Notice = {
  id: number;
  role: Role;
  text: string;
  at: string;
  to: AppPath;
  search?: PageSearch;
  read: boolean;
};
export type ChatMsg = { id: number; from: string; to: string; text: string; at: string };
export type Scenario = "kerja" | "libur" | "izin" | "luar";
export type LocationSim = "sesuai" | "tidak-sesuai" | "ditolak" | "gagal";
export type Row = {
  intern: string;
  date: string;
  clockIn: string;
  clockOut: string;
  status: AttendanceStatus;
  corrected: boolean;
  report?: Report;
  holiday?: string;
};

/** Pengguna yang sedang "login" untuk tiap role pada prototipe. */
export const ME: Record<Role, string> = {
  Intern: "Nabila Putri",
  Mentor: "Budi Santoso",
  Admin: "Ayu Wulandari",
};
export const TEMP_PASSWORD = "sementara";
export const DEMO_PASSWORD = "magang123";

const seedPeople: Person[] = [
  {
    id: 1,
    name: "Nabila Putri",
    email: "nabila.putri@example.com",
    role: "Intern",
    active: true,
    mentor: "Budi Santoso",
    start: "2026-09-01",
    end: "2026-12-31",
    phone: "0812-1100-2201",
    title: "UI/UX Design Intern",
  },
  {
    id: 2,
    name: "Rizky Pratama",
    email: "rizky.pratama@example.com",
    role: "Intern",
    active: true,
    mentor: "Budi Santoso",
    start: "2026-07-16",
    end: "2026-10-16",
    title: "Backend Developer Intern",
  },
  {
    id: 3,
    name: "Sekar Ayuningtyas",
    email: "sekar.ayu@example.com",
    role: "Intern",
    active: true,
    mentor: "Budi Santoso",
    start: "2026-09-01",
    end: "2027-01-29",
    title: "System Analyst Intern",
  },
  {
    id: 4,
    name: "Fajar Nugroho",
    email: "fajar.nugroho@example.com",
    role: "Intern",
    active: true,
    mentor: "Budi Santoso",
    start: "2026-08-03",
    end: "2026-12-18",
    title: "QA Engineer Intern",
  },
  {
    id: 5,
    name: "Dimas Arya",
    email: "dimas.arya@example.com",
    role: "Intern",
    active: true,
    mentor: "Budi Santoso",
    start: "2026-07-01",
    end: "2026-10-09",
    title: "Data Analyst Intern",
  },
  {
    id: 6,
    name: "Galih Saputra",
    email: "galih.saputra@example.com",
    role: "Intern",
    active: true,
    mentor: "Sari Lestari",
    start: "2026-08-17",
    end: "2026-12-31",
    title: "Operations Intern",
    formerMentors: ["Budi Santoso"],
  },
  {
    id: 7,
    name: "Putri Maharani",
    email: "putri.maharani@example.com",
    role: "Intern",
    active: true,
    mentor: "Sari Lestari",
    start: "2026-09-14",
    end: "2027-01-15",
    title: "Customer Experience Intern",
  },
  {
    id: 8,
    name: "Hana Kusuma",
    email: "hana.kusuma@example.com",
    role: "Intern",
    active: true,
    mentor: "Sari Lestari",
    start: "2026-11-02",
    end: "2027-02-26",
    title: "Marketing Intern",
  },
  {
    id: 10,
    name: "Budi Santoso",
    email: "budi.santoso@example.com",
    role: "Mentor",
    active: true,
    mentor: "—",
    end: "—",
    phone: "0813-2200-1102",
    title: "Digital Experience Mentor",
  },
  {
    id: 11,
    name: "Sari Lestari",
    email: "sari.lestari@example.com",
    role: "Mentor",
    active: true,
    mentor: "—",
    end: "—",
    title: "Airport Operations Mentor",
  },
  {
    id: 12,
    name: "Arif Wibowo",
    email: "arif.wibowo@example.com",
    role: "Mentor",
    active: true,
    mentor: "—",
    end: "—",
    title: "Commercial Mentor",
  },
  {
    id: 20,
    name: "Ayu Wulandari",
    email: "ayu.wulandari@example.com",
    role: "Admin",
    active: true,
    mentor: "—",
    end: "—",
    phone: "0811-3300-4403",
    title: "PIC Magang · Human Capital",
  },
  {
    id: 21,
    name: "Rina Hartono",
    email: "rina.hartono@example.com",
    role: "Admin",
    active: true,
    mentor: "—",
    end: "—",
    title: "PIC Magang · Human Capital",
  },
];

const reportPool = [
  "Melanjutkan rancangan halaman informasi penerbangan versi mobile.",
  "Rapat koordinasi dengan tim Digital Experience dan merevisi kebutuhan fitur.",
  "Menyusun dokumentasi alur check-in dan meninjau masukan mentor.",
  "Menguji endpoint login dan mencatat hasil pengujian.",
  "Merapikan komponen design system dan memperbarui dokumentasinya.",
  "Observasi layanan di area keberangkatan bersama tim operasional.",
];

type Override = { in?: string; out?: string; corrected?: boolean; noReport?: boolean } | null;
// null = tidak ada clock in pada hari itu.
const overrides: Record<string, Record<string, Override>> = {
  "Nabila Putri": {
    "2026-09-21": null,
    "2026-09-25": { in: "08:31", out: "17:00" },
    "2026-10-05": null,
    "2026-10-06": { in: "08:00", out: "" },
    "2026-10-07": null,
    "2026-10-08": { in: "08:10", out: "17:05" },
    "2026-10-09": { in: "08:02", out: "17:00", corrected: true },
    [TODAY]: null,
  },
  "Rizky Pratama": { "2026-10-08": null, [TODAY]: { in: "07:58", out: "" } },
  "Sekar Ayuningtyas": { "2026-10-06": { in: "08:10", out: "" }, [TODAY]: null },
  "Fajar Nugroho": {
    "2026-10-08": { in: "08:05", out: "", noReport: true },
    [TODAY]: { in: "08:12", out: "" },
  },
  "Galih Saputra": { [TODAY]: { in: "07:50", out: "" } },
  "Putri Maharani": { "2026-10-09": null, [TODAY]: null },
};

function seedAttendance(people: Person[]): AttRec[] {
  const out: AttRec[] = [];
  people
    .filter((p) => p.role === "Intern" && p.start)
    .forEach((p, i) => {
      const last = p.end < TODAY ? p.end : TODAY;
      let n = 0;
      for (let d = p.start ?? TODAY; d <= last; d = addDays(d, 1)) {
        if (!isWorkingDay(d, ["2026-08-17"])) continue;
        n++;
        const special = overrides[p.name]?.[d];
        if (special === null) continue;
        if (d === TODAY && special === undefined) continue;
        const minute = String((n * 7 + i * 3) % 14).padStart(2, "0");
        const clockIn =
          special?.in ??
          (n % 3 ? `07:${String(46 + ((n + i) % 13)).padStart(2, "0")}` : `08:${minute}`);
        const clockOut = special?.out ?? `17:${String((n + i) % 10).padStart(2, "0")}`;
        const rec: AttRec = { intern: p.name, date: d, clockIn, clockOut };
        if (special?.corrected) rec.corrected = true;
        if (!special?.noReport && d !== TODAY)
          rec.report = {
            work: reportPool[(n + i) % reportPool.length] ?? "",
            notes: n % 4 ? "" : "Akses ke server uji sempat lambat.",
            sentAt: `${d}T16:${String(30 + (n % 20)).padStart(2, "0")}`,
          };
        out.push(rec);
      }
    });
  return out;
}

const c = (
  id: number,
  author: string,
  role: Role,
  text: string,
  at: string,
  revise = false,
): Comment => (revise ? { id, author, role, text, at, revise } : { id, author, role, text, at });

const seedTasks: Task[] = [
  {
    id: "TSK-024",
    title: "Redesign halaman informasi penerbangan",
    intern: "Nabila Putri",
    mentor: "Budi Santoso",
    description:
      "Buat rancangan halaman informasi penerbangan yang memudahkan penumpang menemukan jadwal dan status penerbangan. Sertakan versi desktop dan mobile.",
    due: "2026-10-14T17:00",
    status: "In Progress",
    createdAt: "2026-10-01T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-09T16:10",
    link: "https://figma.example.com/flight-info",
    revisions: 1,
    revisePending: true,
    unread: { Intern: 1, Mentor: 0 },
    comments: [
      c(
        1,
        "Nabila Putri",
        "Intern",
        "Sudah saya kumpulkan versi desktop dan mobile, Pak.",
        "2026-10-09T16:11",
      ),
      c(
        2,
        "Budi Santoso",
        "Mentor",
        "Tolong tambahkan tampilan status penerbangan tertunda dan versi bahasa Inggris.",
        "2026-10-12T10:00",
        true,
      ),
    ],
  },
  {
    id: "TSK-023",
    title: "Dokumentasi alur sistem check-in",
    intern: "Nabila Putri",
    mentor: "Budi Santoso",
    description:
      "Dokumentasikan alur check-in penumpang dari kedatangan hingga boarding, termasuk titik layanan dan kebutuhan sistem.",
    due: "2026-10-15T17:00",
    status: "To Do",
    createdAt: "2026-10-09T13:00",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-021",
    title: "Riset pengalaman pengguna airport app",
    intern: "Nabila Putri",
    mentor: "Budi Santoso",
    description:
      "Kumpulkan hasil riset kebutuhan pengguna aplikasi bandara dan rangkum temuan utama.",
    due: "2026-10-09T17:00",
    status: "In Review",
    createdAt: "2026-10-02T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-10T09:20",
    link: "https://docs.example.com/riset-ux-bandara",
    revisions: 0,
    unread: { Intern: 0, Mentor: 1 },
    comments: [
      c(
        3,
        "Budi Santoso",
        "Mentor",
        "Sertakan insight dari pengguna first-time flyer, ya.",
        "2026-10-05T09:00",
      ),
      c(4, "Nabila Putri", "Intern", "Sudah saya tambahkan di bagian 2, Pak.", "2026-10-10T09:21"),
    ],
  },
  {
    id: "TSK-019",
    title: "Wireframe kios self check-in",
    intern: "Nabila Putri",
    mentor: "Budi Santoso",
    description: "Susun wireframe alur kios self check-in untuk penumpang domestik.",
    due: "2026-10-08T17:00",
    status: "In Progress",
    createdAt: "2026-09-30T10:00",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-020",
    title: "Audit komponen design system",
    intern: "Nabila Putri",
    mentor: "Budi Santoso",
    description: "Lakukan audit konsistensi komponen pada design system.",
    due: "2026-10-08T17:00",
    status: "Done",
    createdAt: "2026-09-28T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-07T15:00",
    doneAt: "2026-10-08T09:00",
    file: "audit_design_system.pdf",
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [c(5, "Budi Santoso", "Mentor", "Rapi sekali, terima kasih.", "2026-10-08T09:01")],
  },
  {
    id: "TSK-014",
    title: "Benchmark aplikasi bandara regional",
    intern: "Nabila Putri",
    mentor: "Budi Santoso",
    description: "Bandingkan fitur utama lima aplikasi bandara di Asia Tenggara.",
    due: "2026-09-25T17:00",
    status: "Done",
    createdAt: "2026-09-14T09:00",
    everSubmitted: true,
    submittedAt: "2026-09-24T14:00",
    doneAt: "2026-09-25T10:00",
    link: "https://docs.example.com/benchmark",
    revisions: 1,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-022",
    title: "Laporan uji API login dan absensi",
    intern: "Rizky Pratama",
    mentor: "Budi Santoso",
    description: "Susun laporan pengujian endpoint API login dan absensi.",
    due: "2026-10-11T17:00",
    status: "In Review",
    createdAt: "2026-10-05T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-12T08:30",
    link: "https://drive.example.com/laporan-api",
    file: "laporan_api.pdf",
    revisions: 0,
    unread: { Intern: 0, Mentor: 1 },
    comments: [
      c(6, "Budi Santoso", "Mentor", "Tolong sertakan contoh respons error.", "2026-10-10T09:00"),
      c(7, "Rizky Pratama", "Intern", "Sudah ditambahkan di bagian 3, Pak.", "2026-10-12T08:31"),
    ],
  },
  {
    id: "TSK-013",
    title: "Skenario uji clock in",
    intern: "Rizky Pratama",
    mentor: "Budi Santoso",
    description: "Tulis skenario uji untuk fitur clock in.",
    due: "2026-09-30T17:00",
    status: "Done",
    createdAt: "2026-09-22T09:00",
    everSubmitted: true,
    submittedAt: "2026-09-30T11:00",
    doneAt: "2026-10-01T09:00",
    file: "skenario_uji.xlsx",
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-018",
    title: "Desain ERD modul absensi dan izin",
    intern: "Sekar Ayuningtyas",
    mentor: "Budi Santoso",
    description: "Rancang ERD untuk modul absensi dan izin.",
    due: "2026-10-14T17:00",
    status: "In Progress",
    createdAt: "2026-10-06T09:00",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 1 },
    comments: [
      c(
        8,
        "Budi Santoso",
        "Mentor",
        "Relasi izin ke intern belum ada, tolong tambahkan.",
        "2026-10-09T10:00",
      ),
      c(
        9,
        "Sekar Ayuningtyas",
        "Intern",
        "Baik Pak. Apakah relasi ke mentor juga perlu?",
        "2026-10-12T08:45",
      ),
    ],
  },
  {
    id: "TSK-017",
    title: "Dokumen kebutuhan sistem parkir",
    intern: "Fajar Nugroho",
    mentor: "Budi Santoso",
    description: "Susun dokumen kebutuhan sistem parkir terminal.",
    due: "2026-10-07T17:00",
    status: "To Do",
    createdAt: "2026-09-30T09:00",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [
      c(10, "Budi Santoso", "Mentor", "Mulai dari wawancara tim parkir, ya.", "2026-10-01T09:00"),
    ],
  },
  {
    id: "TSK-025",
    title: "Mockup halaman notifikasi",
    intern: "Fajar Nugroho",
    mentor: "Budi Santoso",
    description: "Buat mockup halaman notifikasi untuk aplikasi internal.",
    due: "2026-10-16T17:00",
    status: "To Do",
    createdAt: "2026-10-12T09:30",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-016",
    title: "Uji login aplikasi internal",
    intern: "Fajar Nugroho",
    mentor: "Budi Santoso",
    description: "Uji alur login aplikasi internal.",
    due: "2026-10-05T17:00",
    status: "Done",
    createdAt: "2026-09-28T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-05T10:00",
    doneAt: "2026-10-05T15:00",
    link: "https://docs.example.com/uji-login",
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-015",
    title: "Laporan akhir magang",
    intern: "Dimas Arya",
    mentor: "Budi Santoso",
    description: "Susun laporan akhir magang beserta rekomendasi.",
    due: "2026-10-09T17:00",
    status: "In Review",
    createdAt: "2026-09-25T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-09T15:00",
    file: "laporan_akhir_dimas.pdf",
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-030",
    title: "Analisis antrean security check",
    intern: "Galih Saputra",
    mentor: "Sari Lestari",
    description: "Analisis waktu antre di area security check.",
    due: "2026-10-15T17:00",
    status: "In Progress",
    createdAt: "2026-10-05T09:00",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-031",
    title: "Rekap survei kepuasan penumpang",
    intern: "Galih Saputra",
    mentor: "Sari Lestari",
    description: "Rekap hasil survei kepuasan penumpang September.",
    due: "2026-10-02T17:00",
    status: "Done",
    createdAt: "2026-09-21T09:00",
    everSubmitted: true,
    submittedAt: "2026-10-02T10:00",
    doneAt: "2026-10-02T14:00",
    file: "rekap_survei.xlsx",
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
  {
    id: "TSK-032",
    title: "Prototipe papan informasi bagasi",
    intern: "Putri Maharani",
    mentor: "Sari Lestari",
    description: "Buat prototipe papan informasi pengambilan bagasi.",
    due: "2026-10-20T17:00",
    status: "To Do",
    createdAt: "2026-10-09T09:00",
    everSubmitted: false,
    revisions: 0,
    unread: { Intern: 0, Mentor: 0 },
    comments: [],
  },
];

const seedLeaves: Leave[] = [
  {
    id: 1,
    intern: "Nabila Putri",
    type: "Izin Urgent",
    start: "2026-10-07",
    end: "2026-10-07",
    reason: "Mendampingi orang tua kontrol ke rumah sakit.",
    evidence: "",
    status: "Disetujui",
    submitted: "2026-10-06T19:00",
    by: "Budi Santoso",
    byRole: "Mentor",
    note: "Disetujui. Semoga lancar.",
    decidedAt: "2026-10-06T20:10",
  },
  {
    id: 2,
    intern: "Nabila Putri",
    type: "Izin Sakit",
    start: "2026-10-14",
    end: "2026-10-15",
    reason: "Jadwal tindakan gigi, dokter menyarankan istirahat dua hari.",
    evidence: "surat_dokter.pdf",
    status: "Pending",
    submitted: "2026-10-12T07:30",
  },
  {
    id: 3,
    intern: "Nabila Putri",
    type: "Izin Sakit",
    start: "2026-09-21",
    end: "2026-09-21",
    reason: "Demam.",
    evidence: "",
    status: "Ditolak",
    submitted: "2026-09-23T08:00",
    by: "Budi Santoso",
    byRole: "Mentor",
    note: "Tidak ada kabar pada hari tersebut. Mohon kabari lebih awal.",
    decidedAt: "2026-09-23T10:00",
  },
  {
    id: 4,
    intern: "Nabila Putri",
    type: "Izin Urgent",
    start: "2026-09-15",
    end: "2026-09-15",
    reason: "Urusan administrasi kampus.",
    evidence: "",
    status: "Dibatalkan",
    submitted: "2026-09-14T08:00",
  },
  {
    id: 5,
    intern: "Sekar Ayuningtyas",
    type: "Izin Sakit",
    start: "2026-10-12",
    end: "2026-10-13",
    reason: "Demam tinggi, disarankan istirahat oleh dokter.",
    evidence: "surat_dokter_sekar.pdf",
    status: "Disetujui",
    submitted: "2026-10-11T18:00",
    by: "Budi Santoso",
    byRole: "Mentor",
    note: "Semoga lekas pulih.",
    decidedAt: "2026-10-11T19:00",
  },
  {
    id: 6,
    intern: "Rizky Pratama",
    type: "Izin Urgent",
    start: "2026-10-13",
    end: "2026-10-13",
    reason: "Mengurus dokumen keluarga di kantor kelurahan.",
    evidence: "",
    status: "Pending",
    submitted: "2026-10-11T12:39",
  },
  {
    id: 7,
    intern: "Fajar Nugroho",
    type: "Izin Sakit",
    start: "2026-10-15",
    end: "2026-10-16",
    reason: "Operasi kecil, sudah ada surat rujukan.",
    evidence: "surat_rujukan.pdf",
    status: "Pending",
    submitted: "2026-10-11T08:39",
  },
  {
    id: 8,
    intern: "Galih Saputra",
    type: "Izin Sakit",
    start: "2026-10-05",
    end: "2026-10-05",
    reason: "Flu berat.",
    evidence: "surat_dokter_galih.pdf",
    status: "Disetujui",
    submitted: "2026-10-05T06:30",
    by: "Sari Lestari",
    byRole: "Mentor",
    note: "Lekas sembuh.",
    decidedAt: "2026-10-05T08:00",
  },
  {
    id: 9,
    intern: "Putri Maharani",
    type: "Izin Urgent",
    start: "2026-10-09",
    end: "2026-10-09",
    reason: "Keluarga sakit di luar kota.",
    evidence: "tiket_perjalanan.pdf",
    status: "Pending",
    submitted: "2026-10-10T09:00",
  },
];

const seedCorrections: Correction[] = [
  {
    id: 1,
    intern: "Nabila Putri",
    date: "2026-10-06",
    recIn: "08:00",
    recOut: "",
    reqIn: "08:00",
    reqOut: "17:00",
    reason: "Lupa clock out karena listrik padam di area kantor.",
    evidence: "",
    status: "Pending",
    submitted: "2026-10-07T08:05",
  },
  {
    id: 2,
    intern: "Nabila Putri",
    date: "2026-10-09",
    recIn: "08:02",
    recOut: "",
    reqIn: "08:02",
    reqOut: "17:00",
    reason: "Aplikasi gagal memuat saat clock out.",
    evidence: "tangkapan_layar.png",
    status: "Disetujui",
    submitted: "2026-10-10T09:12",
    by: "Ayu Wulandari",
    note: "Sesuai bukti tangkapan layar.",
    finalIn: "08:02",
    finalOut: "17:00",
  },
  {
    id: 3,
    intern: "Nabila Putri",
    date: "2026-09-25",
    recIn: "08:31",
    recOut: "17:00",
    reqIn: "08:00",
    reqOut: "17:00",
    reason: "Clock in tercatat terlambat.",
    evidence: "",
    status: "Ditolak",
    submitted: "2026-09-26T14:30",
    by: "Rina Hartono",
    note: "Tidak ada bukti.",
  },
  {
    id: 4,
    intern: "Rizky Pratama",
    date: "2026-10-08",
    recIn: "",
    recOut: "",
    reqIn: "08:05",
    reqOut: "17:00",
    reason: "Hadir di kantor, tetapi ponsel mati sehingga tidak bisa clock in.",
    evidence: "",
    status: "Pending",
    submitted: "2026-10-09T14:30",
  },
  {
    id: 5,
    intern: "Fajar Nugroho",
    date: "2026-10-08",
    recIn: "08:05",
    recOut: "",
    reqIn: "08:05",
    reqOut: "17:10",
    reason: "Lupa clock out karena langsung rapat di luar kantor.",
    evidence: "",
    status: "Pending",
    submitted: "2026-10-09T08:00",
  },
];

const seedNotices: Notice[] = [
  {
    id: 1,
    role: "Intern",
    text: "Task 'Redesign halaman informasi penerbangan' perlu direvisi.",
    at: "2026-10-12T10:00",
    to: "/task",
    search: { open: "TSK-024" },
    read: false,
  },
  {
    id: 2,
    role: "Intern",
    text: "Pesan baru dari Ayu Wulandari.",
    at: "2026-10-12T09:40",
    to: "/chat",
    search: { to: "Ayu Wulandari" },
    read: false,
  },
  {
    id: 3,
    role: "Intern",
    text: "Koreksi absensi 9 Okt disetujui.",
    at: "2026-10-10T13:02",
    to: "/absensi",
    search: { tab: "koreksi" },
    read: true,
  },
  {
    id: 4,
    role: "Intern",
    text: "Pengumuman: Town Hall Intern Oktober 2026",
    at: "2026-10-10T08:00",
    to: "/",
    read: true,
  },
  {
    id: 10,
    role: "Mentor",
    text: "Rizky P. mengumpulkan Task 'Laporan uji API login dan absensi'.",
    at: "2026-10-12T08:30",
    to: "/task",
    search: { open: "TSK-022" },
    read: false,
  },
  {
    id: 11,
    role: "Mentor",
    text: "Sekar A. membalas komentar di 'Desain ERD modul absensi dan izin'.",
    at: "2026-10-12T08:45",
    to: "/task",
    search: { open: "TSK-018" },
    read: false,
  },
  {
    id: 12,
    role: "Mentor",
    text: "Nabila P. mengajukan Izin Sakit 14-15 Okt.",
    at: "2026-10-12T07:30",
    to: "/izin",
    search: { open: "2" },
    read: false,
  },
  {
    id: 13,
    role: "Mentor",
    text: "Task 'Dokumen kebutuhan sistem parkir' milik Fajar N. lewat tenggat lebih dari 2 hari kerja.",
    at: "2026-10-12T00:05",
    to: "/task",
    search: { open: "TSK-017" },
    read: true,
  },
  {
    id: 14,
    role: "Mentor",
    text: "Pesan baru dari Ayu Wulandari.",
    at: "2026-10-12T09:15",
    to: "/chat",
    search: { to: "Ayu Wulandari" },
    read: true,
  },
  {
    id: 20,
    role: "Admin",
    text: "Nabila P. mengajukan koreksi absensi 6 Okt.",
    at: "2026-10-07T08:05",
    to: "/koreksi",
    search: { open: "1" },
    read: false,
  },
  {
    id: 21,
    role: "Admin",
    text: "Izin Rizky P. belum diproses mentor lebih dari 24 jam.",
    at: "2026-10-12T12:39",
    to: "/izin",
    search: { open: "6" },
    read: false,
  },
  {
    id: 22,
    role: "Admin",
    text: "Magang Rizky P. berakhir dalam 7 hari.",
    at: "2026-10-09T07:00",
    to: "/",
    read: false,
  },
  {
    id: 23,
    role: "Admin",
    text: "Pesan baru dari Budi Santoso.",
    at: "2026-10-12T09:20",
    to: "/chat",
    search: { to: "Budi Santoso" },
    read: true,
  },
];

const seedChats: ChatMsg[] = [
  {
    id: 1,
    from: "Budi Santoso",
    to: "Nabila Putri",
    text: "Selamat pagi, Nabila. Silakan cek komentar revisi di Task flight info, ya.",
    at: "2026-10-12T10:02",
  },
  {
    id: 2,
    from: "Nabila Putri",
    to: "Budi Santoso",
    text: "Baik, Pak. Saya kerjakan hari ini.",
    at: "2026-10-12T10:05",
  },
  {
    id: 3,
    from: "Ayu Wulandari",
    to: "Nabila Putri",
    text: "Halo Nabila, bisa jelaskan kenapa lupa clock out tanggal 6 Okt?",
    at: "2026-10-12T09:40",
  },
  {
    id: 4,
    from: "Sekar Ayuningtyas",
    to: "Nabila Putri",
    text: "Nab, file referensi ERD sudah aku kirim lewat email ya.",
    at: "2026-10-09T15:00",
  },
  {
    id: 5,
    from: "Ayu Wulandari",
    to: "Budi Santoso",
    text: "Halo Pak Budi, masa magang Rizky Pratama berakhir 16 Okt 2026. Apakah akan diperpanjang?",
    at: "2026-10-12T09:15",
  },
  {
    id: 6,
    from: "Budi Santoso",
    to: "Ayu Wulandari",
    text: "Rencananya diperpanjang sampai akhir November, Bu. Saya konfirmasi ke Rizky dulu.",
    at: "2026-10-12T09:20",
  },
  {
    id: 7,
    from: "Rizky Pratama",
    to: "Budi Santoso",
    text: "Pak, laporan API sudah saya kumpulkan ulang.",
    at: "2026-10-12T08:32",
  },
];

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Model = {
  role: Role;
  setRole: (r: Role) => void;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  locationSim: LocationSim;
  setLocationSim: (s: LocationSim) => void;
  mustChangePassword: boolean;
  setMustChangePassword: (b: boolean) => void;
  me: Person;
  people: Person[];
  setPeople: Setter<Person[]>;
  att: AttRec[];
  setAtt: Setter<AttRec[]>;
  tasks: Task[];
  setTasks: Setter<Task[]>;
  leaves: Leave[];
  setLeaves: Setter<Leave[]>;
  corrections: Correction[];
  setCorrections: Setter<Correction[]>;
  holidays: Holiday[];
  setHolidays: Setter<Holiday[]>;
  holidayDates: string[];
  holidayName: (date: string) => string | undefined;
  workHistory: WorkHours[];
  setWorkHistory: Setter<WorkHours[]>;
  workHours: WorkHours;
  warnings: Warn[];
  setWarnings: Setter<Warn[]>;
  announcements: Announcement[];
  setAnnouncements: Setter<Announcement[]>;
  logs: LogEntry[];
  log: (action: string, object: string, detail: string) => void;
  notices: Notice[];
  notify: (role: Role, text: string, to: AppPath, search?: PageSearch) => void;
  markRead: (id: number) => void;
  markAllRead: (role: Role) => void;
  chats: ChatMsg[];
  sendChat: (to: string, text: string) => void;
  chatRead: Record<string, string>;
  markChatRead: (contact: string) => void;
  chatDraft: { to: string; text: string } | null;
  setChatDraft: (d: { to: string; text: string } | null) => void;
  person: (name: string) => Person | undefined;
  isActive: (p: Person) => boolean;
  internsOf: (mentor: string) => Person[];
  leaveOn: (intern: string, date: string) => Leave | undefined;
  rowsFor: (intern: string, from: string, to: string) => Row[];
  today: (intern: string) => { state: ReturnType<typeof todayState>; rec?: AttRec; leave?: Leave };
  nowTime: () => string;
  nowIso: () => string;
};
const Context = createContext<Model | null>(null);

export function MockProvider({
  children,
  initialRole = "Intern",
}: {
  children: ReactNode;
  initialRole?: Role;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [scenario, setScenario] = useState<Scenario>("kerja");
  const [locationSim, setLocationSim] = useState<LocationSim>("sesuai");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [people, setPeople] = useState(seedPeople);
  const [att, setAtt] = useState(() => seedAttendance(seedPeople));
  const [tasks, setTasks] = useState(seedTasks);
  const [leaves, setLeaves] = useState(seedLeaves);
  const [corrections, setCorrections] = useState(seedCorrections);
  const [holidays, setHolidays] = useState<Holiday[]>([
    { date: "2026-08-17", name: "Hari Kemerdekaan RI" },
    { date: "2026-12-24", name: "Cuti bersama Natal" },
    { date: "2026-12-25", name: "Hari Raya Natal" },
  ]);
  const [workHistory, setWorkHistory] = useState<WorkHours[]>([
    { start: "08:00", end: "17:00", from: "2026-07-01" },
  ]);
  const [warnings, setWarnings] = useState<Warn[]>([
    {
      id: 1,
      intern: "Nabila Putri",
      text: "Tidak hadir tanpa keterangan pada 5 Okt 2026. Sudah ditegur lisan.",
      author: "Ayu Wulandari",
      created: "2026-10-12T08:10",
    },
    {
      id: 2,
      intern: "Rizky Pratama",
      text: "Clock in di atas pukul 09:00 tiga kali dalam seminggu. Sudah diingatkan lewat chat.",
      author: "Rina Hartono",
      created: "2026-09-18T10:00",
    },
    {
      id: 3,
      intern: "Nabila Putri",
      text: "Terlambat mengumpulkan dua Task berturut-turut, sudah didiskusikan dengan mentor.",
      author: "Ayu Wulandari",
      created: "2026-10-02T15:00",
    },
  ]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: 1,
      title: "Town Hall Intern Oktober 2026",
      text: "Town Hall seluruh peserta magang dan mentor diadakan Jumat, 16 Okt 2026 pukul 14:00 di Auditorium Kantor Pusat.",
      audience: "Intern & Mentor",
      date: "2026-10-10",
      author: "Ayu Wulandari",
    },
    {
      id: 2,
      title: "Batas pengumpulan laporan akhir",
      text: "Intern yang selesai magang bulan ini mengumpulkan laporan akhir paling lambat H-3 sebelum tanggal selesai.",
      audience: "Intern",
      date: "2026-10-05",
      author: "Rina Hartono",
    },
    {
      id: 3,
      title: "Pembaruan panduan pendampingan",
      text: "Panduan pendampingan intern versi Oktober sudah tersedia. Mohon dibaca sebelum rapat mentor.",
      audience: "Mentor",
      date: "2026-10-02",
      author: "Ayu Wulandari",
    },
  ]);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      time: "2026-10-12T08:10",
      admin: "Ayu Wulandari",
      action: "Warning",
      object: "Nabila Putri",
      detail: "Menambah catatan warning.",
    },
    {
      time: "2026-10-10T13:02",
      admin: "Ayu Wulandari",
      action: "Absensi",
      object: "Nabila Putri",
      detail: "Setujui koreksi 9 Okt: clock out 17:00.",
    },
    {
      time: "2026-10-10T08:00",
      admin: "Ayu Wulandari",
      action: "Pengumuman",
      object: "Town Hall Intern Oktober 2026",
      detail: "Buat pengumuman untuk Intern dan Mentor.",
    },
    {
      time: "2026-10-09T16:40",
      admin: "Rina Hartono",
      action: "Akun",
      object: "Galih Saputra",
      detail: "Ganti mentor dari Budi Santoso ke Sari Lestari.",
    },
    {
      time: "2026-09-26T15:00",
      admin: "Rina Hartono",
      action: "Absensi",
      object: "Nabila Putri",
      detail: "Tolak koreksi 25 Sep.",
    },
  ]);
  const [notices, setNotices] = useState(seedNotices);
  const [chats, setChats] = useState(seedChats);
  const [chatRead, setChatRead] = useState<Record<string, string>>({
    "Nabila Putri|Budi Santoso": "2026-10-12T10:05",
    "Nabila Putri|Sekar Ayuningtyas": "2026-10-09T15:00",
    "Budi Santoso|Ayu Wulandari": "2026-10-12T09:15",
    "Ayu Wulandari|Budi Santoso": "2026-10-12T09:20",
  });

  const [chatDraft, setChatDraft] = useState<{ to: string; text: string } | null>(null);

  const nowTime = () => {
    const t = new Date();
    return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  };
  const nowIso = () => `${TODAY}T${nowTime()}`;
  const meName = ME[role];
  const me = people.find((p) => p.name === meName) ?? (seedPeople[0] as Person);
  const holidayDates = [...holidays.map((h) => h.date), ...(scenario === "libur" ? [TODAY] : [])];
  const holidayName = (date: string) =>
    scenario === "libur" && date === TODAY
      ? "Libur contoh (simulasi)"
      : holidays.find((h) => h.date === date)?.name;
  const workHours =
    [...workHistory].sort((a, b) => b.from.localeCompare(a.from)).find((w) => w.from <= TODAY) ??
    (workHistory[0] as WorkHours);
  const person = (name: string) => people.find((p) => p.name === name);
  const isActive = (p: Person) =>
    p.active &&
    !(p.role === "Intern" && isAutoInactive(p.end)) &&
    !(p.role === "Intern" && notStarted(p.start));
  const internsOf = (mentor: string) =>
    people.filter((p) => p.role === "Intern" && p.mentor === mentor);
  const leaveOn = (intern: string, date: string) => {
    if (scenario === "izin" && intern === ME.Intern && date === TODAY)
      return {
        id: -1,
        intern,
        type: "Izin Sakit",
        start: TODAY,
        end: TODAY,
        reason: "Simulasi",
        evidence: "",
        status: "Disetujui",
        submitted: NOW,
      } as Leave;
    return leaves.find(
      (l) => l.intern === intern && l.status === "Disetujui" && l.start <= date && l.end >= date,
    );
  };
  const rowsFor = (intern: string, from: string, to: string): Row[] => {
    const p = person(intern);
    if (!p?.start) return [];
    const start = p.start > from ? p.start : from;
    const endCap = p.end < to ? p.end : to;
    const last = endCap < TODAY ? endCap : TODAY;
    const rows: Row[] = [];
    for (let d = start; d <= last; d = addDays(d, 1)) {
      if (scenario === "luar" && intern === ME.Intern && d === TODAY) continue;
      const rec = att.find((r) => r.intern === intern && r.date === d);
      const holiday = holidayName(d);
      const row: Row = {
        intern,
        date: d,
        clockIn: rec?.clockIn ?? "",
        clockOut: rec?.clockOut ?? "",
        status: attendanceStatus(
          d,
          rec?.clockIn ?? "",
          rec?.clockOut ?? "",
          holidayDates,
          !!leaveOn(intern, d),
        ),
        corrected: !!rec?.corrected,
      };
      if (rec?.report) row.report = rec.report;
      if (holiday) row.holiday = holiday;
      rows.push(row);
    }
    return rows.reverse();
  };
  const today = (intern: string) => {
    const p = person(intern);
    const rec = att.find((r) => r.intern === intern && r.date === TODAY);
    const leave = leaveOn(intern, TODAY);
    const inPeriod =
      !!p?.start &&
      p.start <= TODAY &&
      p.end >= TODAY &&
      !(scenario === "luar" && intern === ME.Intern);
    const state = todayState({
      workday: isWorkingDay(TODAY, holidayDates),
      inPeriod,
      approvedLeave: !!leave,
      clockIn: rec?.clockIn ?? "",
      clockOut: rec?.clockOut ?? "",
    });
    return { state, ...(rec ? { rec } : {}), ...(leave ? { leave } : {}) };
  };
  const log = (action: string, object: string, detail: string) =>
    setLogs((old) => [{ time: nowIso(), admin: ME.Admin, action, object, detail }, ...old]);
  const notify = (to: Role, text: string, path: AppPath, search?: PageSearch) =>
    setNotices((old) => [
      {
        id: Date.now() + Math.random(),
        role: to,
        text,
        at: nowIso(),
        to: path,
        ...(search ? { search } : {}),
        read: false,
      },
      ...old,
    ]);
  const markRead = (id: number) =>
    setNotices((old) => old.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = (r: Role) =>
    setNotices((old) => old.map((n) => (n.role === r ? { ...n, read: true } : n)));
  const sendChat = (to: string, text: string) => {
    const at = nowIso();
    setChats((old) => [...old, { id: Date.now(), from: meName, to, text, at }]);
    setChatRead((old) => ({ ...old, [`${meName}|${to}`]: at }));
  };
  const markChatRead = (contact: string) => {
    const last = chats.filter((m) => m.from === contact && m.to === meName).at(-1)?.at;
    if (last) setChatRead((old) => ({ ...old, [`${meName}|${contact}`]: last }));
  };

  return (
    <Context.Provider
      value={{
        role,
        setRole,
        scenario,
        setScenario,
        locationSim,
        setLocationSim,
        mustChangePassword,
        setMustChangePassword,
        me,
        people,
        setPeople,
        att,
        setAtt,
        tasks,
        setTasks,
        leaves,
        setLeaves,
        corrections,
        setCorrections,
        holidays,
        setHolidays,
        holidayDates,
        holidayName,
        workHistory,
        setWorkHistory,
        workHours,
        warnings,
        setWarnings,
        announcements,
        setAnnouncements,
        logs,
        log,
        notices,
        notify,
        markRead,
        markAllRead,
        chats,
        sendChat,
        chatRead,
        markChatRead,
        chatDraft,
        setChatDraft,
        person,
        isActive,
        internsOf,
        leaveOn,
        rowsFor,
        today,
        nowTime,
        nowIso,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useMock() {
  const context = useContext(Context);
  if (!context) throw new Error("MockProvider is required");
  return context;
}
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
export const unreadChats = (chats: ChatMsg[], me: string, read: Record<string, string>) =>
  chats.filter((m) => m.to === me && m.at > (read[`${me}|${m.from}`] ?? "")).length;

/** Rekap bulanan memakai status final. Hari berjalan belum dihitung sampai lewat 23:59. */
export const recap = (rows: Row[]) => {
  const final = rows.filter((r) => r.date < TODAY && r.status !== "Libur");
  const count = (s: AttendanceStatus) => final.filter((r) => r.status === s).length;
  return {
    hadir: count("Hadir"),
    izin: count("Izin"),
    tidakHadir: count("Tidak Hadir"),
    lupa: count("Lupa Clock Out"),
    hariKerja: final.length,
    laporan: final.filter((r) => r.status === "Hadir" && r.report).length,
  };
};

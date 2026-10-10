# Web Intern Management & Attendance System

Sistem web untuk mengelola intern di Bandara Soekarno-Hatta: absensi, laporan harian, tugas, izin, dan komunikasi antara intern, mentor, dan admin. Proyek ini adalah capstone design project.

Status per 10 Oktober 2026: prototipe frontend sudah jadi dengan data contoh. Backend masih berupa starter dan belum terhubung ke frontend.

## Role

| Role | Siapa | Yang dilakukan |
|---|---|---|
| Intern | Peserta magang | Clock in dan clock out, mengisi Daily Report, mengerjakan Task, mengajukan izin dan koreksi absensi |
| Mentor | Pembimbing intern | Memberi dan memeriksa Task, memproses izin, memantau performa intern bimbingannya |
| Admin | PIC magang | Mengelola akun, kantor, jam kerja, libur, koreksi absensi, pengumuman, warning, dan laporan |

Satu intern punya tepat satu mentor. Satu mentor bisa membimbing banyak intern.

## Fitur utama

| Fitur | Ringkasan |
|---|---|
| Absensi | Clock in dan clock out dengan validasi lokasi kantor. Status kehadiran dihitung otomatis dengan batas 23:59 |
| Daily Report | Laporan harian intern, wajib dikirim sebelum clock out |
| Task | Papan Kanban (To Do, In Progress, In Review, Done), pengumpulan lewat link atau file, komentar dua arah |
| Izin | Izin Sakit dan Izin Urgent dengan bukti. Disetujui mentor, atau admin bila mentor tidak merespons |
| Koreksi absensi | Intern mengajukan, admin memverifikasi lalu memutuskan |
| Lokasi kantor | Admin memilih titik di peta dan mengatur radius clock in dan clock out |
| Chat | Satu lawan satu, real time |
| Notifikasi | Lonceng di navbar, real time |
| Pengumuman | Dari admin ke role yang dipilih |
| Warning | Catatan admin tentang intern, hanya terlihat oleh admin |
| Laporan | Export PDF oleh admin |
| Log aktivitas | Jejak semua tindakan admin |

## Arsitektur

```
Browser
  |
  |-- HTTP (REST API) ------> Laravel API ------> PostgreSQL (Supabase)
  |                               |
  |-- WebSocket ------------> Laravel Reverb      Supabase Storage (file)
  |
Frontend (TanStack Start, di Vercel)
```

| Bagian | Teknologi | Catatan |
|---|---|---|
| Frontend | TanStack Start, React, TypeScript, Tailwind, shadcn/ui | Dibangun lewat Lovable |
| Backend | Laravel sebagai REST API, login dengan Sanctum | Tanpa Inertia |
| Database | PostgreSQL | Lokal saat development, Supabase saat produksi |
| Real time | Laravel Reverb (WebSocket) | Untuk chat dan notifikasi, tanpa layanan pihak ketiga |
| File | Supabase Storage | Maksimal 2 MB per file |
| Peta | Leaflet + OpenStreetMap | Gratis, tanpa API key |

## Struktur repo

```
.
├── README.md          Berkas ini
├── docs/              Dokumen desain per role
│   ├── design-admin.md
│   ├── design-mentor.md
│   └── design-intern.md
├── frontend/          Aplikasi web (TanStack Start)
│   ├── CLAUDE.md      Panduan AI untuk frontend
│   ├── roadmap.md
│   └── src/
│       ├── routes/                  Satu berkas per halaman
│       ├── components/internspace/  Komponen halaman dan data contoh
│       ├── components/ui/           Komponen dasar (shadcn/ui)
│       └── lib/mock-rules.ts        Aturan bisnis yang dipakai layar
└── backend/           API (Laravel)
    └── CLAUDE.md      Panduan AI untuk backend
```

## Frontend

Halaman yang sudah ada:

| Halaman | Alamat | Role |
|---|---|---|
| Login, Ganti Password | `/login`, `/ganti-password` | Semua |
| Dashboard | `/` | Semua |
| Absensi | `/absensi` | Intern, Admin |
| Task | `/task` | Intern, Mentor |
| Izin | `/izin` | Semua |
| Kalender Izin | `/kalender-izin` | Mentor |
| Intern Saya, Performa | `/intern-saya`, `/performa` | Mentor |
| Pengguna | `/users` | Admin |
| Koreksi | `/koreksi` | Admin |
| Warning | `/warning` | Admin |
| Pengumuman | `/pengumuman` | Admin |
| Laporan | `/laporan` | Admin |
| Pengaturan | `/pengaturan` | Admin |
| Log Aktivitas | `/log` | Admin |
| Chat, Profil | `/chat`, `/profil` | Semua |

Yang perlu diketahui:
- Semua data masih **data contoh** di `src/components/internspace/model.tsx`. Belum ada panggilan ke API.
- Prototipe memakai tanggal tetap (12 Oktober 2026) agar data contoh konsisten.
- Aturan bisnis dikumpulkan di `src/lib/mock-rules.ts` dan sudah punya test. Backend harus menerapkan aturan yang sama.
- Menu **Lokasi Kantor** untuk admin sudah ada di dokumen desain tetapi belum dibuat di frontend.

Menjalankan:

```bash
cd frontend
npm install     # cukup sekali, jika module belum terpasang
npm run dev
```

## Backend

Yang perlu diketahui:
- Folder `backend/` saat ini berisi starter Laravel + Inertia. Inertia akan dilepas karena Laravel hanya dipakai sebagai API.
- Desain data: 18 tabel. Rincian dan ERD ada di dokumen "Arsitektur Backend & Desain Data".
- Status kehadiran, status aktif intern, dan label Terlambat **tidak disimpan**, melainkan dihitung dari data lain.

Kelompok tabel:

| Kelompok | Tabel |
|---|---|
| Akun | `users`, `intern_profiles`, `mentor_histories` |
| Kehadiran | `attendances`, `daily_reports`, `attendance_corrections`, `leave_requests` |
| Task | `tasks`, `task_comments`, `task_reads` |
| Komunikasi | `chat_messages`, `notifications`, `announcements` |
| Administrasi | `warnings`, `audit_logs` |
| Pengaturan | `holidays`, `work_hour_settings`, `offices` |

Menjalankan:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve          # API
php artisan reverb:start   # WebSocket
php artisan queue:work     # antrean
php artisan test
```

Isi `.env` dengan koneksi PostgreSQL lokal sebelum menjalankan migrate.

## Deployment

| Bagian | Tempat | Status |
|---|---|---|
| Frontend | Vercel | Rencana |
| Database dan file | Supabase | Rencana |
| Laravel API dan Reverb | Satu host yang selalu menyala (VPS atau platform container) | Host belum dipilih |

Reverb adalah proses yang harus menyala terus, jadi dijalankan bersama API di host yang sama, bukan di Vercel.

## Aturan penting

- Sabtu dan Minggu libur. Libur lain diatur admin.
- Jam kerja berlaku sama untuk semua intern.
- Tanpa clock in sampai 23:59 berarti Tidak Hadir. Clock in tanpa clock out berarti Lupa Clock Out.
- Akun dibuat admin dengan email internal. Tidak ada Google OAuth. Reset password oleh admin.
- Akun tidak pernah dihapus, hanya dinonaktifkan.
- Intern hanya punya Izin Sakit dan Izin Urgent, tidak ada cuti.
- Admin tidak bisa membaca chat orang lain.
- Tidak ada penilaian intern. Halaman Performa hanya untuk pemantauan.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| PRD (PDF) | Kebutuhan sistem dan keputusan tingkat overview |
| `docs/design-intern.md` | Alur, layar, dan aturan role Intern |
| `docs/design-mentor.md` | Alur, layar, dan aturan role Mentor |
| `docs/design-admin.md` | Alur, layar, dan aturan role Admin |
| Arsitektur Backend & Desain Data | Stack, ERD, 18 tabel, dan arti tiap kolom |
| `frontend/CLAUDE.md`, `backend/CLAUDE.md` | Panduan untuk asisten AI saat mengerjakan tiap bagian |

## Hal yang masih terbuka

- Jenis file yang boleh diunggah.
- Intern terikat pada satu kantor, atau boleh clock in di kantor aktif mana pun.
- Batas radius kantor (usulan 10 sampai 1000 meter).
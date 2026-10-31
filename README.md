# Web Intern Management & Attendance System

Sistem web untuk mengelola intern InJourney Airports: presensi berbasis lokasi, logbook harian, koreksi presensi, izin, presentasi akhir, penilaian, dan komunikasi antara intern, mentor, dan admin. Proyek ini adalah capstone design project.

## Status per 1 November 2026

| Bagian | Status |
| --- | --- |
| Dokumen desain | Revisi dari wawancara mitra 22 Okt 2026 (design-intern Draft 3, design-mentor Draft 2, design-admin Draft 3) |
| Backend (Laravel API) | Selesai mengikuti dokumen desain terbaru: presensi, logbook, koreksi dua tahap, izin dengan kuota, presentasi, penilaian, Lokasi & Jadwal, dashboard, laporan, notifikasi, chat. Murni API, 815 test lolos di SQLite dan PostgreSQL |
| Frontend (TanStack Start) | Terintegrasi API untuk Fase 0-6: autentikasi, seluruh halaman per role, laporan, serta chat/notifikasi real-time. Uji live bersama backend sudah dilakukan 1 Nov 2026; sisa bug tampilan ada di [`frontend/progress.md`](frontend/progress.md) bagian 15 |
| Deployment | Belum. Host untuk API dan WebSocket belum dipilih |

## Dokumen penting

Mulai dari tabel ini untuk mencari apa pun.

| Kebutuhan | Dokumen | Keterangan |
| --- | --- | --- |
| Alur, layar, aturan, dan teks per role | [`docs/design-intern.md`](docs/design-intern.md), [`docs/design-mentor.md`](docs/design-mentor.md), [`docs/design-admin.md`](docs/design-admin.md) | **Sumber kebenaran utama.** Jika kode dan dokumen berbeda, dokumen yang diikuti |
| **Integrasi frontend ke backend** | [`backend/progress.md`](backend/progress.md), bagian **"Catatan integrasi frontend setelah rombak"** | Endpoint per role, endpoint lama yang dihapus dan penggantinya, field yang berubah, tujuan klik notifikasi, aturan umum (token, sesi, error, export Excel) |
| Rincian perilaku setiap fitur backend | [`backend/progress.md`](backend/progress.md), bagian "Rombak sesuai dokumen 24 Okt 2026" (Tahap 1-9) | Aturan, pesan error, bentuk respons, dan keputusan kecil yang diambil saat implementasi |
| Lonceng notifikasi, chat, WebSocket | [`backend/progress.md`](backend/progress.md), bagian "Catatan integrasi frontend: Lonceng dan Chat" | Channel, event, dan cara frontend berlangganan |
| Keputusan pemilik repo dan hal terbuka | [`backend/progress.md`](backend/progress.md), bagian "Keputusan review", "Keputusan pemilik repo", "Perlu diputuskan", "Masih terbuka" | |
| Skema database (ERD, arti tiap kolom) | `backend/backend_architecture_ERD.md` | **Tidak masuk git** (di-ignore). Minta ke pemilik repo bila dibutuhkan. Ringkasan tabel ada di bagian [Backend](#backend) |
| **Menjalankan backend + frontend bersama** | Bagian [Menjalankan lokal](#menjalankan-lokal-backend--frontend) di bawah; rincian dan pemecahan masalah di [`frontend/progress.md`](frontend/progress.md) bagian 16 | |
| Bug tampilan frontend yang belum diperbaiki | [`frontend/progress.md`](frontend/progress.md) bagian 15 | Hasil audit browser semua role, desktop dan mobile |
| Panduan dan status frontend | [`frontend/README.md`](frontend/README.md), [`frontend/AGENTS.md`](frontend/AGENTS.md), [`frontend/roadmap.md`](frontend/roadmap.md), [`frontend/src/components/internspace/README.md`](frontend/src/components/internspace/README.md) | Pemetaan menu ke file per role |
| Panduan asisten AI | [`frontend/CLAUDE.md`](frontend/CLAUDE.md); `backend/CLAUDE.md` (lokal, tidak masuk git) | |
| PRD | PDF di luar repo | Kebutuhan sistem tingkat overview |

Bagian "Selesai" di awal `backend/progress.md` adalah catatan lama sebelum rombak 24-25 Oktober (masih berisi Task dan upload file). Untuk endpoint yang berubah, ikuti catatan integrasi setelah rombak.

## Role

| Role | Siapa | Yang dilakukan |
| --- | --- | --- |
| Intern | Peserta magang | Clock in dan clock out, mengisi logbook harian, mengajukan koreksi presensi dan izin, mengirim bukti presentasi akhir, membaca catatan warning dan nilai |
| Mentor | Pembimbing di unit | Mereview logbook, memvalidasi koreksi presensi, memproses izin, memantau performa, memberi penilaian akhir |
| Admin | PIC magang | Mengelola akun, bandara, titik presensi dan jadwal, libur, pengaturan umum, mengeksekusi koreksi, memutuskan izin yang lewat batas, memverifikasi presentasi, warning, pengumuman, laporan |

Satu intern tepat satu mentor. Mentor tidak terikat bandara.

## Fitur utama

| Fitur | Ringkasan |
| --- | --- |
| Presensi | Clock in dan clock out di titik presensi aktif milik bandara intern, dengan validasi radius di backend. Status: Hadir, Terlambat (toleransi dari Pengaturan Umum), Lupa Clock In, Izin, Tidak Hadir, Libur, ditambah tanda Lupa Clock Out dan Dikoreksi. Dihitung saat dibaca, batas hari 23:59 |
| Logbook harian | Wajib untuk setiap hari berpresensi, diisi sebelum clock out. Mentor menyetujui atau meminta revisi (bisa setujui banyak sekaligus) |
| Koreksi presensi | Dua tahap: intern mengajukan, mentor ACC, admin mengeksekusi. Hasil selalu Hadir + Dikoreksi |
| Izin | Izin Sakit dan Izin Urgent dengan link bukti Google Drive/Docs. Kuota per masa magang. Admin mengambil alih jika mentor tidak memproses lewat batas jam |
| Presentasi akhir | Intern mengirim link bukti mulai H-7, admin memverifikasi |
| Penilaian | Menu Input Nilai: mentor mengisi 9 indikator (nilai bulat 0-100) dan catatan setelah presentasi dan semua logbook disetujui. Rata-rata dan predikat dihitung server, terkunci setelah submit |
| Lokasi & Jadwal | Bandara (lokasi magang) dengan titik presensi, jadwal mingguan, dan jadwal khusus |
| Dashboard | Per role, kartu bisa diklik, antrean tindakan. Admin punya filter bandara global |
| Performa | KPI pemantauan untuk mentor: Kehadiran, Tepat waktu, Logbook disetujui, Revisi logbook |
| Warning | Catatan admin tentang intern, terbaca oleh intern dan mentornya |
| Laporan | Export Excel 4 sheet (Rekap Presensi, Izin, Logbook, Penilaian), PDF Daftar Kehadiran per intern per bulan, dan PDF Penilaian |
| Chat, notifikasi, pengumuman | Real-time lewat WebSocket |
| Log aktivitas | Jejak semua tindakan admin, hanya bisa dibaca |

## Konsep yang perlu dipahami

- **Bandara dan titik presensi.** Bandara (misalnya Soekarno-Hatta) adalah lokasi magang dan pemilik jadwal kerja. Titik presensi (misalnya Terminal 1-3) adalah lokasi clock in/out beserta radiusnya. Intern hanya boleh presensi di titik aktif milik bandaranya. Dokumen desain masih menyebut keduanya "kantor".
- **Jadwal kerja per bandara.** Urutannya: kalender libur (berlaku untuk semua bandara) → hari non-kerja di jadwal mingguan → jadwal khusus → jam jadwal mingguan. Tidak ada aturan "Sabtu-Minggu libur" yang tertanam di kode. Presensi menyalin jadwal dan toleransi saat dibuat, jadi perubahan jadwal tidak mengubah status lama.
- **Hari wajib berlogbook** = setiap hari dalam periode magang yang punya baris presensi. Definisi ini dipakai untuk syarat penilaian, KPI, dan Rekap Logbook.
- **Angka kebijakan** (toleransi terlambat 15 menit, kuota izin 3 kali, pengingat 7 hari, batas izin ke admin 24 jam) disimpan di tabel `system_settings` dan bisa diubah admin di Pengaturan Umum.
- **Akun.** Dibuat admin dengan email internal, tanpa registrasi atau OAuth. Akun dinonaktifkan, bukan dihapus. Intern otomatis nonaktif mulai hari setelah tanggal selesai magang dan tidak bisa login lagi, jadi penilaian harus disubmit sebelum magang berakhir.
- **Sesi** berakhir setelah 30 menit tanpa aktivitas.
- **Tidak ada upload file.** Bukti izin dan presentasi berupa link Google Drive/Docs.

## Arsitektur

```text
Browser (frontend TanStack Start, di Vercel)
  |
  |-- HTTP REST + Bearer token --> Laravel API -----> PostgreSQL (Supabase)
  |                                    |
  |-- WebSocket -----------------> Laravel Reverb <-- queue worker (broadcast)
                                       ^
                       scheduler (pengingat, setiap jam dan setiap hari)
```

| Bagian | Teknologi | Catatan |
| --- | --- | --- |
| Frontend | TanStack Start, React, TypeScript, Tailwind, shadcn/ui | Dibangun lewat Lovable |
| Backend | Laravel 13 sebagai REST API, Sanctum (Bearer token) | Tanpa Inertia, tanpa halaman web |
| Database | PostgreSQL | Lokal saat development, Supabase saat production |
| Real time | Laravel Reverb (WebSocket) | Chat, notifikasi, status online. Tanpa layanan pihak ketiga |
| Excel | OpenSpout | Butuh ekstensi PHP `zip` |
| PDF | laravel-dompdf | Template Blade di `backend/resources/views/pdf` |
| Peta | Leaflet + OpenStreetMap | Di frontend. Backend menyimpan koordinat dan menghitung jarak |

## Struktur repo

```text
.
├── README.md                 Berkas ini
├── docs/                     Dokumen desain per role (sumber kebenaran)
├── frontend/                 Aplikasi web (TanStack Start)
│   ├── README.md, roadmap.md, CLAUDE.md
│   └── src/
│       ├── routes/           Satu berkas per halaman
│       ├── components/internspace/   Komponen halaman per role (intern, mentor, admin, shared)
│       └── lib/utils.ts      Helper tanggal/format, nama, dan validasi form sisi klien
└── backend/                  REST API (Laravel)
    ├── progress.md           Progres, keputusan, dan catatan integrasi frontend
    ├── app/Services/         Aturan bisnis (presensi, logbook, koreksi, izin, penilaian, jadwal, dashboard, laporan)
    ├── app/Http/             Controller, Form Request, Resource per role
    ├── routes/api.php        Semua endpoint (/api/intern, /api/mentor, /api/admin, bersama)
    ├── routes/console.php    Jadwal scheduler
    ├── routes/channels.php   Otorisasi channel WebSocket
    ├── database/             Migration, factory, seeder
    └── tests/Feature/        Test Pest per role
```

## Menjalankan lokal (backend + frontend)

Butuh PHP 8.3+ dengan ekstensi `pdo_pgsql` dan `zip`, Composer, PostgreSQL (port 5432; di Laragon nyalakan PostgreSQL dari menunya), Node.js, dan npm. Jalankan backend dan frontend di dua terminal.

### 1. Backend (terminal 1)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Isi `backend/.env`:

| Kunci | Nilai |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Koneksi PostgreSQL lokal. Buat databasenya dulu, misalnya `createdb -U postgres capstone_injourney` |
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` | Bebas, asal terisi. Nilai acak: `php -r "echo bin2hex(random_bytes(10));"` |
| `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` | Biarkan `localhost`, `8080`, `http` |

```bash
php artisan migrate:fresh --seed  # data contoh: 4 unit, 2 bandara + titik presensi, akun, indikator penilaian
php artisan dev                   # API :8000, Reverb (WebSocket) :8080, dan queue worker sekaligus
php artisan schedule:work         # opsional, terminal terpisah: pengingat terjadwal
```

Queue worker wajib hidup karena event chat dan notifikasi dikirim lewat queue. `php artisan dev` sudah menjalankannya; `php artisan serve` saja tidak cukup.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env
```

Isi `frontend/.env`:

| Kunci | Nilai |
| --- | --- |
| `VITE_API_URL` | `http://localhost:8000` (tanpa `/api`) |
| `VITE_REVERB_APP_KEY` | **Sama persis** dengan `REVERB_APP_KEY` di `backend/.env` |
| `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME` | Sama dengan `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` di backend |

```bash
npm run dev -- --port 5173
```

Buka `http://localhost:5173` dan masuk dengan salah satu akun contoh di bawah.

### Penting agar keduanya tersambung

- **Selalu tentukan port frontend.** Konfigurasi Lovable memakai port 8080 secara bawaan, sama dengan Reverb. Jika frontend menyala lebih dulu, Reverb gagal memakai 8080 dan real-time mati; jika backend lebih dulu, Vite pindah diam-diam ke port lain.
- **`VITE_REVERB_APP_KEY` kosong atau berbeda** membuat real-time mati tanpa pesan error: chat harus di-refresh, lonceng tidak bertambah, status online tidak tampil. Cek di DevTools > Network > WS: harus ada koneksi ke `ws://localhost:8080`.
- Vite hanya membaca `.env` saat start; restart `npm run dev` setelah mengubahnya.
- `SQLSTATE[08006]` di log backend berarti PostgreSQL belum dinyalakan.
- CORS backend di development mengizinkan `localhost` port apa pun, jadi tidak perlu mengubah `FRONTEND_URL` untuk lokal.

Tabel pemecahan masalah lengkap ada di [`frontend/progress.md`](frontend/progress.md) bagian 16.

### Akun contoh

Semua akun dari seeder memakai password `password`:

| Email | Role | Catatan |
| --- | --- | --- |
| `admin@injourney.test` | Admin | |
| `mentor@injourney.test` | Mentor | |
| `intern@injourney.test` | Intern | Bandara Soekarno-Hatta |
| `intern.baru@injourney.test` | Intern | Bandara Halim, wajib ganti password saat login pertama |

Admin pertama di production dibuat dengan `php artisan app:create-admin {email} {nama}`; password sementara tampil sekali di terminal.

Selama belum ada database production, perubahan skema ditulis langsung di migration yang ada lalu dijalankan ulang dengan `migrate:fresh --seed`. Setelah production ada, hanya boleh migration baru dengan `migrate --force`.

## Backend

### Tabel

23 tabel aplikasi ditambah `users`. Rincian kolom ada di dokumen ERD.

| Kelompok | Tabel |
| --- | --- |
| Akun dan organisasi | `units`, `users`, `intern_profiles`, `mentor_histories` |
| Lokasi dan jadwal | `airports`, `offices` (titik presensi), `airport_weekly_schedules`, `airport_special_schedules`, `holidays`, `system_settings` |
| Presensi | `attendances`, `attendance_corrections`, `leave_requests` |
| Logbook | `logbooks`, `logbook_reviews` |
| Akhir magang | `final_presentations`, `assessment_indicators`, `assessments`, `assessment_scores` |
| Komunikasi dan administrasi | `chat_messages`, `notifications`, `announcements`, `warnings`, `audit_logs` |

Status presensi, sisa kuota izin, status aktif intern, rekap, KPI, dan syarat penilaian **tidak disimpan**; semuanya dihitung dari data lain saat diminta.

### Scheduler

| Command | Jadwal | Isi |
| --- | --- | --- |
| `app:remind-overdue-leaves` | Setiap jam | Admin diingatkan izin yang belum diproses mentor lewat batas jam |
| `app:remind-ending-internships` | 07:00 | Admin diingatkan magang yang segera berakhir |
| `app:remind-presentations` | 07:00 | Intern diingatkan presentasi akhir sejak H-7 |
| `app:prune-idle-tokens` | 02:00 | Hapus token login yang sudah kedaluwarsa |

### Test

```bash
# dari root repo
(cd backend && php artisan test --parallel)   # 815 test (SQLite in-memory)
(cd frontend && npm run test)                 # Vitest
```

Test backend memakai SQLite, yang lebih longgar dari PostgreSQL (bug chat `SQLSTATE[42803]` lolos di SQLite). Sebelum rilis, jalankan juga terhadap PostgreSQL: `DB_CONNECTION=pgsql DB_DATABASE=<db_test> php vendor/bin/pest`.

## Frontend

Cara menjalankan ada di [Menjalankan lokal](#menjalankan-lokal-backend--frontend). Frontend memakai API Laravel; data contoh, `MockProvider`, dan `mock-rules.ts` sudah dihapus pada Fase 6. Status per fase, catatan verifikasi, dan bug tampilan yang tersisa ada di [`frontend/progress.md`](frontend/progress.md).

## Integrasi frontend ke backend

Panduan lengkap ada di [`backend/progress.md`](backend/progress.md), bagian **"Catatan integrasi frontend setelah rombak"**. Ringkasnya:

1. **Login** `POST /api/auth/login` → simpan `token`, kirim `Authorization: Bearer <token>` di setiap request. `user.home_path` memberi halaman pertama per role. Jika `must_change_password`, arahkan ke Ganti Password (`PUT /api/auth/password`).
2. **401** berarti sesi berakhir (termasuk setelah 30 menit tanpa aktivitas): putuskan koneksi WebSocket, kembali ke login. Jangan polling API di latar belakang.
3. **422** berisi `{message, reason}` untuk penolakan aturan atau `{message, errors}` untuk error isian. Tampilkan `message` apa adanya; teksnya sudah sesuai dokumen desain.
4. **Menu dan angka badge** dari `GET /api/{intern|mentor|admin}/menu`.
5. **WebSocket** lewat Reverb: channel privat `users.{id}`, presence `online`, otorisasi di `POST /api/broadcasting/auth` dengan Bearer token yang sama. Frontend butuh `VITE_REVERB_APP_KEY` yang sama dengan `REVERB_APP_KEY` backend.
6. **Filter bandara admin** dikirim sebagai `airport_id`; pilihan bandara dari `GET /api/admin/airports`.
7. **Export Excel dan PDF** diambil lewat `fetch` lalu disimpan sebagai blob; nama file dari header `Content-Disposition`.
8. **CORS**: development otomatis mengizinkan `localhost` port apa pun. Production mengisi `FRONTEND_URL` dengan domain Vercel.

## Deployment

| Bagian | Tempat | Status |
| --- | --- | --- |
| Frontend | Vercel | Rencana |
| Database | Supabase (PostgreSQL) | Rencana |
| Laravel API, Reverb, queue worker, scheduler | Satu host yang selalu menyala (VPS atau platform container) | Host belum dipilih |

Yang wajib disiapkan di host production:

- PHP versi aman (8.4.27, 8.5.12, atau 8.3.36 ke atas; versi lama kena CVE PHP2Shell) dengan ekstensi `pdo_pgsql` dan `zip`.
- `.env` production: `APP_ENV=production`, `APP_DEBUG=false`, koneksi Supabase, `FRONTEND_URL`, `REVERB_*`, `REVERB_ALLOWED_ORIGINS` = host frontend.
- Reverb dan queue worker dijaga Supervisor; Reverb di belakang reverse proxy lewat `wss://`.
- Cron `* * * * * php artisan schedule:run`.
- Urutan rilis: `composer install --no-dev`, `php artisan migrate --force`, `php artisan config:cache`, `php artisan route:cache`, restart Reverb dan queue worker.

## Hal yang masih terbuka

- Konfirmasi toleransi terlambat 15 menit dari mitra. (Indikator penilaian sudah ditetapkan 26 Okt 2026: 9 indikator formulir Penilaian Magang.)
- Host untuk API dan Reverb.
- Intern yang diperpanjang setelah magangnya lewat: hari jeda terbaca Tidak Hadir.
- Penanganan GPS kurang akurat dan VPN saat validasi lokasi.
- Dokumen desain masih menyebut "kantor" sebagai lokasi magang; perlu disesuaikan dengan struktur bandara dan titik presensi.

## Konvensi tim

- Commit dan push dilakukan pemilik repo (riwayat commit diperiksa dosen).
- Perubahan aturan bisnis dicatat di dokumen desain atau `backend/progress.md`, bukan sebagai komentar di kode.
- Setiap endpoint backend punya test untuk jalur berhasil dan jalur ditolak. Sebelum menyatakan selesai: `php artisan test`, `vendor/bin/pint`, `vendor/bin/phpstan analyse`.

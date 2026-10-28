# components/internspace

Komponen halaman, dikelompokkan per role. Satu folder = satu role, ditambah `shared/` untuk bagian yang dipakai lebih dari satu role. Acuan desain: `docs/design-intern.md`, `docs/design-mentor.md`, `docs/design-admin.md`. Panduan integrasi API per fitur: `frontend/progress.md`.

```
internspace/
├── intern/    menu Intern
├── mentor/    menu Mentor
├── admin/     menu Admin
└── shared/    dipakai lebih dari satu role
```

## Menu per role

`key` adalah kunci menu dari `GET /api/{role}/menu`. Angka badge menu diambil dari respons itu.

### Intern (`intern/`)

| `key` | Menu | Route | File |
|---|---|---|---|
| `dashboard` | Dashboard | `/` | `intern/dashboard.tsx` |
| `attendance` | Presensi: Hari Ini, Riwayat, Koreksi | `/absensi` | `intern/attendance.tsx`, `intern/attendance-map.tsx`, `intern/correction.tsx` |
| `logbooks` | Logbook | `/logbook` | `intern/logbook.tsx` |
| `leaves` | Izin | `/izin` | `intern/leave.tsx` |
| `presentation` | Presentasi Akhir | `/presentasi` | `intern/presentation.tsx` |
| `notes` | Catatan (warning dan nilai akhir) | `/catatan` | `intern/notes.tsx` |

### Mentor (`mentor/`)

| `key` | Menu | Route | File |
|---|---|---|---|
| `dashboard` | Dashboard | `/` | `mentor/dashboard.tsx` |
| `interns` | Intern Saya | `/intern-saya` | `mentor/interns.tsx` |
| `logbooks` | Logbook | `/logbook` | `mentor/logbook-review.tsx` |
| `corrections` | Koreksi Presensi | `/koreksi` | `mentor/corrections.tsx` |
| `leaves` | Izin | `/izin` | `shared/leave-review.tsx` |
| `leave_calendar` | Kalender Izin | `/kalender-izin` | `mentor/leave-calendar.tsx` |
| `performance` | Performa Intern | `/performa` | `mentor/performance.tsx` |
| `assessments` | Input Nilai | `/penilaian` | `mentor/assessments.tsx` |

### Admin (`admin/`)

| `key` | Menu | Route | File |
|---|---|---|---|
| `dashboard` | Dashboard | `/` | `admin/dashboard.tsx`, `admin/extend-dialog.tsx` |
| `users` | Pengguna | `/users` | `admin/users.tsx` |
| `attendance` | Presensi | `/absensi` | `admin/attendance.tsx` |
| `corrections` | Koreksi | `/koreksi` | `admin/corrections.tsx` |
| `leaves` | Izin | `/izin` | `shared/leave-review.tsx` |
| `presentations` | Presentasi Akhir | `/presentasi` | `admin/presentations.tsx` |
| `assessments` | Penilaian | `/penilaian` | `admin/assessments.tsx` |
| `warnings` | Warning | `/warning` | `admin/warnings.tsx` |
| `announcements` | Pengumuman | `/pengumuman` | `admin/announcements.tsx` |
| `reports` | Laporan (Excel dan PDF) | `/laporan` | `admin/reports.tsx` |
| `settings` | Pengaturan (Umum, Kalender Libur, Unit) | `/pengaturan` | `admin/settings.tsx` |
| `offices` | Lokasi & Jadwal (bandara, titik presensi, jadwal) | `/lokasi-kantor` | `admin/offices.tsx`, `admin/airport-form.tsx` |
| `audit_log` | Log Aktivitas | `/log` | `admin/logs.tsx` |

Komponen bersama admin: `admin/airport-filter.tsx` (filter bandara global).

## `shared/`

| File | Isi |
|---|---|
| `shell.tsx` | Sidebar per role, navbar (chat, lonceng, profil), daftar halaman yang boleh dibuka tiap role |
| `role-pages.tsx` | Pemilih komponen per role untuk route yang sama: `/`, `/absensi`, `/izin`, `/logbook`, `/koreksi`, `/presentasi`, `/penilaian` |
| `leave-review.tsx` | Daftar dan keputusan izin untuk Mentor dan Admin |
| `dashboard-parts.tsx`, `attendance-parts.tsx` | Potongan tampilan yang dipakai beberapa dashboard dan halaman presensi |
| `chat.tsx`, `chat-data.ts` | Chat semua role dan hook percakapan, pesan, presence, mengetik, tanda Dibaca |
| `notifications-data.ts` | Hook lonceng: daftar cursor, tandai dibaca, pembaruan cache dari event real-time |
| `announcement-dialog.tsx` | Dialog detail pengumuman yang dibuka dari notifikasi |
| `profile.tsx` | Profil, semua role |
| `account.tsx` | Login dan Ganti Password |
| `ui.tsx` | Komponen kecil: badge status, tab, dialog konfirmasi, tabel sederhana |

## Aturan penempatan

- Kode yang hanya dipakai satu role masuk folder role itu. Kode yang dipakai dua role atau lebih masuk `shared/`.
- Hook pengambilan data per fitur ditulis di file `*-data.ts` di folder yang sama dengan komponennya (contoh: `intern/leaves-data.ts`).
- Fungsi endpoint dan tipe respons ditulis di `src/lib/endpoints/`, bukan di komponen.
- Halaman yang alamatnya sama untuk beberapa role dipilih di `shared/role-pages.tsx`.
- Menu baru: tambahkan file di folder role, route di `src/routes/`, lalu daftarkan di `nav` dan `allowed` di `shared/shell.tsx`.
- Aturan bisnis tidak ditulis di komponen. Ikuti nilai dan flag dari respons API.
- Import memakai alias, misalnya `@/components/internspace/shared/shell`.

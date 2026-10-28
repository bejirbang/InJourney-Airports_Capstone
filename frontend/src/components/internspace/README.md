# components/internspace

Komponen halaman, dikelompokkan per role. Satu folder = satu role, ditambah `shared/` untuk bagian yang dipakai lebih dari satu role. Acuan desain: `docs/design-intern.md`, `docs/design-mentor.md`, `docs/design-admin.md`. Panduan integrasi API per fitur: `frontend/progress.md`.

```
internspace/
├── intern/    menu Intern
├── mentor/    menu Mentor
├── admin/     menu Admin
└── shared/    dipakai lebih dari satu role
```

Kolom **Status** menunjukkan kondisi file terhadap rencana integrasi: **Ada** (file sudah ada, perlu disambungkan ke API), **Baru** (belum ada, dibuat saat integrasi), **Dihapus** (dibuang di Fase 6).

## Menu per role

`key` adalah kunci menu dari `GET /api/{role}/menu`. Angka badge menu diambil dari respons itu.

### Intern (`intern/`)

| `key` | Menu | Route | File | Status |
|---|---|---|---|---|
| `dashboard` | Dashboard | `/` | `intern/dashboard.tsx` | Ada |
| `attendance` | Presensi: Hari Ini, Riwayat, Koreksi | `/absensi` | `intern/attendance.tsx`, `intern/attendance-map.tsx`, `intern/correction.tsx` | Ada |
| `logbooks` | Logbook | `/logbook` | `intern/logbook.tsx` | Baru |
| `leaves` | Izin | `/izin` | `intern/leave.tsx` | Ada |
| `presentation` | Presentasi Akhir | `/presentasi` | `intern/presentation.tsx` | Baru |
| `notes` | Catatan (warning dan nilai akhir) | `/catatan` | `intern/notes.tsx` | Baru |

### Mentor (`mentor/`)

| `key` | Menu | Route | File | Status |
|---|---|---|---|---|
| `dashboard` | Dashboard | `/` | `mentor/dashboard.tsx` | Ada |
| `interns` | Intern Saya | `/intern-saya` | `mentor/interns.tsx` | Ada |
| `logbooks` | Logbook | `/logbook` | `mentor/logbook-review.tsx` | Baru |
| `corrections` | Koreksi Presensi | `/koreksi` | `mentor/corrections.tsx` | Baru |
| `leaves` | Izin | `/izin` | `shared/leave-review.tsx` | Ada |
| `leave_calendar` | Kalender Izin | `/kalender-izin` | `mentor/leave-calendar.tsx` | Ada |
| `performance` | Performa Intern | `/performa` | `mentor/performance.tsx` | Ada |
| `assessments` | Input Nilai | `/penilaian` | `mentor/assessments.tsx` | Baru |

### Admin (`admin/`)

| `key` | Menu | Route | File | Status |
|---|---|---|---|---|
| `dashboard` | Dashboard | `/` | `admin/dashboard.tsx`, `admin/extend-dialog.tsx` | Ada |
| `users` | Pengguna | `/users` | `admin/users.tsx` | Ada |
| `attendance` | Presensi | `/absensi` | `admin/attendance.tsx` | Ada |
| `corrections` | Koreksi | `/koreksi` | `admin/corrections.tsx` | Ada |
| `leaves` | Izin | `/izin` | `shared/leave-review.tsx` | Ada |
| `presentations` | Presentasi Akhir | `/presentasi` | `admin/presentations.tsx` | Baru |
| `assessments` | Penilaian | `/penilaian` | `admin/assessments.tsx` | Baru |
| `warnings` | Warning | `/warning` | `admin/warnings.tsx` | Ada |
| `announcements` | Pengumuman | `/pengumuman` | `admin/announcements.tsx` | Ada |
| `reports` | Laporan (Excel dan PDF) | `/laporan` | `admin/reports.tsx` | Ada |
| `settings` | Pengaturan (Umum, Kalender Libur, Unit) | `/pengaturan` | `admin/settings.tsx` | Ada |
| `offices` | Lokasi & Jadwal (bandara, titik presensi, jadwal) | `/lokasi-kantor` | `admin/offices.tsx`, `admin/airport-form.tsx` (Baru) | Ada |
| `audit_log` | Log Aktivitas | `/log` | `admin/logs.tsx` | Ada |

Komponen bersama admin yang baru: `admin/airport-filter.tsx` (filter bandara global).

## `shared/`

| File | Isi | Status |
|---|---|---|
| `shell.tsx` | Sidebar per role, navbar (chat, lonceng, profil), daftar halaman yang boleh dibuka tiap role | Ada |
| `role-pages.tsx` | Pemilih komponen per role untuk route yang sama: `/`, `/absensi`, `/izin`, `/logbook`, `/koreksi`, `/presentasi`, `/penilaian` | Ada |
| `leave-review.tsx` | Daftar dan keputusan izin untuk Mentor dan Admin | Ada |
| `dashboard-parts.tsx`, `attendance-parts.tsx` | Potongan tampilan yang dipakai beberapa dashboard dan halaman presensi | Ada |
| `chat.tsx`, `chat-data.ts` | Chat semua role dan hook percakapan, pesan, presence, mengetik, tanda Dibaca | Ada |
| `notifications-data.ts` | Hook lonceng: daftar cursor, tandai dibaca, pembaruan cache dari event real-time | Ada |
| `announcement-dialog.tsx` | Dialog detail pengumuman yang dibuka dari notifikasi | Ada |
| `profile.tsx` | Profil, semua role | Ada |
| `account.tsx` | Login dan Ganti Password | Ada |
| `ui.tsx` | Komponen kecil: badge status, tab, dialog konfirmasi, tabel sederhana | Ada |
| `model.tsx` | `MockProvider`, data contoh lama | Dihapus |
| `tasks.tsx` | Kanban Task | Dihapus |

File Task lain yang dihapus: `intern/task-submit.tsx`, `intern/tasks-data.ts`, `mentor/task-form.tsx`, `mentor/task-review.tsx`.

## Aturan penempatan

- Kode yang hanya dipakai satu role masuk folder role itu. Kode yang dipakai dua role atau lebih masuk `shared/`.
- Hook pengambilan data per fitur ditulis di file `*-data.ts` di folder yang sama dengan komponennya (contoh: `intern/leaves-data.ts`).
- Fungsi endpoint dan tipe respons ditulis di `src/lib/endpoints/`, bukan di komponen.
- Halaman yang alamatnya sama untuk beberapa role dipilih di `shared/role-pages.tsx`.
- Menu baru: tambahkan file di folder role, route di `src/routes/`, lalu daftarkan di `nav` dan `allowed` di `shared/shell.tsx`.
- Aturan bisnis tidak ditulis di komponen. Ikuti nilai dan flag dari respons API.
- Import memakai alias, misalnya `@/components/internspace/shared/shell`.

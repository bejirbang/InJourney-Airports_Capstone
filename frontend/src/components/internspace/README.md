# components/internspace

Komponen halaman prototipe, dikelompokkan per role. Satu folder = satu role, ditambah `shared/` untuk bagian yang dipakai lebih dari satu role. Acuan desain: `docs/design-intern.md`, `docs/design-mentor.md`, `docs/design-admin.md`.

```
internspace/
├── intern/    menu Intern
├── mentor/    menu Mentor
├── admin/     menu Admin
└── shared/    dipakai lebih dari satu role
```

## Menu per role

### Intern (`intern/`)

| Menu | Alamat | File |
|---|---|---|
| Dashboard | `/` | `intern/dashboard.tsx` |
| Absensi: Hari Ini (clock in/out, Daily Report, simulasi posisi), Riwayat | `/absensi` | `intern/attendance.tsx` |
| Absensi: Koreksi | `/absensi?tab=koreksi` | `intern/correction.tsx` |
| Task | `/task` | `shared/tasks.tsx` (Kanban bersama), `intern/task-submit.tsx` (Kumpulkan/Ganti Hasil) |
| Izin | `/izin` | `intern/leave.tsx` |

### Mentor (`mentor/`)

| Menu | Alamat | File |
|---|---|---|
| Dashboard | `/` | `mentor/dashboard.tsx` |
| Intern Saya | `/intern-saya` | `mentor/interns.tsx` |
| Task | `/task` | `shared/tasks.tsx` (Kanban bersama), `mentor/task-form.tsx` (Buat/Ubah Task), `mentor/task-review.tsx` (Accept/Revise) |
| Izin | `/izin` | `shared/leave-review.tsx` (dipakai juga Admin) |
| Kalender Izin | `/kalender-izin` | `mentor/leave-calendar.tsx` |
| Performa Intern | `/performa` | `mentor/performance.tsx` |

### Admin (`admin/`)

| Menu | Alamat | File |
|---|---|---|
| Dashboard | `/` | `admin/dashboard.tsx` |
| Pengguna | `/users` | `admin/users.tsx`, `admin/extend-dialog.tsx` (Perpanjang magang, dipakai juga Dashboard) |
| Absensi | `/absensi` | `admin/attendance.tsx` |
| Koreksi | `/koreksi` | `admin/corrections.tsx` |
| Izin | `/izin` | `shared/leave-review.tsx` (dipakai juga Mentor) |
| Warning | `/warning` | `admin/warnings.tsx` |
| Pengumuman | `/pengumuman` | `admin/announcements.tsx` |
| Laporan | `/laporan` | `admin/reports.tsx` |
| Pengaturan | `/pengaturan` | `admin/settings.tsx` |
| Lokasi Kantor | `/lokasi-kantor` | `admin/offices.tsx` (peta Leaflet + OpenStreetMap, dimuat hanya di browser) |
| Log Aktivitas | `/log` | `admin/logs.tsx` |

## `shared/`

| File | Isi |
|---|---|
| `model.tsx` | `MockProvider`: satu sumber data contoh untuk ketiga role ("hari ini" = Sen, 12 Okt 2026) |
| `shell.tsx` | Sidebar per role, navbar (chat, bell, profil), tombol Simulasi, daftar halaman yang boleh dibuka tiap role |
| `ui.tsx` | Komponen kecil: badge status, tab, dialog konfirmasi, input file 2 MB, tabel sederhana |
| `role-pages.tsx` | Pemilih halaman per role untuk alamat yang sama: Dashboard `/`, Absensi `/absensi`, Izin `/izin` |
| `tasks.tsx` | Kanban, daftar, dan detail Task untuk Intern dan Mentor |
| `leave-review.tsx` | Daftar dan keputusan izin untuk Mentor dan Admin |
| `dashboard-parts.tsx`, `attendance-parts.tsx` | Potongan tampilan yang dipakai beberapa dashboard dan halaman absensi |
| `chat.tsx`, `profile.tsx` | Chat dan Profil, semua role |
| `account.tsx` | Login dan Ganti Password |

## Aturan penempatan

- Kode yang hanya dipakai satu role masuk folder role itu. Kode yang dipakai dua role atau lebih masuk `shared/`.
- Halaman yang alamatnya sama untuk beberapa role (`/`, `/absensi`, `/izin`) dipilih di `shared/role-pages.tsx`.
- Menu baru: tambahkan file di folder role, route di `src/routes/`, lalu daftarkan di `nav` dan `allowed` di `shared/shell.tsx`.
- Aturan PRD tetap ditulis di `src/lib/mock-rules.ts` beserta test, bukan di komponen.
- Import memakai alias, misalnya `@/components/internspace/shared/model`.

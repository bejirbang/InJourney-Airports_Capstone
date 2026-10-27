# Progress Integrasi Frontend ke Backend

Tanggal: 27 Oktober 2026
Lokasi file: `frontend/progress.md`
Status: siap dikerjakan
Untuk: tim frontend dan agent yang membantu tim frontend

Dokumen ini adalah panduan kerja untuk mengganti prototipe (data contoh) menjadi aplikasi yang tersambung ke API Laravel di `backend/`. Setiap fitur ditulis dengan pola yang sama: **file mana, diapakan, memanggil endpoint apa, mengirim apa, membaca apa, dan kapan dianggap selesai.**

---

## 0. Cara Memakai Dokumen Ini

### 0.1 Urutan sumber kebenaran

Jika ada yang bertentangan, ikuti urutan ini (nomor kecil menang):

| No | Sumber | Dipakai untuk |
|---|---|---|
| 1 | Kode backend: `backend/routes/api.php`, `backend/app/Http/Requests/`, `backend/app/Http/Resources/`, `backend/app/Services/` | Nama endpoint, field yang dikirim, field yang diterima, aturan bisnis |
| 2 | `backend/progress.md`, bagian **"Catatan integrasi frontend setelah rombak"** dan **"Catatan integrasi frontend (26 Okt 2026)"** | Rincian field per endpoint |
| 3 | `docs/design-intern.md`, `docs/design-mentor.md`, `docs/design-admin.md` | Tampilan, teks UI, urutan langkah |
| 4 | Dokumen ini | Urutan kerja dan pembagian file frontend |
| 5 | Prototipe frontend yang sekarang | **Bukan acuan aturan.** Masih berbasis Task, Daily Report, dan upload file yang sudah dihapus |

Catatan di `backend/progress.md` bagian **"Selesai"** paling atas (Task, Daily Report, upload foto, `/evidence`) adalah **catatan lama**. Jangan dipakai.

### 0.2 Cara kerja

1. Kerjakan per **fase** secara berurutan (Fase 0 sampai Fase 6). Fase 0 wajib selesai sebelum fase lain.
2. Di dalam satu fase, kerjakan per fitur. Setiap fitur punya daftar **"Selesai jika"**. Centang di bagian 14 (Log Progres) setelah selesai.
3. **Jangan mengubah `backend/`.** Jika butuh perubahan backend, tulis di bagian 13 (Permintaan ke Backend) dan beri tahu tim backend.
4. Jika ragu soal field, cek respons nyata (Network tab browser) atau baca file Resource/Service yang disebut. Jangan menebak nama field.

### 0.3 Arti kolom "Aksi"

| Aksi | Arti |
|---|---|
| **Ubah** | File sudah ada, ganti sumber data dari `useMock()` ke API, sesuaikan field |
| **Buat** | File belum ada, buat baru |
| **Hapus** | File atau bagian kode dibuang karena fiturnya sudah tidak ada di backend |
| **Tetap** | Tidak perlu diubah |

---

## 1. Kondisi Saat Ini

### 1.1 Ringkasan

| Area | Kondisi frontend sekarang | Kondisi backend | Aksi |
|---|---|---|---|
| Login, ganti password | Sudah ke API (`lib/auth.tsx`) | Ada | Ubah sedikit (field user berubah) |
| Profil | Ke API, tapi masih kirim `name` dan upload foto | Hanya `phone`, tanpa foto | Ubah |
| Absensi intern | Sebagian ke API, masih pakai Daily Report | Daily Report diganti Logbook | Ubah besar |
| Izin intern | Ke API, masih upload file bukti | Bukti berupa link Google Drive/Docs | Ubah |
| Task (intern dan mentor) | Ke API lama dan mock | **Endpoint Task sudah dihapus** | **Hapus** |
| Logbook (intern dan mentor) | Belum ada | Ada | **Buat** |
| Koreksi presensi intern | Mock, masih pakai jam dan bukti file | Hanya `date` + `reason`, dua tahap (mentor lalu admin) | Ubah besar |
| Koreksi mentor | Belum ada | Ada | **Buat** |
| Presentasi akhir (intern dan admin) | Belum ada | Ada | **Buat** |
| Catatan dan nilai (intern) | Belum ada | Ada | **Buat** |
| Input Nilai mentor, Penilaian admin | Belum ada | Ada | **Buat** |
| Semua halaman mentor dan admin lain | Mock (`useMock()`) | Ada | Ubah |
| Lokasi Kantor admin | Mock, satu tingkat (kantor) | Dua tingkat: bandara + titik presensi + jadwal | Ubah besar |
| Pengaturan admin | Mock, jam kerja global | Jam kerja pindah ke bandara; ada Pengaturan Umum dan Unit | Ubah besar |
| Laporan admin | Mock | Excel 4 sheet + 2 PDF | Ubah |
| Lonceng dan chat | Mock | REST + WebSocket (Reverb) | Ubah |

### 1.2 File frontend yang sudah memanggil API

`src/lib/api.ts`, `src/lib/auth.tsx`, `shared/account.tsx`, `shared/profile.tsx`, `shared/shell.tsx`, `shared/role-pages.tsx`, `shared/tasks.tsx`, `intern/attendance.tsx`, `intern/leave.tsx`, `intern/leaves-data.ts`, `intern/tasks-data.ts`.

Semua file lain di `src/components/internspace/` masih memakai `useMock()` dari `shared/model.tsx`.

---

## 2. Aturan Wajib

### 2.1 Ubah aturan prototipe lebih dulu

Versi lama `frontend/AGENTS.md` melarang autentikasi dan penyimpanan sungguhan ("Keep this delivery a client-side interactive prototype..."), dan `frontend/CLAUDE.md` masih berisi keputusan lama (Task, Daily Report, upload file). Versi baru file-file ini **sudah disediakan bersama dokumen ini** dan harus terpasang di repo **sebelum** agent mulai bekerja.

| File | Aksi | Isi versi baru |
|---|---|---|
| `frontend/AGENTS.md` | Ganti | Batasan wajib integrasi. Blok `LOVABLE:BEGIN/END` tetap |
| `frontend/CLAUDE.md` | Ganti | Struktur kode baru, warna status, ringkasan keputusan produk per 27 Okt 2026 |
| `frontend/roadmap.md` | Ganti | Tahap prototipe (selesai) dan tahap integrasi per fase |
| `frontend/README.md` | Ganti | Cara menjalankan dan daftar dokumen |
| `frontend/src/components/internspace/README.md` | Ganti | Peta menu per role ke file, dengan status Ada/Baru/Dihapus |
| `frontend/.env.example` | Ganti | `VITE_API_URL` dan `VITE_REVERB_*` |

Jika agent menemukan isi yang bertentangan dengan file-file di atas di tempat lain (misalnya komentar kode prototipe), file-file di atas yang berlaku.

### 2.2 Aturan integrasi

1. **Aturan bisnis ada di server.** Jangan menghitung ulang status presensi, nilai akhir, predikat, kuota izin, atau hak akses di frontend. Tampilkan nilai dari respons.
2. **Tombol mengikuti flag dari server.** Contoh: `can_cancel`, `can_decide`, `can_submit`, `can_clock_out`, `can_request_correction`, `can_edit`, `can_assess`, `action`. Jangan menulis aturan sendiri untuk menyalakan atau mematikan tombol.
3. **Pesan dari server ditampilkan apa adanya.** Teks `message` sudah sesuai dokumen desain.
4. **Tidak ada upload file.** Bukti izin dan presentasi berupa link Google Drive atau Google Docs (`evidence_url`). Foto profil tidak ada, avatar dari inisial nama.
5. **Jangan polling.** Jangan memanggil API berkala di latar belakang. Sesi berakhir setelah 30 menit tanpa aktivitas, dan polling akan menjaga sesi tetap hidup. Pembaruan real-time lewat WebSocket.
6. **Tanggal dikirim dan diterima sebagai teks** `YYYY-MM-DD`, bulan `YYYY-MM`, jam `HH:MM`. Untuk menampilkan, pakai `parseISO` dari `date-fns`. **Jangan** `new Date("2026-10-12")` karena dibaca sebagai UTC dan bisa bergeser satu hari.
7. Teks UI bahasa Indonesia, format tanggal "Sen, 12 Okt 2026", jam 24 jam.
8. Git: `git pull` sebelum mengedit. Jangan force push, rebase, atau amend commit yang sudah di-push (repo tersambung ke Lovable).

### 2.3 Penanganan respons standar

| Status | Arti | Yang dilakukan frontend |
|---|---|---|
| 200, 201 | Berhasil | Toast dari `message` jika ada, muat ulang data terkait |
| 401 | Token tidak berlaku atau sesi habis | Hapus token, putuskan WebSocket, ke `/login`. Sudah ditangani `request()` di `api.ts` lewat `UNAUTHORIZED_EVENT` |
| 403 | Akun nonaktif, masa magang di luar periode, atau bukan haknya | Jika pesan soal akun/masa magang: perlakukan seperti 401. Selain itu tampilkan `message` |
| 404 | Data tidak ada atau bukan milik pengguna | Tampilkan "Data tidak ditemukan." |
| 422 dengan `reason` | Ditolak aturan bisnis | Tampilkan `message`. Beberapa `reason` punya perilaku khusus, disebut per fitur |
| 422 dengan `errors` | Error isian form | Tampilkan pesan di bawah field yang sesuai (`errors.nama_field[0]`) |
| 429 | Terlalu sering (login, chat, export) | "Terlalu banyak permintaan, coba lagi sebentar." |
| 500 | Error server | "Terjadi kesalahan pada server. Coba lagi nanti." |

`ApiError` di `src/lib/api.ts` sudah menyimpan `status`, `fields` (`errors`), dan `reason`. Pakai itu.

---

## 3. Persiapan Lingkungan

### 3.1 Backend (lokal)

```bash
cd backend
composer install
cp .env.example .env        # sekali saja, lalu isi REVERB_APP_ID/KEY/SECRET
php artisan key:generate    # sekali saja
php artisan migrate:fresh --seed
php artisan dev             # API + Reverb + queue sekaligus
php artisan schedule:work   # terminal lain, untuk pengingat terjadwal
```

API berjalan di `http://localhost:8000`, Reverb di port `8080`.

Akun contoh (password semua `password`):

| Email | Role | Catatan |
|---|---|---|
| `admin@injourney.test` | Admin | |
| `mentor@injourney.test` | Mentor | |
| `intern@injourney.test` | Intern | |
| `intern.baru@injourney.test` | Intern | Wajib ganti password saat login pertama |

### 3.2 Frontend

| File | Aksi | Isi |
|---|---|---|
| `frontend/.env.example` | Ganti | Versi baru sudah disediakan (isi di bawah) |
| `frontend/.env` | Buat (lokal, jangan di-commit) | Salin dari `.env.example`, isi `VITE_REVERB_APP_KEY` sama dengan `REVERB_APP_KEY` di `backend/.env` |

```env
# URL dasar API Laravel (tanpa /api di belakang).
VITE_API_URL=http://localhost:8000

# WebSocket Reverb, samakan dengan backend/.env
VITE_REVERB_APP_KEY=
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

CORS untuk `localhost` port apa pun sudah diizinkan backend saat development.

---

## 4. Fase 0: Fondasi

Selesaikan fase ini lebih dulu. Semua fase berikutnya bergantung pada fondasi ini.

### 4.1 Struktur file baru

| File | Aksi | Isi |
|---|---|---|
| `src/lib/api.ts` | Ubah | Tetap jadi **inti klien HTTP**: `request()`, `ApiError`, token, `unwrap`. Ekspor `request` dan `unwrap`. Tambah `downloadFile()` (4.4). **Pindahkan** `attendanceApi`, `leaveApi`, `authApi` ke `src/lib/endpoints/`. **Hapus** `taskApi` dan semua tipe Task, serta fungsi `dailyReport` |
| `src/lib/endpoints/auth.ts` | Buat | `authApi` (login, me, logout, changePassword, updateProfile). Tanpa `uploadPhoto` |
| `src/lib/endpoints/shared.ts` | Buat | Notifikasi, chat, pengumuman |
| `src/lib/endpoints/intern.ts` | Buat | Semua endpoint `/api/intern/*` beserta tipenya |
| `src/lib/endpoints/mentor.ts` | Buat | Semua endpoint `/api/mentor/*` beserta tipenya |
| `src/lib/endpoints/admin.ts` | Buat | Semua endpoint `/api/admin/*` beserta tipenya |
| `src/lib/labels.ts` | Buat | Peta nilai API ke label Indonesia (4.6) |
| `src/lib/navigation.ts` | Buat | Peta menu `key` ke route dan peta `link_path` notifikasi ke route (4.3, 4.5) |
| `src/lib/realtime.ts` | Buat (Fase 5) | Koneksi Laravel Echo + Reverb |
| `src/components/internspace/<role>/*-data.ts` | Buat | Hook React Query per fitur, mengikuti pola `intern/leaves-data.ts` |

Alasan memakai folder `endpoints/` dan bukan `api/`: file `api.ts` dan folder `api/` dengan nama sama membingungkan import `@/lib/api`.

### 4.2 Pola pengambilan data (React Query)

`@tanstack/react-query` sudah terpasang dan `QueryClientProvider` sudah ada di `src/routes/__root.tsx`. Contoh pola yang sudah benar ada di `src/components/internspace/intern/leaves-data.ts`. Ikuti pola ini untuk semua fitur:

```ts
// src/lib/endpoints/intern.ts
import { request, unwrap, internToken } from "@/lib/api";

export interface LogbookListItem { /* isi sesuai respons nyata */ }

export const internLogbookApi = {
  list: (params: { month?: string; status?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<{ data: LogbookListItem[]; meta: unknown }>(`/api/intern/logbooks?${q}`, { token: internToken() });
  },
  save: (date: string, body: { work: string; notes?: string | null }) =>
    request<{ message: string; data: unknown }>(`/api/intern/logbooks/${date}`, { method: "PUT", body, token: internToken() }),
};
```

```ts
// src/components/internspace/intern/logbook-data.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internLogbookApi } from "@/lib/endpoints/intern";

export const logbookKeys = { all: ["intern", "logbooks"] as const };

export const useLogbooks = (month?: string, status?: string) =>
  useQuery({ queryKey: [...logbookKeys.all, month, status], queryFn: () => internLogbookApi.list({ month, status }) });

export const useSaveLogbook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { date: string; work: string; notes?: string }) => internLogbookApi.save(v.date, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: logbookKeys.all });
      void qc.invalidateQueries({ queryKey: ["intern", "dashboard"] });
    },
  });
};
```

Aturan pola:

1. Satu `queryKey` dasar per fitur, diawali nama role: `["intern", "logbooks"]`, `["mentor", "logbooks"]`, `["admin", "users"]`.
2. Setelah mutasi berhasil, `invalidateQueries` untuk data fitur itu **dan** dashboard serta menu role tersebut (angka badge bisa berubah).
3. Setiap halaman wajib punya tiga kondisi: **memuat** (skeleton), **kosong** (teks dari dokumen desain), **gagal** (pesan + tombol "Coba lagi").
4. Set `defaultOptions.queries.refetchOnWindowFocus: false` di `new QueryClient()` (`src/router.tsx`) agar tidak memanggil API diam-diam (aturan 2.2 no. 5).

### 4.3 Peta route, menu, dan file

Frontend **tetap memakai route pendek yang sudah ada** (`/absensi`, `/izin`, dan seterusnya). Path di respons `GET /api/{role}/menu` (misalnya `/intern/dashboard`) dan `user.home_path` **tidak dipakai** sebagai alamat. Yang dipakai hanya `key` dan `badge`.

Route yang sama untuk beberapa role dipilih di `shared/role-pages.tsx` (seperti `/`, `/absensi`, `/izin` sekarang).

**Intern** (`GET /api/intern/menu`)

| `key` | Label menu | Route | File komponen | Aksi |
|---|---|---|---|---|
| `dashboard` | Dashboard | `/` | `intern/dashboard.tsx` | Ubah |
| `attendance` | Presensi | `/absensi` | `intern/attendance.tsx`, `intern/correction.tsx`, `intern/attendance-map.tsx` | Ubah |
| `logbooks` | Logbook | `/logbook` | `intern/logbook.tsx` | **Buat** |
| `leaves` | Izin | `/izin` | `intern/leave.tsx` | Ubah |
| `presentation` | Presentasi Akhir | `/presentasi` | `intern/presentation.tsx` | **Buat** |
| `notes` | Catatan | `/catatan` | `intern/notes.tsx` | **Buat** |

**Mentor** (`GET /api/mentor/menu`)

| `key` | Label menu | Route | File komponen | Aksi |
|---|---|---|---|---|
| `dashboard` | Dashboard | `/` | `mentor/dashboard.tsx` | Ubah |
| `interns` | Intern Saya | `/intern-saya` | `mentor/interns.tsx` | Ubah |
| `logbooks` | Logbook | `/logbook` | `mentor/logbook-review.tsx` | **Buat** |
| `corrections` | Koreksi Presensi | `/koreksi` | `mentor/corrections.tsx` | **Buat** |
| `leaves` | Izin | `/izin` | `shared/leave-review.tsx` | Ubah |
| `leave_calendar` | Kalender Izin | `/kalender-izin` | `mentor/leave-calendar.tsx` | Ubah |
| `performance` | Performa Intern | `/performa` | `mentor/performance.tsx` | Ubah |
| `assessments` | Input Nilai | `/penilaian` | `mentor/assessments.tsx` | **Buat** |

**Admin** (`GET /api/admin/menu`)

| `key` | Label menu | Route | File komponen | Aksi |
|---|---|---|---|---|
| `dashboard` | Dashboard | `/` | `admin/dashboard.tsx`, `admin/extend-dialog.tsx` | Ubah |
| `users` | Pengguna | `/users` | `admin/users.tsx` | Ubah besar |
| `attendance` | Presensi | `/absensi` | `admin/attendance.tsx` | Ubah |
| `corrections` | Koreksi | `/koreksi` | `admin/corrections.tsx` | Ubah |
| `leaves` | Izin | `/izin` | `shared/leave-review.tsx` | Ubah |
| `presentations` | Presentasi Akhir | `/presentasi` | `admin/presentations.tsx` | **Buat** |
| `assessments` | Penilaian | `/penilaian` | `admin/assessments.tsx` | **Buat** |
| `warnings` | Warning | `/warning` | `admin/warnings.tsx` | Ubah |
| `announcements` | Pengumuman | `/pengumuman` | `admin/announcements.tsx` | Ubah |
| `reports` | Laporan | `/laporan` | `admin/reports.tsx` | Ubah |
| `settings` | Pengaturan | `/pengaturan` | `admin/settings.tsx` | Ubah besar |
| `offices` | Lokasi & Jadwal | `/lokasi-kantor` | `admin/offices.tsx` | Ubah besar |
| `audit_log` | Log Aktivitas | `/log` | `admin/logs.tsx` | Ubah |

**Route baru** yang perlu dibuat di `src/routes/`: `logbook.tsx`, `presentasi.tsx`, `catatan.tsx`, `penilaian.tsx`. Route yang dibagi beberapa role (`/logbook`, `/koreksi`, `/presentasi`, `/penilaian`) memilih komponennya di `shared/role-pages.tsx`.

**Route yang dihapus:** `src/routes/task.tsx`.

Setiap route baru juga harus didaftarkan di `allowed` dan `nav` di `shared/shell.tsx`. `routeTree.gen.ts` dibuat otomatis, jangan diedit.

### 4.4 Unduhan file (Excel dan PDF)

Endpoint export memakai **POST dengan body JSON** dan butuh header Authorization, jadi tidak bisa memakai `<a href>`. Fungsi `downloadAttachment` di `api.ts` hanya GET.

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/lib/api.ts` | Ubah | Ganti `downloadAttachment` dengan `downloadFile(path, { method, body, fallbackName })`. Kirim JSON, ambil `response.blob()`, nama file dari `Content-Disposition` (fungsi `downloadName` sudah ada), lalu simpan lewat `URL.createObjectURL` + elemen `<a download>`. Jika `!response.ok`, baca body sebagai **JSON** dan lempar `ApiError` (error tetap JSON, bukan file) |

### 4.5 Peta tujuan klik notifikasi

Notifikasi dari backend punya `link_path` dan `link_params`. Petakan di `src/lib/navigation.ts`:

| `link_path` | Penerima | Route frontend | `link_params` |
|---|---|---|---|
| `/` | Semua | `/` | Pengumuman: `{announcement}` = id, buka detail pengumuman |
| `/presensi` | Intern | `/absensi` | `{tab: "koreksi", open}` = id koreksi |
| `/logbook` | Intern | `/logbook` | `{date}` = tanggal logbook |
| `/logbook` | Mentor | `/logbook` | `{open}` = id logbook |
| `/koreksi` | Mentor, admin | `/koreksi` | `{open}` = id koreksi |
| `/izin` | Semua | `/izin` | `{open}` = id izin (pembatalan tanpa params) |
| `/presentasi` | Intern, admin | `/presentasi` | Admin: `{open}` = id presentasi |
| `/penilaian` | Mentor, admin | `/penilaian` | `{open}` = **id intern** (bukan id penilaian) |
| `/catatan` | Intern | `/catatan` | - |
| `/intern-saya` | Mentor | `/intern-saya` | `{open, tab: "catatan"}` |
| `/chat` | Semua | `/chat` | `{to}` = **id pengguna** pengirim |

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/lib/search.ts` | Ubah | Tambah parameter `date` (dipakai `/logbook` intern). `to` sekarang berupa **id angka**, bukan nama |

### 4.6 Label status

Taruh di `src/lib/labels.ts`. Jika teks berbeda dengan dokumen desain bagian "Aturan Tampilan", ikuti dokumen desain.

| Kelompok | Nilai API → Label |
|---|---|
| Status presensi | `present` Hadir, `late` Terlambat, `missed_clock_in` Lupa Clock In, `leave` Izin, `absent` Tidak Hadir, `holiday` Libur, `not_clocked_in` Belum Clock In |
| Tanda presensi (bukan status) | `missed_clock_out: true` → "Lupa Clock Out", `is_corrected: true` → "Dikoreksi" |
| Logbook | `draft` Draft, `pending_review` Menunggu Review, `revision` Revisi, `approved` Disetujui, `missing` Belum Diisi |
| Koreksi | `pending_mentor` Menunggu Mentor, `rejected_by_mentor` Ditolak Mentor, `pending_admin` Menunggu Admin, `approved` Disetujui, `rejected_by_admin` Ditolak Admin, `cancelled` Dibatalkan |
| Izin | `pending` Menunggu, `approved` Disetujui, `rejected` Ditolak, `cancelled` Dibatalkan |
| Jenis izin | `sick` Izin Sakit, `urgent` Izin Urgent |
| Presentasi | `not_open` Belum Dibuka, `not_submitted` Belum Dikirim, `pending` Menunggu, `revision` Revisi, `approved` Disetujui |
| Penilaian | `ready` Siap Dinilai, `blocked` Belum Bisa Dinilai, `draft` Draft, `submitted` Sudah Disubmit |
| Jenis institusi | `universitas` Universitas, `sekolah` Sekolah |
| Hari (`day_of_week`) | 1 Senin, 2 Selasa, 3 Rabu, 4 Kamis, 5 Jumat, 6 Sabtu, 7 Minggu (standar ISO) |

**Selesai jika (Fase 0):**
- [ ] Versi baru `AGENTS.md`, `CLAUDE.md`, `roadmap.md`, `README.md`, `internspace/README.md`, `.env.example` sudah terpasang
- [ ] `src/lib/endpoints/` dibuat, `taskApi` dan Daily Report hilang dari `api.ts`
- [ ] `downloadFile()`, `navigation.ts`, `labels.ts` ada dan punya test sederhana
- [ ] `npm run test`, `npm run lint`, `npm run build` lulus

---

## 5. Fase 1: Autentikasi, Shell, Profil

### 5.1 Login dan ganti password

**Acuan:** design-intern.md §3, design-mentor.md §3, design-admin.md §3

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/lib/auth.tsx` | Ubah | Pakai `authApi` dari `endpoints/auth.ts`. Hapus `uploadPhoto`. `updateProfile` hanya mengirim `phone` |
| `src/lib/endpoints/auth.ts` | Buat | Tipe `ApiUser` baru (di bawah) |
| `shared/account.tsx` | Ubah | Setelah login, ke `/` (**bukan** `user.home_path`). Jika `must_change_password` true, ke `/ganti-password` |

| Endpoint | Kirim | Baca |
|---|---|---|
| `POST /api/auth/login` | `{email, password}` | `token`, `user` (**tidak** dibungkus `data`) |
| `GET /api/auth/me` | - | `data` (user) |
| `POST /api/auth/logout` | - | - |
| `PUT /api/auth/password` | `{password, password_confirmation}` | `data` (user). Password minimal 8 karakter, berisi huruf dan angka |

Tipe user yang benar (lihat `backend/app/Http/Resources/UserResource.php`):

```ts
export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: "intern" | "mentor" | "admin";
  unit: { id: number; name: string } | null;      // menggantikan title
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  home_path: string;                               // diabaikan frontend
  intern_profile?: {
    mentor: { id: number; name: string };
    airport: { id: number; name: string };
    institution_type: "universitas" | "sekolah" | null;
    university: string;
    major: string;
    student_number: string | null;
    start_date: string;
    end_date: string;
  };
}
```

Field **yang sudah tidak ada**: `title`, `photo_url`, `intern_profile.mentor_id`.

**Perhatikan:**
- Login dibatasi 5 percobaan per menit (429).
- Intern di luar periode magang ditolak saat login (403, "Masa magang Anda belum dimulai." atau akun nonaktif).
- Ganti password membuat sesi lain keluar.

### 5.2 Shell: sidebar, badge, role

| File | Aksi | Yang dilakukan |
|---|---|---|
| `shared/shell.tsx` | Ubah | Role diambil dari `useAuth().user.role` (pakai `toMockRole`), **bukan** dari `useMock()`. Badge menu dari `GET /api/{role}/menu` (`data[].key`, `badge`). Hapus menu Task. Tambah menu baru sesuai 4.3. Hapus tombol **Simulasi** (di Fase 6, setelah semua halaman tersambung) |
| `shared/role-pages.tsx` | Ubah | Tambah pemilih komponen untuk `/logbook`, `/koreksi`, `/presentasi`, `/penilaian` |

| Endpoint | Baca |
|---|---|
| `GET /api/intern/menu`, `GET /api/mentor/menu`, `GET /api/admin/menu` | `data[]`: `key`, `path` (abaikan), `badge` (angka atau `null`) |

Muat ulang menu setelah mutasi yang mengubah angka (misalnya setujui logbook, kirim logbook revisi).

### 5.3 Profil

**Acuan:** design-intern.md §3, design-mentor.md §3, design-admin.md §16

| File | Aksi | Yang dilakukan |
|---|---|---|
| `shared/profile.tsx` | Ubah | **Hanya nomor telepon yang bisa diubah.** Nama, email, unit, dan data magang hanya tampil. Hapus upload foto. Avatar = inisial nama (`initials()` sudah ada) |

| Endpoint | Kirim | Catatan |
|---|---|---|
| `PUT /api/auth/profile` | `{phone}` | Field `phone` **wajib dikirim**, boleh `null`/kosong. Format: angka, boleh diawali `+`, spasi dan `-` boleh, maks 20 |

**Selesai jika (Fase 1):**
- [ ] Login ketiga akun contoh berhasil dan masuk ke `/`
- [ ] `intern.baru@injourney.test` diarahkan ke Ganti Password lebih dulu
- [ ] Sidebar per role sesuai tabel 4.3, badge dari API
- [ ] Profil hanya bisa mengubah telepon
- [ ] 401 mengembalikan ke `/login`

---

## 6. Fase 2: Intern

### 6.1 Dashboard intern

**Acuan:** design-intern.md §4

| File | Aksi | Yang dilakukan |
|---|---|---|
| `intern/dashboard.tsx` | Ubah | Ganti `useMock()` dengan `useInternDashboard()`. Hapus kotak Task. Tambah banner presentasi, kotak "Perlu ditindak", sisa kuota izin |
| `intern/dashboard-data.ts` | Buat | Hook `useInternDashboard()` |
| `shared/dashboard-parts.tsx` | Ubah | Bagian yang dipakai intern disesuaikan field baru |

| Endpoint | Baca |
|---|---|
| `GET /api/intern/dashboard` | `today`, `logbook_reminder`, `action_needed` (`logbooks`, `warnings`, `corrections`, `leaves`), `monthly_recap`, `leave_quota`, `presentation_banner`, `internship`, `announcements` |

Isi `today` (kartu Hari Ini):

| Field | Pakai untuk |
|---|---|
| `state` | `not_clocked_in` → tombol Clock In; `clocked_in` → tombol Clock Out; `missed_clock_in` (lewat jam pulang tanpa clock in) → tombol Clock Out; `clocked_out`, `holiday`, `on_leave`, `outside_period` → tanpa tombol |
| `schedule` | Jam kerja hari ini |
| `status` | Status presensi hari ini |
| `clock_in_at`, `clock_out_at`, `late_minutes` | Jam dan tanda Terlambat |
| `clock_out_from` | Jam paling cepat boleh clock out |
| `can_clock_out` | Menyalakan tombol Clock Out |
| `logbook` | Status logbook hari ini |
| `has_active_office` | `false` → tombol nonaktif, teks "Belum ada kantor aktif." |

**Perhatikan:**
- `monthly_recap` hanya berisi status final sampai kemarin. Jangan menambahkan hari ini sendiri.
- `presentation_banner` hanya ada sejak formulir presentasi terbuka sampai disetujui. Jika `null`, sembunyikan.

### 6.2 Presensi Hari Ini: Clock In dan Clock Out

**Acuan:** design-intern.md §5, §6, §7

| File | Aksi | Yang dilakukan |
|---|---|---|
| `intern/attendance.tsx` | Ubah besar | Tab Hari Ini: kartu dari `today` dashboard. **Hapus seluruh formulir Daily Report**. Clock Out membuka **dialog logbook** (isi kegiatan) lalu mengirim clock out sekaligus. Hapus simulasi posisi (`LocationSim`) setelah lokasi nyata berfungsi |
| `intern/attendance-map.tsx` | Ubah | Titik dan radius dari `GET /api/intern/offices` |
| `intern/attendance-data.ts` | Buat | Hook dashboard, offices, clock in, clock out |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/intern/offices` | - | `data[]`: `id`, `name`, `latitude`, `longitude`, `clock_in_radius_meters`, `clock_out_radius_meters`. Hanya titik aktif milik bandara intern |
| `POST /api/intern/attendance/clock-in` | `{latitude, longitude}` | 201 `message`, `data` |
| `POST /api/intern/attendance/clock-out` | `{latitude, longitude, work?, notes?}` | 200 `message`, `data` |

**Alur Clock In:**
1. Ambil posisi dengan `navigator.geolocation.getCurrentPosition` (`enableHighAccuracy: true`).
2. Tampilkan peta dan perkiraan jarak ke titik terdekat (Haversine di browser, **hanya informasi**).
3. Kirim `latitude`, `longitude`. Server yang memutuskan masuk radius atau tidak, dan memilih titik terdekat yang masuk radius sendiri. Pilihan titik di dropdown **tidak dikirim**.
4. Berhasil: toast `message` (contoh "Clock in berhasil pukul 08:20. Anda tercatat Terlambat 20 menit."), muat ulang dashboard.

**Alur Clock Out:**
1. Tombol aktif jika `today.can_clock_out`.
2. Jika logbook hari ini belum terkirim, buka dialog isi logbook (`work` wajib, `notes` opsional).
3. Kirim posisi + `work` + `notes` dalam **satu** permintaan clock out.
4. Untuk `state = missed_clock_in`: `work` **wajib** dikirim, karena server membuat baris presensi dan logbook sekaligus.
5. Berhasil: toast `message` (contoh "Clock out berhasil pukul 17:03. Logbook terkirim ke mentor.").

**Penolakan (422 `reason`):**

| `reason` | Kapan | Perilaku frontend |
|---|---|---|
| `outside_radius` | Di luar radius | Tampilkan `message` + tombol **Coba lagi** |
| `no_active_office` | Tidak ada titik aktif | `message`, tombol nonaktif |
| `outside_period`, `holiday`, `on_leave` | Clock in di hari yang tidak boleh | `message` |
| `already_clocked_in`, `already_clocked_out`, `not_clocked_in` | Status sudah berubah | `message`, muat ulang dashboard |
| `after_work_end` | Clock in setelah jam pulang | `message` |
| `before_work_end` | Clock out sebelum jam pulang | `message` (berisi sisa waktu) |
| `logbook_missing` | Clock out tanpa logbook | Buka dialog logbook |

Izin ditolak lokasi browser: tampilkan "Izinkan akses lokasi untuk melakukan presensi." dan jangan memanggil API.

### 6.3 Logbook intern

**Acuan:** design-intern.md §6 dan §10

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/routes/logbook.tsx` | Buat | Route `/logbook`, isi dari `role-pages.tsx` |
| `intern/logbook.tsx` | Buat | Daftar logbook per hari kerja + filter bulan dan status + detail + form isi/ubah |
| `intern/logbook-data.ts` | Buat | Hook daftar, detail, simpan |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/intern/logbooks?month=YYYY-MM&status=` | `status`: `draft`, `pending_review`, `revision`, `approved`, `missing` | Daftar per hari kerja, `action_needed` |
| `GET /api/intern/logbooks/{date}` | - | Isi logbook, `logbook_state`, riwayat review (komentar mentor), `action` |
| `PUT /api/intern/logbooks/{date}` | `{work, notes}` | `message`, data terbaru |

**Arti `action` (ditentukan server, frontend hanya mengikuti):**

| `action` | Kapan | Tombol |
|---|---|---|
| `save` | Hari ini, sebelum clock out | "Simpan" (masih draft, bisa diubah) |
| `submit` | Hari yang sudah dikoreksi tapi logbook belum terkirim (`logbook_state = missing`) | "Kirim" (langsung Menunggu Review) |
| `resubmit` | Logbook berstatus Revisi | "Kirim Ulang" |
| `null` | Terkunci | Tanpa tombol |

**Perhatikan:**
- Hari Lupa Clock Out yang belum dikoreksi tetap `draft` dan **terkunci**. Jika intern mencoba menyimpan, server menolak dengan 422 `reason: needs_correction`. Tampilkan `message` dan ajakan untuk mengajukan koreksi.
- Link dari notifikasi membawa `?date=YYYY-MM-DD`. Buka detail tanggal itu.
- Satu logbook per hari. Tidak ada tombol hapus.

### 6.4 Riwayat presensi

**Acuan:** design-intern.md §8

| File | Aksi | Yang dilakukan |
|---|---|---|
| `intern/attendance.tsx` (tab Riwayat) | Ubah | Ganti field lama |
| `shared/attendance-parts.tsx` | Ubah | Badge status dan tanda mengikuti 4.6 |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/intern/attendance?month=YYYY-MM&status=` | `status`: `present`, `late`, `missed_clock_in`, `leave`, `absent`, `holiday`, `missed_clock_out` | `recap`, `days[]`, `selectable_months` |
| `GET /api/intern/attendance/days/{date}` | - | Detail satu hari: titik clock in dan out, logbook |

Field per baris `days[]` yang **berganti nama**:

| Lama (jangan dipakai) | Baru |
|---|---|
| `daily_report_sent`, `daily_report*` | `logbook`, `logbook_state`, `logbook_work` |
| `has_pending_correction` | `has_active_correction` |
| status `ongoing`, status `missed_clock_out` | Tidak ada. Lupa Clock Out jadi tanda `missed_clock_out: true` |

Tombol **Ajukan Koreksi** muncul hanya jika `can_request_correction` true.

`recap` berisi: `present`, `late`, `missed_clock_in`, `leave`, `absent`, `missed_clock_out`, `corrected`, `working_days`.

Navigasi bulan dibatasi `selectable_months`.

### 6.5 Koreksi presensi intern

**Acuan:** design-intern.md §9

| File | Aksi | Yang dilakukan |
|---|---|---|
| `intern/correction.tsx` | Ubah besar | **Hapus** isian jam masuk, jam keluar, dan upload bukti. Form hanya **tanggal + alasan**. Status dua tahap (mentor lalu admin) |
| `intern/correction-data.ts` | Buat | Hook daftar, detail, ajukan, batalkan |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/intern/attendance-corrections` | - | Daftar: `date`, `status`, `recorded_status`, `recorded_missed_clock_out`, `reason`, `mentor` + `mentor_note`, `admin` + `admin_note` |
| `POST /api/intern/attendance-corrections` | `{date, reason}` (alasan maks 1000) | 201 `message` |
| `GET /api/intern/attendance-corrections/{id}` | - | Detail, `can_cancel` |
| `POST /api/intern/attendance-corrections/{id}/cancel` | - | 422 "Data ini sudah diproses oleh [nama]." jika sudah diputuskan |

**Alur:** intern ajukan → mentor ACC atau tolak → jika ACC, admin setujui atau tolak → jika disetujui, hari itu jadi **Hadir** dengan tanda Dikoreksi, lalu logbook hari itu muncul sebagai `missing` di menu Logbook untuk diisi.

**Perhatikan:**
- Hanya hari kerja yang sudah lewat, berstatus Terlambat, Lupa Clock In, Tidak Hadir, atau bertanda Lupa Clock Out. Server yang menolak jika tidak memenuhi; frontend cukup menawarkan dari tombol di Riwayat (`can_request_correction`).
- Satu pengajuan aktif per tanggal.
- Link notifikasi: `/absensi?tab=koreksi&open={id}`.

### 6.6 Izin intern

**Acuan:** design-intern.md §11

| File | Aksi | Yang dilakukan |
|---|---|---|
| `intern/leave.tsx` | Ubah | **Ganti input file bukti dengan input link** `evidence_url`. Hapus tombol unduh bukti. Tampilkan sisa kuota |
| `intern/leaves-data.ts` | Ubah | Pindahkan pemanggilan ke `endpoints/intern.ts`. Hapus `downloadEvidence` |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/intern/leaves?status=` | - | `data[]`, `meta.quota` (`used`, `limit`, `remaining`, `exhausted`) |
| `GET /api/intern/leaves/working-days?start_date=&end_date=` | - | Jumlah hari kerja (untuk info di form) |
| `POST /api/intern/leaves` | `{type, start_date, end_date, reason, evidence_url?}` | 201 `message` |
| `GET /api/intern/leaves/{id}` | - | Detail, catatan keputusan |
| `POST /api/intern/leaves/{id}/cancel` | - | Hanya saat Menunggu |

**Perhatikan:**
- `type`: `sick` atau `urgent`.
- `evidence_url` harus link `drive.google.com` atau `docs.google.com`. Pesan error server: "Link harus berupa link Google Drive atau Google Docs, contoh: https://drive.google.com/...". Ingatkan intern agar link bisa diakses (setelan "Siapa saja yang memiliki link").
- Kuota habis: 422 `quota_exhausted`. Jika `meta.quota.exhausted` true, nonaktifkan tombol Ajukan dan tampilkan pesan.
- Satu pengajuan = satu kali kuota, berapa pun harinya. Membatalkan mengembalikan kuota.

### 6.7 Presentasi akhir intern

**Acuan:** design-intern.md §12

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/routes/presentasi.tsx` | Buat | Route `/presentasi`, isi dari `role-pages.tsx` |
| `intern/presentation.tsx` | Buat | Status presentasi + form link bukti |
| `intern/presentation-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/intern/presentation` | - | `state`, `can_submit`, `message`, link dan catatan admin |
| `PUT /api/intern/presentation` | `{evidence_url}` | `message` |

| `state` | Tampilan |
|---|---|
| `not_open` | Tampilkan `message` (contoh "Presentasi akhir dapat dikirim mulai 24 Des 2026."), form disembunyikan |
| `not_submitted` | Form kirim link |
| `pending` | Link terkirim, boleh diganti |
| `revision` | Catatan admin + form kirim ulang |
| `approved` | Terkunci, tanpa form |

### 6.8 Catatan dan nilai akhir intern

**Acuan:** design-intern.md §13

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/routes/catatan.tsx` | Buat | Route `/catatan` (intern saja) |
| `intern/notes.tsx` | Buat | Dua bagian: daftar catatan warning (hanya baca) dan nilai akhir |
| `intern/notes-data.ts` | Buat | Hook |

| Endpoint | Baca |
|---|---|
| `GET /api/intern/warnings` | `data[]`: `id`, `body`, `author`, `created_at`, `updated_at`. Terbaru lebih dulu |
| `GET /api/intern/assessment` | `available` false + `message` jika belum disubmit. Jika `available` true: nilai per indikator (dengan `category`), `final_score`, `predicate`, `notes` |

Kelompokkan indikator per `category`. Nilai akhir dan predikat ditampilkan dari server, **jangan dihitung ulang**.

**Selesai jika (Fase 2):**
- [ ] Semua file `intern/` tidak lagi memanggil `useMock()`
- [ ] Clock in, isi logbook lewat clock out, riwayat, koreksi, izin dengan link, presentasi, catatan berjalan dengan akun `intern@injourney.test`
- [ ] Tidak ada lagi kata "Daily Report", "Task", atau input file di halaman intern

---

## 7. Fase 3: Mentor

### 7.1 Dashboard mentor

**Acuan:** design-mentor.md §4

| File | Aksi | Yang dilakukan |
|---|---|---|
| `mentor/dashboard.tsx` | Ubah | Hapus kotak Task. Tambah kotak logbook menunggu (dengan tombol Setujui), koreksi menunggu, izin menunggu, siap dinilai |
| `mentor/dashboard-data.ts` | Buat | Hook |

| Endpoint | Baca |
|---|---|
| `GET /api/mentor/dashboard` | `today` (`interns`, `clocked_in`, `late`, `on_leave`, `not_clocked_in`, `rows`), `pending_logbooks` (dengan id), `pending_corrections`, `pending_leaves` (`is_overdue`), `ready_to_assess`, `holiday`, `announcements` |

Kartu angka yang bisa diklik memfilter `today.rows` berdasarkan `status` **di frontend** (tanpa panggilan API baru).

### 7.2 Intern Saya

**Acuan:** design-mentor.md §5

| File | Aksi | Yang dilakukan |
|---|---|---|
| `mentor/interns.tsx` | Ubah besar | Daftar + detail dengan tab. **Hapus tab Task.** Tab Daily Report diganti tab **Logbook**. Tambah tab **Koreksi**, **Catatan**, **Akhir Magang** |
| `mentor/interns-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca / untuk tab |
|---|---|---|
| `GET /api/mentor/interns?status=&q=` | `status`: `active`, `inactive`, `former`, `all` | Daftar intern |
| `GET /api/mentor/interns/{id}` | - | Identitas (termasuk NIM/NIS, institusi, `leave_quota`) |
| `GET /api/mentor/interns/{id}/attendance?month=&status=` | | Tab Presensi |
| `GET /api/mentor/interns/{id}/attendance/days/{date}` | | Detail hari |
| `GET /api/mentor/interns/{id}/logbooks` | | Tab Logbook |
| `GET /api/mentor/interns/{id}/leaves` | | Tab Izin |
| `GET /api/mentor/interns/{id}/corrections` | | Tab Koreksi |
| `GET /api/mentor/interns/{id}/warnings` | | Tab Catatan (hanya baca) |
| `GET /api/mentor/assessments/{id}` | | Tab Akhir Magang (status presentasi + penilaian) |

Link notifikasi warning: `/intern-saya?open={id}&tab=catatan`.

### 7.3 Review logbook

**Acuan:** design-mentor.md §6

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/routes/logbook.tsx` | (dibuat di 6.3) | `role-pages.tsx` memilih `mentor/logbook-review.tsx` untuk mentor |
| `mentor/logbook-review.tsx` | Buat | Tab Menunggu Review / Revisi / Semua, filter intern, detail dengan tombol Setujui dan Minta Revisi, centang banyak + Setujui sekaligus, navigasi sebelumnya/berikutnya |
| `mentor/logbook-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/mentor/logbooks?tab=&intern_id=` | `tab`: `pending_review` (bawaan), `revision`, `all` | `data[]`, `meta` (jumlah per tab) |
| `GET /api/mentor/logbooks/{id}?tab=` | | Isi, presensi hari itu, riwayat review, `is_corrected`, `previous_id`, `next_id` |
| `POST /api/mentor/logbooks/{id}/approve` | `{comment?}` (maks 2000) | `message` |
| `POST /api/mentor/logbooks/{id}/revise` | `{comment}` **wajib** | `message` |
| `POST /api/mentor/logbooks/approve` | `{ids: number[]}` (1-200) | `message`, `skipped` (yang dilewati) |

**Perhatikan:**
- `previous_id`/`next_id` mengikuti urutan tab yang sedang dibuka. Kirim `tab` yang sama saat membuka detail.
- Setujui banyak: tampilkan daftar `skipped` jika ada (logbook yang sudah tidak menunggu review).
- `is_corrected` true → label "Diisi setelah koreksi presensi".
- Logbook milik intern nonaktif boleh disetujui; server bisa mengirim `warning`, tampilkan.
- Link notifikasi: `/logbook?open={id logbook}`.

### 7.4 Koreksi presensi mentor

**Acuan:** design-mentor.md §7

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/routes/koreksi.tsx` | Ubah | Saat ini khusus admin. Pindahkan pemilihan komponen ke `role-pages.tsx` (mentor → `mentor/corrections.tsx`, admin → `admin/corrections.tsx`) |
| `mentor/corrections.tsx` | Buat | Tab Menunggu / Semua, filter intern, detail, ACC dan Tolak |
| `mentor/corrections-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/mentor/corrections?tab=&intern_id=` | `tab`: `waiting`, `all` | Daftar |
| `GET /api/mentor/corrections/{id}` | | Detail, `can_decide` |
| `POST /api/mentor/corrections/{id}/approve` | `{note?}` opsional | Status jadi `pending_admin` |
| `POST /api/mentor/corrections/{id}/reject` | `{note}` **wajib** | Status jadi `rejected_by_mentor` |

Mentor **tidak** mengubah jam. ACC mentor adalah bukti; admin yang mengeksekusi.

### 7.5 Izin (mentor dan admin)

**Acuan:** design-mentor.md §8, design-admin.md §7

| File | Aksi | Yang dilakukan |
|---|---|---|
| `shared/leave-review.tsx` | Ubah | Dipakai mentor dan admin. Ganti `useMock()` dengan hook per role. Bukti berupa **link** (buka di tab baru), bukan file. Admin: centang "Saya sudah memeriksa surat resmi atau bukti" sebelum Setujui |
| `shared/leave-review-data.ts` | Buat | Hook yang memilih endpoint mentor atau admin berdasarkan role |

| Endpoint | Kirim | Baca |
|---|---|---|
| Mentor `GET /api/mentor/leaves?tab=&type=&intern_id=` | `tab`: `pending`, `all` | Daftar |
| Admin `GET /api/admin/leaves?tab=&type=&intern_id=&airport_id=&quota_exhausted=` | | Daftar, `meta.pending_count` |
| `GET /api/{mentor|admin}/leaves/{id}` | | Detail, `quota`, `evidence_url`, `can_decide`, `is_overdue` |
| Mentor `POST /api/mentor/leaves/{id}/approve` | `{note}` | `note` wajib |
| Admin `POST /api/admin/leaves/{id}/approve` | `{note, evidence_checked: true}` | `note` wajib, centang bukti wajib |
| `POST /api/{mentor|admin}/leaves/{id}/reject` | `{note}` | `note` wajib |

**Perhatikan:**
- Catatan (`note`) **wajib** untuk Setujui dan Tolak, di mentor maupun admin (aturan request backend saat ini).
- Admin hanya bisa memutuskan izin yang menunggu lebih dari batas jam (`leave_escalation_hours`, bawaan 24 jam). Tombol mengikuti `can_decide`. Jika ditolak, tampilkan `message`.
- Setujui oleh admin ditolak jika tidak ada link (`no_evidence`) atau belum dicentang (`evidence_unchecked`).

### 7.6 Kalender Izin

**Acuan:** design-mentor.md §9

| File | Aksi | Yang dilakukan |
|---|---|---|
| `mentor/leave-calendar.tsx` | Ubah | Data dari API. Libur mengikuti bandara tiap intern |

| Endpoint | Kirim |
|---|---|
| `GET /api/mentor/leave-calendar?month=YYYY-MM&intern_id=` | `intern_id` opsional |

### 7.7 Performa intern

**Acuan:** design-mentor.md §10

| File | Aksi | Yang dilakukan |
|---|---|---|
| `mentor/performance.tsx` | Ubah | Hapus KPI Task dan Daily Report. Klik angka menampilkan daftar tanggal dari `dates` |

| Endpoint | Baca |
|---|---|
| `GET /api/mentor/performance?month=&intern_id=` | Rekap (Hadir, Terlambat, Lupa Clock In, Lupa Clock Out, Izin, Tidak Hadir, Hari kerja), KPI `attendance_rate`, `on_time_rate`, `logbook_approved_rate`, `logbook_revisions`, `enough_data`, `dates`, `summary` |

`daily_report_rate` sudah dihapus. `enough_data` false → tampilkan "Data belum cukup" alih-alih persentase.

### 7.8 Input Nilai

**Acuan:** design-mentor.md §11, `backend/update26okt.md`

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/routes/penilaian.tsx` | Buat | Route `/penilaian`, `role-pages.tsx` memilih mentor/admin |
| `mentor/assessments.tsx` | Buat | Daftar intern + status, form nilai per indikator dikelompokkan per kategori, catatan, Simpan Draft dan Submit |
| `mentor/assessments-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/mentor/assessments` | | `data[]`: intern, `presentation_status`, `unapproved_logbooks`, `status`, `blockers[]` (`code`, `text`), `can_assess`, `final_score` |
| `GET /api/mentor/assessments/{intern_id}` | | Indikator aktif (`id`, `category`, `name`), nilai draft, nilai akhir sementara, `predicate`, `notes`, `unapproved_logbook_days`, `can_edit` |
| `PUT /api/mentor/assessments/{intern_id}` | `{scores: [{indicator_id, score}], notes}` | Simpan draft |
| `POST /api/mentor/assessments/{intern_id}/submit` | Sama | Submit, **terkunci permanen** |

**Perhatikan:**
- `score`: **bilangan bulat 0-100**. Input `type="number"` dengan `step=1`, `min=0`, `max=100`. Saat draft boleh kosong (`null`).
- Kirim **seluruh** form setiap simpan. `notes` yang tidak dikirim berarti catatan **dikosongkan**.
- Submit wajib semua indikator terisi. Pesan server: "Isi semua nilai sebelum submit."
- Sebelum Submit, tampilkan dialog konfirmasi: "Penilaian yang sudah disubmit tidak bisa diubah lagi."
- Status `blocked`: tampilkan `blockers[].text` (contoh "2 logbook belum disetujui") dengan tautan ke logbook dari `unapproved_logbook_days`.
- Nilai akhir dan predikat diambil dari respons, **jangan dihitung di frontend**.
- Link notifikasi: `/penilaian?open={id intern}`.

**Selesai jika (Fase 3):**
- [ ] Semua file `mentor/` tidak lagi memanggil `useMock()`
- [ ] `mentor/task-form.tsx` dan `mentor/task-review.tsx` sudah dihapus (lihat Fase 6)
- [ ] Alur lengkap dengan `mentor@injourney.test`: setujui logbook, minta revisi, ACC koreksi, proses izin, input nilai sampai submit

---

## 8. Fase 4: Admin

### 8.0 Filter bandara global

Banyak halaman admin punya filter lokasi. Pilihan bandara dari `GET /api/admin/airports`. Nilai dikirim sebagai `airport_id` (kosong = semua) ke: Dashboard, Presensi, Koreksi, Izin, Presentasi, Penilaian, Laporan.

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/airport-filter.tsx` | Buat | Dropdown bandara dipakai bersama. Simpan pilihan di parameter URL agar tetap saat pindah halaman |

### 8.1 Dashboard admin

**Acuan:** design-admin.md §5, §8

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/dashboard.tsx` | Ubah | Data dari API dengan filter bandara. Tombol Setujui koreksi membuka **dialog catatan** (catatan wajib) |
| `admin/extend-dialog.tsx` | Ubah | Perpanjang lewat API |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/admin/dashboard?airport_id=` | | `today`, `yesterday` (dengan `rows`), `pending_corrections`, `overdue_leaves`, `pending_presentations`, `ending_internships`, `quota_exhausted`, `new_assessments`, `campuses`, `holiday`, `has_active_office` |
| `GET /api/admin/ending-internships` | | Daftar magang yang akan berakhir |
| `POST /api/admin/users/{id}/extend` | `{end_date}` | Perpanjang. Kuota izin ikut direset |

### 8.2 Pengguna (Kelola Akun)

**Acuan:** design-admin.md §4

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/users.tsx` | Ubah besar | Form tambah/ubah sesuai field baru. Hapus `title` dan foto. Detail intern dengan tab. Dialog ganti mentor, perpanjang, nonaktifkan/aktifkan, reset password |
| `admin/users-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/admin/users?q=&role=&status=&page=` | `status`: `active`, `inactive`, `all` | `data[]`, `meta` (halaman) |
| `GET /api/admin/mentors` | | Pilihan mentor |
| `GET /api/admin/units` | | Pilihan unit (`is_active`) |
| `GET /api/admin/airports` | | Pilihan bandara |
| `POST /api/admin/users` | Lihat tabel field di bawah | `data`, **`temporary_password`** |
| `GET /api/admin/users/{id}` | | Detail, `leave_quota` |
| `PUT /api/admin/users/{id}` | Sama dengan tambah, tanpa `role` | `data` |
| `GET /api/admin/users/{id}/mentor-change` | | Info sebelum ganti mentor |
| `POST /api/admin/users/{id}/mentor` | `{mentor_id}` | |
| `POST /api/admin/users/{id}/deactivate`, `/activate` | | |
| `POST /api/admin/users/{id}/reset-password` | | **`temporary_password`** |

Field form akun:

| Field | Admin | Mentor | Intern | Aturan |
|---|---|---|---|---|
| `name` | Wajib | Wajib | Wajib | Maks 255 |
| `email` | Wajib | Wajib | Wajib | Unik |
| `role` | Wajib | Wajib | Wajib | Hanya saat tambah |
| `unit_id` | - | Wajib | Wajib | Dari `/api/admin/units` |
| `mentor_id` | - | - | Wajib | Dari `/api/admin/mentors` |
| `airport_id` | - | - | Wajib | Dari `/api/admin/airports` |
| `institution_type` | - | - | Wajib | `universitas` atau `sekolah` |
| `university` | - | - | Wajib | Label berubah "Asal Universitas" / "Asal Sekolah" sesuai `institution_type` |
| `major` | - | - | Wajib | |
| `student_number` | - | - | Wajib | Maks 30. Label "NIM" / "NIS" sesuai `institution_type` |
| `start_date`, `end_date` | - | - | Wajib | `end_date` ≥ `start_date` |

**Perhatikan:**
- `temporary_password` **hanya muncul sekali** di respons tambah akun dan reset password. Tampilkan dalam dialog dengan tombol salin. Jangan disimpan di state global atau localStorage.
- Admin tidak bisa mereset password akunnya sendiri.
- Mentor yang masih punya intern aktif tidak bisa dinonaktifkan (`message` dari server).
- Tab detail intern:

| Tab | Endpoint |
|---|---|
| Presensi | `GET /api/admin/users/{id}/attendance`, `/attendance/days/{date}` |
| Logbook (hanya baca) | `GET /api/admin/users/{id}/logbooks?month=` |
| Izin | `GET /api/admin/users/{id}/leaves` |
| Koreksi | `GET /api/admin/users/{id}/corrections` |
| Warning | `GET /api/admin/users/{id}/warnings` |
| Akhir Magang | `GET /api/admin/assessments/{id}` |

### 8.3 Presensi admin

**Acuan:** design-admin.md §5

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/attendance.tsx` | Ubah | Dua tampilan: rekap bulanan per intern dan status harian semua intern |

| Endpoint | Baca |
|---|---|
| `GET /api/admin/attendance?month=&airport_id=&q=` | Rekap per intern + `attendance_rate` |
| `GET /api/admin/attendance/daily?date=&airport_id=&q=` | Status semua intern di tanggal itu + `counts`. Tanggal masa depan ditolak |

### 8.4 Koreksi admin

**Acuan:** design-admin.md §6

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/corrections.tsx` | Ubah | **Hapus** isian jam. Admin hanya Setujui/Tolak. Tampilkan `recorded` (sebelum) dan `result` (hasil jika disetujui) |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/admin/corrections?tab=&intern_id=&airport_id=` | `tab`: `pending_admin`, `pending_mentor`, `all` | Daftar, `meta` jumlah per tab |
| `GET /api/admin/corrections/{id}` | | `recorded`, `result`, `can_decide` |
| `POST /api/admin/corrections/{id}/approve` | `{note}` **wajib** | |
| `POST /api/admin/corrections/{id}/reject` | `{note}` **wajib** | |

Koreksi `pending_mentor` tidak bisa diputuskan admin ("Koreksi ini masih menunggu mentor."). Setelah disetujui, jam kosong diisi jam jadwal; admin tidak mengetik jam.

### 8.5 Presentasi akhir admin

**Acuan:** design-admin.md §9

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/presentations.tsx` | Buat | Tab Menunggu / Revisi / Disetujui / Belum Kirim, filter bandara, detail dengan link bukti, Setujui dan Minta Revisi |
| `admin/presentations-data.ts` | Buat | Hook |

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/presentations?tab=&airport_id=` | `tab`: `pending`, `revision`, `approved`, `not_submitted` |
| `GET /api/admin/presentations/{id}` | |
| `POST /api/admin/presentations/{id}/approve` | Tanpa body |
| `POST /api/admin/presentations/{id}/revise` | `{note}` **wajib** |

### 8.6 Penilaian admin

**Acuan:** design-admin.md §10

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/assessments.tsx` | Buat | Daftar per status + detail **hanya baca**. Tombol **Unduh PDF Penilaian** di detail jika status `submitted` (memanggil endpoint 8.10) |
| `admin/assessments-data.ts` | Buat | Hook |

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/assessments?status=&airport_id=` | `status`: `ready`, `blocked`, `draft`, `submitted` |
| `GET /api/admin/assessments/{user_id}` | Nilai draft disembunyikan server |

### 8.7 Warning

**Acuan:** design-admin.md §13

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/warnings.tsx` | Ubah | Data dari API |

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/warnings` | Ringkasan per intern (`mentor`, `leave_quota`) |
| `GET /api/admin/users/{id}/warnings` | Daftar catatan intern |
| `POST /api/admin/users/{id}/warnings` | `{body}` maks 2000. Mengirim notifikasi ke intern dan mentor |
| `PUT /api/admin/warnings/{id}` | `{body}`. Tanpa notifikasi |

Tidak ada hapus warning.

### 8.8 Pengumuman

**Acuan:** design-admin.md §14

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/announcements.tsx` | Ubah | Data dari API. Pilihan penerima: intern, mentor, atau keduanya |

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/announcements` | |
| `POST /api/admin/announcements` | `{title, body, for_intern, for_mentor}` (judul maks 255, isi maks 5000) |
| `PUT /api/admin/announcements/{id}` | Sama |
| `DELETE /api/admin/announcements/{id}` | |
| `GET /api/announcements/{id}` (semua role) | Detail saat notifikasi pengumuman diklik |

### 8.9 Pengaturan

**Acuan:** design-admin.md §11

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/settings.tsx` | Ubah besar | **Hapus pengaturan jam kerja global** (pindah ke Lokasi & Jadwal per bandara). Tiga bagian: Pengaturan Umum, Kalender Libur, Unit |

| Bagian | Endpoint | Kirim |
|---|---|---|
| Pengaturan Umum | `GET`, `PUT /api/admin/settings` | `late_tolerance_minutes` (0-120), `leave_quota` (1-30), `end_reminder_days` (1-60), `leave_escalation_hours` (1-168). Semua wajib dikirim |
| Kalender Libur | `GET /api/admin/holidays`, `POST`, `PUT /{id}`, `DELETE /{id}` | `{date, name, confirm?}`. Libur boleh di akhir pekan |
| Unit | `GET /api/admin/units`, `POST`, `PUT /{id}`, `POST /{id}/deactivate`, `/activate` | `{name}`. Tidak ada hapus |

**Perhatikan Kalender Libur:** menambah atau mengubah libur di tanggal yang sudah lewat akan menghitung ulang status presensi. Server menolak dulu dengan 422 `reason: confirm_recalculate` beserta `affected` (jumlah presensi terdampak). Tampilkan dialog konfirmasi berisi `message` dan jumlah itu, lalu kirim ulang permintaan yang sama dengan `confirm: true`.

### 8.10 Laporan (Excel dan PDF)

**Acuan:** design-admin.md §15, `backend/update26okt.md`, `backend/update27okt.md`

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/reports.tsx` | Ubah | Dua bagian: **Excel** (filter + pilih sheet) dan **PDF** (Daftar Kehadiran per intern per bulan, Penilaian per intern). Unduh lewat `downloadFile()` (4.4) |
| `admin/reports-data.ts` | Buat | Hook options dan preview |

**Excel:**

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/admin/reports/options` | | Pilihan intern (dengan email), mentor, `airports`, `sheets` |
| `POST /api/admin/reports/preview` | Sama dengan export | Jumlah intern yang akan masuk |
| `POST /api/admin/reports/export` | `{from, to, airport_id?, mentor_id?, intern_ids?, sheets?, quota_exhausted?}` | File `.xlsx` |

- `from`, `to`: `YYYY-MM-DD`, maksimal 12 bulan.
- `sheets`: kombinasi `attendance`, `leave`, `logbook`, `assessment`. Kosong = semua.
- Tanpa data: 422 "Tidak ada data pada periode dan filter ini."

**PDF:**

| Endpoint | Kirim | File |
|---|---|---|
| `POST /api/admin/reports/attendance-pdf` | `{intern_id, month}` (`YYYY-MM`) | `daftar-kehadiran_{nama}_{bulan}.pdf` |
| `POST /api/admin/reports/assessment-pdf` | `{intern_id}` | `penilaian_{nama}.pdf` |

Penolakan PDF (422 JSON):

| `reason` | Pesan |
|---|---|
| `outside_internship` | Bulan di luar periode magang intern |
| `no_data` | Belum ada hari kerja yang bisa dicetak pada bulan itu |
| `not_submitted` | Penilaian belum disubmit mentor |

**Perhatikan:**
- Ketiga export dibatasi **10 per menit per admin** (dihitung bersama). Tangani 429: "Terlalu banyak permintaan, coba lagi sebentar."
- Nonaktifkan tombol unduh selama permintaan berjalan agar tidak terkirim dua kali.
- Pilihan bulan PDF dibatasi periode magang intern yang dipilih (`start_date` sampai `end_date`).

### 8.11 Lokasi & Jadwal

**Acuan:** design-admin.md §12

Struktur backend **dua tingkat**:

```
Bandara (airports)              nama, kota, jadwal mingguan, jadwal khusus
 └─ Titik Presensi (offices)    nama, titik peta, radius clock in, radius clock out
Intern → terhubung ke Bandara (bukan ke titik)
```

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/offices.tsx` | Ubah besar | Halaman daftar **bandara**. Klik bandara membuka detail dengan **3 tab**: Titik Presensi (peta Leaflet yang sudah ada), Jadwal Mingguan, Jadwal Khusus. Ganti label menu menjadi "Lokasi & Jadwal" |
| `admin/airport-form.tsx` | Buat | Form tambah bandara: nama, **kota**, jadwal mingguan 7 hari |
| `admin/locations-data.ts` | Buat | Hook |

**Bandara:**

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/airports` | Daftar dengan `city`, `active_offices`, `active_interns`, jadwal berlaku |
| `POST /api/admin/airports` | `{name, city, effective_from, days}` (lihat format `days`) |
| `GET /api/admin/airports/{id}` | Detail: titik, jadwal berlaku, jadwal mendatang, jadwal khusus |
| `PUT /api/admin/airports/{id}` | `{name, city?}`. Tanpa `city` = kota lama dipertahankan |
| `POST /api/admin/airports/{id}/deactivate`, `/activate` | Nonaktif ditolak jika masih ada intern aktif |

**Kota (`city`) wajib saat tambah bandara** (maks 100). Kota dipakai di PDF ("Tangerang, 27 Oktober 2026"). Saat ini form frontend **belum punya input kota**, jadi wajib ditambahkan.

**Jadwal mingguan:**

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/airports/{id}/weekly-schedules` | Riwayat jadwal |
| `PUT /api/admin/airports/{id}/weekly-schedule` | `{effective_from, days}` |

Format `days`:

```json
{
  "effective_from": "2026-11-01",
  "days": [
    { "day_of_week": 1, "is_workday": true,  "start_time": "08:00", "end_time": "17:00" },
    { "day_of_week": 5, "is_workday": true,  "start_time": "08:30", "end_time": "16:00" },
    { "day_of_week": 6, "is_workday": false, "start_time": null,    "end_time": null }
  ]
}
```

- `day_of_week`: 1 = Senin sampai 7 = Minggu.
- Saat **tambah bandara**: `days` wajib berisi **7 hari**.
- Saat **ubah jadwal**: boleh 1-7 hari; hari yang tidak dikirim disalin dari jadwal sebelumnya.
- `effective_from` tidak boleh tanggal lampau. Jadwal dengan tanggal yang sama ditimpa.
- UI boleh menyediakan "atur sekaligus Senin-Kamis", tetapi yang dikirim tetap per hari.

**Jadwal khusus:**

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/airports/{id}/special-schedules` | |
| `POST /api/admin/airports/{id}/special-schedules` | `{name, start_date, end_date, start_time, end_time}` |
| `PUT /api/admin/special-schedules/{id}` | Sama |
| `DELETE /api/admin/special-schedules/{id}` | Jika sedang berjalan, artinya **dihentikan mulai hari ini** |

Tidak boleh tumpang tindih per bandara. Hanya tanggal yang belum lewat. Jadwal yang sudah selesai terkunci.

**Titik presensi:**

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/offices?airport_id=` | |
| `POST /api/admin/offices` | `{airport_id, name, latitude, longitude, clock_in_radius_meters, clock_out_radius_meters}` |
| `GET /api/admin/offices/{id}` | |
| `PUT /api/admin/offices/{id}` | Sama, **tanpa** `airport_id` (titik tidak bisa pindah bandara) |
| `POST /api/admin/offices/{id}/deactivate`, `/activate` | **Tidak ada hapus** |

### 8.12 Log Aktivitas

**Acuan:** design-admin.md §16

| File | Aksi | Yang dilakukan |
|---|---|---|
| `admin/logs.tsx` | Ubah | Data dari API dengan filter dan halaman |

| Endpoint | Kirim |
|---|---|
| `GET /api/admin/audit-logs/options` | Pilihan pelaku (`admins[]`) dan kategori (`actions[]`) |
| `GET /api/admin/audit-logs?from=&to=&admin_id=&action=&page=` | |

Kategori: Akun, Presensi, Koreksi Presensi, Izin, Presentasi, **Penilaian** (pelakunya mentor), Lokasi & Jadwal, Kalender Libur, Pengaturan Umum, Unit, Warning, Pengumuman, Laporan. Kosong: "Tidak ada aktivitas pada filter ini."

**Selesai jika (Fase 4):**
- [ ] Semua file `admin/` tidak lagi memanggil `useMock()`
- [ ] Tambah intern lengkap dengan NIM/NIS dan institusi berhasil, password sementara tampil sekali
- [ ] Tambah bandara dengan kota dan jadwal 7 hari berhasil, titik presensi bisa ditambah di peta
- [ ] Unduh Excel, PDF Daftar Kehadiran, dan PDF Penilaian berhasil dengan nama file dari server

---

## 9. Fase 5: Lonceng, Chat, Real-time

**Acuan:** design-intern.md §14, design-mentor.md §12, design-admin.md §16, `backend/progress.md` "Catatan integrasi frontend: Lonceng dan Chat"

### 9.1 Koneksi WebSocket

```bash
cd frontend
npm install laravel-echo pusher-js
```

| File | Aksi | Yang dilakukan |
|---|---|---|
| `src/lib/realtime.ts` | Buat | Buat instance Echo setelah login, putuskan saat logout atau 401 |
| `src/lib/auth.tsx` | Ubah | Panggil sambung/putus Echo saat status `authed`/`guest` berubah |

```ts
import Echo from "laravel-echo";
import Pusher from "pusher-js";

(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

export function connectEcho(token: string) {
  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? "http";
  return new Echo({
    broadcaster: "reverb",
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT),
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${import.meta.env.VITE_API_URL}/api/broadcasting/auth`,
    auth: { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  });
}
```

Echo hanya boleh dibuat di browser (bukan saat render server TanStack Start). Bungkus dengan `typeof window !== "undefined"`.

| Channel | Event | Isi |
|---|---|---|
| `private users.{id_saya}` | `.notification.sent` | `{notification, unread_count}` |
| | `.notifications.read` | `{ids | null, unread_count}` (sinkron antar-tab) |
| | `.notifications.changed` | `{unread_count}` → muat ulang daftar lonceng |
| | `.chat.message` | `{message, sender {id, name}}` |
| | `.chat.read` | `{reader_id, partner_id, last_read_id, read_at}` |
| `presence online` | here/joining/leaving | Daftar pengguna online `{id, name}` |
| `private chats.{id_kecil}.{id_besar}` | whisper `typing` | Indikator mengetik |

Nama event diawali **titik** (`.notification.sent`).

### 9.2 Lonceng notifikasi

| File | Aksi | Yang dilakukan |
|---|---|---|
| `shared/shell.tsx` | Ubah | Ikon lonceng + angka + popup dari API |
| `shared/notifications-data.ts` | Buat | Hook daftar (cursor), tandai dibaca, tandai semua |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/notifications?cursor=` | | `data[]` (`id`, `text`, `link_path`, `link_params`, `read_at`, `created_at`), `meta.next_cursor`, `meta.unread_count` |
| `POST /api/notifications/{id}/read` | | |
| `POST /api/notifications/read-all` | | |

**Alur klik:** `POST /{id}/read` → arahkan ke route dari peta 4.5.

`.notification.sent` bisa membawa `id` yang **sudah ada** (notifikasi chat naik lagi). Ganti item ber-`id` sama dan pindahkan ke atas, jangan menduplikasi.

### 9.3 Chat

| File | Aksi | Yang dilakukan |
|---|---|---|
| `shared/chat.tsx` | Ubah | Data dari API dan WebSocket. **Buka percakapan berdasarkan id pengguna** (`?to=12`), bukan nama |
| `shared/chat-data.ts` | Buat | Hook |

| Endpoint | Kirim | Baca |
|---|---|---|
| `GET /api/chats?q=` | | Percakapan: `partner` (`id`, `name`, `role`, `unit` berupa nama unit, `can_send`), `last_message`, `unread_count`; `meta.unread_total` |
| `GET /api/chats/contacts?q=` | | Kontak untuk chat baru (maks 50) |
| `GET /api/chats/{user_id}/messages?before_id=` | | 30 pesan lama ke baru, `meta.has_more`, `meta.partner` |
| `POST /api/chats/{user_id}/messages` | `{body}` maks 2000 | 201 pesan |
| `POST /api/chats/{user_id}/read` | | `meta.unread_total` |

**Perhatikan:**
- Teks saja, tanpa ubah atau hapus pesan.
- `can_send` false → tutup kotak kirim dengan "Akun ini nonaktif."
- Saat percakapan terbuka dan pesan masuk, panggil `POST /read`.
- Abaikan pesan `.chat.message` yang `id`-nya sudah ada di layar.
- Kirim whisper `typing` paling sering tiap 2-3 detik.
- Batas 60 pesan per menit (429).

**Selesai jika (Fase 5):**
- [ ] Dua browser (intern dan mentor) bisa chat real-time, tanda Dibaca dan mengetik berfungsi
- [ ] Angka lonceng bertambah tanpa muat ulang saat mentor meminta revisi logbook
- [ ] Logout memutus koneksi WebSocket

---

## 10. Fase 6: Bersih-bersih

Kerjakan setelah Fase 1-5 selesai.

| File | Aksi |
|---|---|
| `src/routes/task.tsx` | Hapus |
| `shared/tasks.tsx` | Hapus |
| `intern/task-submit.tsx`, `intern/tasks-data.ts` | Hapus |
| `mentor/task-form.tsx`, `mentor/task-review.tsx` | Hapus |
| `shared/model.tsx` | Hapus `MockProvider` dan data contoh. Fungsi kecil yang masih dipakai (`initials`, `shortName`) pindah ke `src/lib/utils.ts` |
| `src/routes/__root.tsx` | Hapus `<MockProvider>` |
| `shared/shell.tsx` | Hapus tombol Simulasi |
| `shared/ui.tsx` | Hapus komponen input file |
| `src/lib/mock-rules.ts` + test | Hapus aturan yang sudah dipindah ke server (Task, status presensi, kuota). Jika tidak ada lagi yang dipakai, hapus file beserta `mock-rules.test.ts`, `admin-rules.test.ts`, `role-rules.test.ts` |
| `src/test/pages.test.tsx` | Ubah: render halaman dengan respons API tiruan (mock `fetch` atau MSW), bukan `MockProvider` |
| `src/components/internspace/README.md` | Ubah: hapus kolom Status dan baris "Dihapus" setelah semua selesai |
| `frontend/CLAUDE.md` | Ubah: hapus keterangan "Dihapus bertahap" untuk `model.tsx` dan `mock-rules.ts` |

**Selesai jika (Fase 6):**
- [ ] `grep -r "useMock\|MockProvider\|taskApi\|daily-report\|photo_url" src` tidak menemukan apa pun
- [ ] `npm run test`, `npm run lint`, `npm run build` lulus

---

## 11. Pengujian dan Definisi Selesai

### 11.1 Per fitur

1. Kondisi memuat, kosong, dan gagal tampil benar.
2. Pesan `message` dari server tampil untuk penolakan 422.
3. Error isian tampil di bawah field.
4. Tombol mengikuti flag server (`can_*`, `action`).
5. Data terkait (dashboard, badge menu) ikut diperbarui setelah aksi.
6. Tampilan benar di lebar ponsel (intern dirancang mobile first).

### 11.2 Skenario ujung ke ujung

| No | Skenario | Akun |
|---|---|---|
| 1 | Intern clock in, clock out dengan isi logbook | intern |
| 2 | Mentor minta revisi logbook, intern menerima notifikasi, kirim ulang, mentor setujui | mentor, intern |
| 3 | Intern ajukan koreksi, mentor ACC, admin setujui, hari jadi Hadir (Dikoreksi), intern isi logbook hari itu | intern, mentor, admin |
| 4 | Intern ajukan izin dengan link Drive, mentor setujui, kuota berkurang | intern, mentor |
| 5 | Intern kirim presentasi, admin setujui, mentor input nilai dan submit, intern melihat nilai | intern, admin, mentor |
| 6 | Admin unduh PDF Daftar Kehadiran dan PDF Penilaian intern tersebut | admin |
| 7 | Admin tambah bandara baru dengan kota dan jadwal, tambah titik presensi, tambah intern di bandara itu | admin |
| 8 | Biarkan aplikasi diam 30 menit, lakukan aksi, kembali ke login | semua |

Catatan: skenario 5 butuh tanggal mendekati akhir magang (presentasi terbuka H-7). Untuk uji lokal, minta tim backend menyiapkan data intern contoh yang magangnya hampir berakhir, atau ubah `end_date` intern lewat menu Pengguna.

---

## 12. Kesalahpahaman yang Sering Terjadi

| No | Salah | Benar |
|---|---|---|
| 1 | Memakai `user.home_path` atau `menu.path` sebagai alamat halaman | Pakai route frontend dari tabel 4.3. Dari menu hanya `key` dan `badge` |
| 2 | Task masih ada | **Task sudah dihapus total.** Penggantinya Logbook |
| 3 | Daily Report dan Logbook berbeda | Daily Report **sudah diganti** Logbook. Logbook hari ini diisi saat clock out |
| 4 | Bukti izin/presentasi berupa upload file | Berupa **link Google Drive/Docs** (`evidence_url`) |
| 5 | Intern clock in di "kantor" | Intern clock in di **titik presensi milik bandaranya**. Server memilih titik terdekat yang masuk radius |
| 6 | Jam kerja diatur global di Pengaturan | Jam kerja **per bandara** (jadwal mingguan + jadwal khusus) di Lokasi & Jadwal |
| 7 | Lupa Clock Out adalah status | Lupa Clock Out adalah **tanda** (`missed_clock_out: true`), statusnya tetap Hadir/Terlambat |
| 8 | Admin mengisi jam saat menyetujui koreksi | Admin hanya Setujui/Tolak; jam diisi otomatis dari jadwal. Hasil selalu Hadir |
| 9 | Koreksi langsung ke admin | Dua tahap: **mentor dulu**, lalu admin |
| 10 | Nilai akhir dihitung di frontend | Dihitung **server**. Frontend hanya menampilkan `final_score` dan `predicate` |
| 11 | Nilai boleh desimal | **Bilangan bulat** 0-100 |
| 12 | `notes` penilaian tidak dikirim = tidak berubah | Tidak dikirim = **dikosongkan**. Selalu kirim form utuh |
| 13 | Penilaian bisa dibuka lagi setelah submit | **Terkunci permanen** |
| 14 | Chat dibuka dengan nama (`?to=Rina`) | Dibuka dengan **id pengguna** (`?to=12`) |
| 15 | Profil bisa ubah nama dan foto | Hanya **telepon** |
| 16 | Akun punya `title` (jabatan) | Diganti **`unit`** (`{id, name}`) |
| 17 | Admin bisa memutuskan izin kapan saja | Hanya setelah lewat batas jam (bawaan 24 jam). Ikuti `can_decide` |
| 18 | Bandara, titik, unit bisa dihapus | Hanya **dinonaktifkan** |
| 19 | Export bisa pakai link `<a href>` | Harus `fetch` POST dengan header Authorization lalu simpan blob |
| 20 | `new Date("2026-10-12")` aman | Bisa bergeser hari. Pakai `parseISO` |
| 21 | Polling untuk data terbaru | Dilarang. Pakai WebSocket dan `invalidateQueries` setelah aksi |
| 22 | `link_params.open` di `/penilaian` adalah id penilaian | Itu **id intern** |

---

## 13. Permintaan ke Backend dan Hal Terbuka

Tulis di sini jika menemukan kebutuhan yang belum disediakan backend. Jangan mengubah `backend/` dari pekerjaan frontend.

| No | Kebutuhan | Ditemukan saat | Status |
|---|---|---|---|
| 1 | `report_region_name` ("Kantor Regional I" di PDF) belum bisa diubah dari Pengaturan Umum | Fase 4 | Terbuka, belum diminta dokumen |
| 2 | Data contoh intern yang magangnya hampir berakhir untuk menguji presentasi dan penilaian | Fase 2-3 | Terbuka |
| 3 | | | |

Hal yang masih terbuka di sisi produk (tidak menghalangi integrasi):

- Konfirmasi mitra: indikator "Keberhasilan" di kategori Kepribadian, dan data kota bandara Soekarno-Hatta diisi "Tangerang".
- Penanganan GPS kurang akurat dan VPN saat validasi lokasi.
- Host production untuk API dan Reverb.

---

## 14. Log Progres

Centang dan isi tanggal saat selesai. Satu baris = satu fitur.

| Fase | Fitur | Bagian | PIC | Selesai |
|---|---|---|---|---|
| 0 | Pasang file panduan baru (`AGENTS.md`, `CLAUDE.md`, README, roadmap, `.env.example`) | 2.1 | | [x] 2026-10-27 |
| 0 | `endpoints/`, hapus `taskApi` | 4.1 | | [x] 2026-10-27 |
| 0 | `downloadFile()` | 4.4 | | [x] 2026-10-27 |
| 0 | `navigation.ts`, `search.ts` | 4.3, 4.5 | | [x] 2026-10-27 |
| 0 | `labels.ts` | 4.6 | | [x] 2026-10-27 |
| 1 | Login, ganti password, tipe user | 5.1 | | [x] 2026-10-27 |
| 1 | Shell, menu, badge | 5.2 | | [x] 2026-10-27 |
| 1 | Profil | 5.3 | | [x] 2026-10-27 |
| 2 | Dashboard intern | 6.1 | | [ ] |
| 2 | Clock in/out + logbook di clock out | 6.2 | | [ ] |
| 2 | Logbook intern | 6.3 | | [ ] |
| 2 | Riwayat presensi | 6.4 | | [ ] |
| 2 | Koreksi intern | 6.5 | | [ ] |
| 2 | Izin intern | 6.6 | | [ ] |
| 2 | Presentasi intern | 6.7 | | [ ] |
| 2 | Catatan dan nilai intern | 6.8 | | [ ] |
| 3 | Dashboard mentor | 7.1 | | [ ] |
| 3 | Intern Saya | 7.2 | | [ ] |
| 3 | Review logbook | 7.3 | | [ ] |
| 3 | Koreksi mentor | 7.4 | | [ ] |
| 3 | Izin mentor dan admin | 7.5 | | [ ] |
| 3 | Kalender izin | 7.6 | | [ ] |
| 3 | Performa | 7.7 | | [ ] |
| 3 | Input Nilai | 7.8 | | [ ] |
| 4 | Filter bandara | 8.0 | | [ ] |
| 4 | Dashboard admin | 8.1 | | [ ] |
| 4 | Pengguna | 8.2 | | [ ] |
| 4 | Presensi admin | 8.3 | | [ ] |
| 4 | Koreksi admin | 8.4 | | [ ] |
| 4 | Presentasi admin | 8.5 | | [ ] |
| 4 | Penilaian admin | 8.6 | | [ ] |
| 4 | Warning | 8.7 | | [ ] |
| 4 | Pengumuman | 8.8 | | [ ] |
| 4 | Pengaturan | 8.9 | | [ ] |
| 4 | Laporan Excel dan PDF | 8.10 | | [ ] |
| 4 | Lokasi & Jadwal | 8.11 | | [ ] |
| 4 | Log Aktivitas | 8.12 | | [ ] |
| 5 | Koneksi WebSocket | 9.1 | | [ ] |
| 5 | Lonceng | 9.2 | | [ ] |
| 5 | Chat | 9.3 | | [ ] |
| 6 | Bersih-bersih | 10 | | [ ] |

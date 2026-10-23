# Progress Backend

Catatan pekerjaan backend dan hal yang belum boleh terlupa.

## Selesai

- [x] Koneksi database diubah ke PostgreSQL (`DB_CONNECTION=pgsql`). Produksi memakai Supabase. (13 Okt 2026)
- [x] Skrip pembuat 18 migration tabel aplikasi: `database/generate_migrations.php`. Migration sudah dibuat dan dijalankan. (13 Okt 2026)
  - `users`: kolom akun, soft delete, email unik hanya untuk akun yang belum dihapus.
  - `attendances`: `clock_in_office_id` dan `clock_out_office_id`.
  - `attendance_corrections`: satu koreksi `pending` per intern per tanggal (unique index parsial).
  - `notifications`: tabel sendiri sesuai ERD, bukan tabel bawaan Laravel.
  - `audit_logs`: kolom `admin_name`.
  - Aturan foreign key untuk penghapusan akun, lihat "Penghapusan akun" di `backend_architecture_ERD.md`.
- [x] Sanctum terpasang (`php artisan install:api`), tabel `personal_access_tokens` sudah di-migrate. Mode **token saja** (Bearer), tanpa cookie SPA. (13 Okt 2026)
- [x] Timezone aplikasi `Asia/Jakarta` (`config/app.php`). (13 Okt 2026)
- [x] **Autentikasi** (13 Okt 2026)
  - `POST /api/auth/login`: email dan password, mengembalikan `token` dan `user`. Dibatasi 5 percobaan per menit per email dan IP.
  - `GET /api/auth/me`: data akun yang login.
  - `POST /api/auth/logout`: mencabut token yang sedang dipakai.
  - `PUT /api/auth/password`: ganti password sementara (`password`, `password_confirmation`). Hanya bisa saat `must_change_password = true`. Sesi lain ikut keluar.
  - `POST /api/admin/users/{user}/reset-password`: admin membuat password sementara baru, ditampilkan sekali. Semua sesi pengguna itu berakhir, dan tindakan masuk `audit_logs`. Admin tidak bisa mereset akunnya sendiri.
  - Middleware `active` (akun nonaktif atau di luar masa magang ditolak dan tokennya dicabut), `password.changed` (endpoint lain ditolak sebelum password sementara diganti), `role:admin` dan sejenisnya.
  - `php artisan app:create-admin {email} {name}` untuk admin pertama di production.
  - Seeder development: `admin@`, `mentor@`, `intern@`, `intern.baru@injourney.test`, password `password`. `intern.baru` wajib ganti password.
  - Model: `User` (Sanctum, soft delete, enum `Role`), `InternProfile`, `AuditLog`. Service `AccountAccess`. Policy `UserPolicy`.
  - Test Pest di `tests/Feature/Auth` (31 test lolos).
- [x] **Arah setelah login per role** (16 Okt 2026)
  - `user.home_path` di respons login, `/auth/me`, dan ganti password, dari `Role::homePath()`: intern `/intern/dashboard`, mentor `/mentor/dashboard`, admin `/admin/dashboard` (alamat usulan di `docs/design-*.md`). Jika `must_change_password` true, frontend membuka Ganti Password lebih dulu.
  - Grup route `role:intern` dengan prefix `/api/intern`. `GET /api/intern/menu`: menu sidebar Intern (dashboard, attendance, tasks, leaves) berupa kunci dan alamat; label Indonesia ditampilkan frontend.
  - Test di `tests/Feature/Intern/MenuTest.php` (7 test lolos).

### Catatan integrasi frontend: Intern Alur 1

| Langkah layar | Endpoint | Yang dibaca frontend |
| --- | --- | --- |
| Login | `POST /api/auth/login` `{email, password}` | `token`, `user.must_change_password`, `user.home_path` (`/intern/dashboard`) |
| Ganti Password (jika `must_change_password`) | `PUT /api/auth/password` `{password, password_confirmation}` | `data.home_path` lalu buka halaman itu |
| Muat ulang aplikasi | `GET /api/auth/me` | `data` (termasuk `photo_url` terbaru) |
| Sidebar intern | `GET /api/intern/menu` | `data[].key`, `path` |
| Profil Saya | `PUT /api/auth/profile`, `POST` atau `DELETE /api/auth/profile/photo` | Sama dengan mentor (lihat Profil Saya di bawah) |

Akun di luar periode magang ditolak saat login (403 "Masa magang Anda belum dimulai." atau akun nonaktif).

- [x] **Dashboard Intern** `GET /api/intern/dashboard` (17 Okt 2026, docs/design-intern.md Alur 2)
  - `today`: kondisi kartu Hari Ini (`not_clocked_in`, `clocked_in`, `clocked_out`, `holiday`, `on_leave`, `outside_period`), jam clock in dan out, Daily Report terkirim, nama libur, jenis izin. `daily_report_reminder` untuk banner.
  - `monthly_recap`: hadir, izin, tidak hadir, lupa clock out, hari kerja berjalan. Hanya status final (sampai kemarin), dalam periode magang, tanpa hari libur.
  - `tasks`: jumlah To Do, In Progress, In Review, Terlambat, total, dan tenggat terdekat. `internship`: periode dan mentor. `announcements`: 3 pengumuman terbaru untuk intern.
  - Status kehadiran dihitung di `App\Services\AttendanceCalendar` (dipakai lagi untuk riwayat absensi dan Performa). Label Terlambat di `Task::isLate()`.
  - Model baru: `Attendance`, `DailyReport`, `LeaveRequest`, `Task`, `Holiday`, `Announcement` beserta factory. Enum baru: `TaskStatus`, `LeaveType`, `RequestStatus`, `AttendanceStatus`, `TodayState`.
  - Test di `tests/Feature/Intern/DashboardTest.php` (18 test lolos).

### Catatan integrasi frontend: Dashboard Intern

| Layar (design-intern.md 4) | Field | Catatan |
| --- | --- | --- |
| Kartu Hari Ini | `today.state` | Tombol Clock In untuk `not_clocked_in`, Clock Out untuk `clocked_in`, selain itu tanpa tombol |
| Jam dan tanda Terlambat | `today.clock_in_at`, `clock_out_at`, `late_minutes` | Terlambat jika `late_minutes` > 0 |
| Banner Daily Report | `daily_report_reminder` | Sudah clock in tetapi laporan belum terkirim |
| Tombol Clock In nonaktif | `today.has_active_office` false | "Belum ada kantor aktif." |
| Rekap bulan ini | `monthly_recap` | Hanya status final sampai kemarin |
| Ringkasan Task | `tasks` | `total` 0 = "Belum ada Task dari mentor"; `nearest` = tenggat terdekat |
| Periode magang dan mentor | `internship` | |
| Pengumuman | `announcements` | Disembunyikan jika kosong |

- [x] **Daftar kantor aktif untuk intern** `GET /api/intern/offices` (20 Okt 2026, docs/design-intern.md 5 dan 7)
  - Hanya kantor aktif, diurutkan nama. Tiap kantor: `id`, `name`, `latitude`, `longitude`, `clock_in_radius_meters`, `clock_out_radius_meters`.
  - Dipakai frontend untuk dropdown kantor aktif dan peta kecil: lingkaran radius serta perkiraan jarak. Perkiraan jarak hanya informasi; keputusan radius tetap di server (`AttendanceClock::officeFor()` mencatat kantor terdekat yang masuk radius, jadi kantor yang dipilih di dropdown tidak mengubah hasil server).
  - Ditolak (403) untuk mentor dan admin, (401) tanpa token.
  - Resource `App\Http\Resources\OfficeResource`. Test di `tests/Feature/Intern/OfficeTest.php` (4 test lolos).

### Catatan integrasi frontend: Daftar kantor

| Layar (design-intern.md 5 dan 7) | Endpoint | Catatan |
| --- | --- | --- |
| Dropdown kantor aktif + peta kecil | `GET /api/intern/offices` | `data[]` berisi titik dan dua radius; pakai `clock_in_radius_meters` saat clock in, `clock_out_radius_meters` saat clock out |
| Jarak perkiraan ke kantor | dihitung di browser | Haversine, hanya informasi; server tetap memeriksa radius sendiri |
| Tidak ada kantor aktif | `data` kosong dan `today.has_active_office` false | Tombol Clock In/Out nonaktif, pesan "Belum ada kantor aktif." |

- [x] **Clock In** `POST /api/intern/attendance/clock-in` (17 Okt 2026, docs/design-intern.md Alur 3)
  - Body: `latitude`, `longitude` dari browser. Jarak dihitung di backend (Haversine, `Office::distanceTo()`). Diterima jika masuk radius clock in salah satu kantor aktif; yang dicatat kantor terdekat yang masuk radius.
  - Ditolak (422, `message` dan `reason`): `outside_period`, `holiday` (akhir pekan atau tabel `holidays`), `on_leave` (izin disetujui), `already_clocked_in`, `no_active_office`, `outside_radius`. Izin Pending tidak menghalangi. Tidak ada batas jam clock in.
  - Respons 201: "Clock in berhasil pukul HH:MM." dan data absensi (`AttendanceResource`). Kartu Hari Ini di dashboard menambah `has_active_office`.
  - Logika di `App\Services\AttendanceClock`. Model `Office` dan factory-nya. Seeder menambah "Kantor Pusat Terminal 3" (titik sama dengan data contoh frontend).
  - Test di `tests/Feature/Intern/ClockInTest.php` (20 test lolos).

### Catatan integrasi frontend: Clock In

| Layar (design-intern.md 5) | Endpoint | Catatan |
| --- | --- | --- |
| Tombol Clock In | `POST /api/intern/attendance/clock-in` `{latitude, longitude}` | Koordinat dari Geolocation browser |
| Berhasil | 201 `message`, `data` | Toast dari `message` ("Clock in berhasil pukul 08:15. Anda terlambat 15 menit."), lalu muat ulang dashboard |
| Ditolak | 422 `message`, `reason` | `outside_radius`: tampilkan tombol Coba lagi; lainnya cukup `message` |

- [x] **Daily Report** `GET` dan `PUT /api/intern/attendance/daily-report` (17 Okt 2026, docs/design-intern.md Alur 4)
  - Hanya untuk hari ini, setelah clock in, dan dapat diubah sampai clock out. Satu laporan per absensi (dibuat atau diperbarui). Hari lupa clock out ikut terkunci setelah 23:59 karena bukan hari ini lagi.
  - Body: `work` (wajib, "Isi apa yang Anda kerjakan hari ini."), `notes` (opsional). Respons 201 "Daily Report terkirim." untuk kiriman pertama, 200 "Perubahan tersimpan." untuk perubahan. `sent_at` = waktu simpan terakhir, `editable` untuk tombol Ubah.
  - Ditolak (422): `not_clocked_in` ("Clock in dulu untuk mengisi Daily Report."), `clocked_out` ("Laporan terkunci setelah clock out.").
  - Logika di `App\Services\DailyReports`. Exception penolakan aturan bisnis: `ActionRejected` (respons 422 berisi `message` dan `reason`).
  - Test di `tests/Feature/Intern/DailyReportTest.php` (16 test lolos).

### Catatan integrasi frontend: Daily Report

| Layar (design-intern.md 6) | Endpoint | Catatan |
| --- | --- | --- |
| Buka formulir | `GET /api/intern/attendance/daily-report` | `data` null = belum dikirim atau belum clock in |
| Kirim atau Ubah | `PUT /api/intern/attendance/daily-report` `{work, notes}` | 201 kiriman pertama, 200 perubahan; tombol Ubah hanya jika `editable` |
| Ditolak | 422 `reason` `not_clocked_in` atau `clocked_out` | Tampilkan `message` |

- [x] **Clock Out** `POST /api/intern/attendance/clock-out` (17 Okt 2026, docs/design-intern.md Alur 5)
  - Body: `latitude`, `longitude`. Urutan pemeriksaan: Daily Report terkirim, jam pulang, lalu radius clock out kantor aktif mana pun (boleh berbeda dari kantor clock in).
  - Ditolak (422): `not_clocked_in`, `already_clocked_out`, `daily_report_missing`, `before_work_end` ("Belum saatnya clock out, tunggu 1 jam 1 menit lagi."; clock out sebelum jam pulang tidak boleh, keputusan 17 Okt 2026), `no_active_office`, `outside_radius`. Hari kemarin yang lupa clock out tidak bisa ditutup lagi.
  - Respons 200: "Clock out berhasil pukul HH:MM. Terima kasih." Daily Report ikut terkunci.
  - Jam pulang dari `work_hour_settings` yang berlaku hari itu (`WorkHourSetting::effectiveOn()`). Tanpa pengaturan jam kerja, tidak ada batas jam pulang. Kartu Hari Ini menambah `work_hours`. Seeder menambah jam kerja 08:00 sampai 17:00.
  - Logika di `App\Services\AttendanceClock::clockOut()`. Pemeriksaan radius dipakai bersama clock in.
  - Test di `tests/Feature/Intern/ClockOutTest.php` (20 test lolos).

### Catatan integrasi frontend: Clock Out

| Layar (design-intern.md 7) | Endpoint | Catatan |
| --- | --- | --- |
| Tombol Clock Out | `POST /api/intern/attendance/clock-out` `{latitude, longitude}` | Aktif setelah Daily Report terkirim |
| Berhasil | 200 `message`, `data` | Daily Report ikut terkunci |
| Ditolak | 422 `reason` | `daily_report_missing`: arahkan ke formulir laporan; `before_work_end`: `message` berisi sisa waktu; `outside_radius`: Coba lagi |

- [x] **Terlambat clock in** (17 Okt 2026, keputusan baru dari pemilik repo)
  - Clock in lewat jam masuk (`work_hour_settings.start_time` yang berlaku hari itu, saat ini 08:00) ditandai terlambat, dihitung per menit (08:00 tepat waktu, 08:01 terlambat 1 menit). Clock in tetap diterima.
  - Hanya tanda, bukan status baru: status hari itu tetap Hadir atau Lupa Clock Out. Dihitung saat dibaca (`Attendance::lateMinutes()`), tidak disimpan.
  - `late_minutes` di respons clock in, `AttendanceResource`, dan kartu Hari Ini. Rekap bulanan menambah `late` (jumlah hari terlambat). Pesan clock in: "Clock in berhasil pukul 08:15. Anda terlambat 15 menit."
  - Durasi berbahasa Indonesia di `App\Support\Duration` ("1 jam 1 menit").
  - Dokumen desain sudah diperbarui (design-intern 4.2, 5.3, 5.4, 7.1, 7.3, 17.5, 19; design-admin 2.2, 5, 9.1, 10, 12.3, 15.1, 17.1; design-mentor 5.3, 11.3). Tanda Terlambat untuk intern dan admin saja, **tidak untuk mentor**; bukan indikator KPI. Pulang lebih awal: Lupa Clock Out lalu koreksi.
- [x] **Riwayat Absensi dan Rekap Bulanan** (17 Okt 2026, docs/design-intern.md Alur 6)
  - `GET /api/intern/attendance?month=2026-10`: `recap` (hadir, izin, tidak hadir, lupa clock out, terlambat, hari kerja; hanya status final) dan `days` (terbaru lebih dulu; hari ini `ongoing` atau `not_clocked_in`, akhir pekan dan libur `holiday`). Tanpa `month`, bulan berjalan.
  - Tiap baris: jam clock in dan out, `late_minutes`, `is_corrected` (label "Dikoreksi admin"), `daily_report_sent`, `holiday_name`, `leave_type`, `can_request_correction` (hari kerja yang sudah lewat, selain Izin).
  - `selectable_months`: dari bulan mulai magang sampai bulan berjalan. Bulan di luar itu ditolak: "Bulan di luar periode magang."
  - `GET /api/intern/attendance/days/{date}`: detail satu hari, hanya baca, dengan kantor clock in dan out serta Daily Report.
  - Logika di `App\Services\AttendanceHistory`. Rekap dashboard dan riwayat memakai `AttendanceCalendar::recap()` yang sama.
  - Test di `tests/Feature/Intern/AttendanceHistoryTest.php` (18 test lolos).

### Catatan integrasi frontend: Riwayat Absensi

| Layar (design-intern.md 8) | Endpoint | Catatan |
| --- | --- | --- |
| Navigasi bulan | `GET /api/intern/attendance?month=` | Batas dari `selectable_months` |
| Ringkasan bulan | `recap` | Termasuk `late` (hari terlambat) |
| Baris harian | `days[]` | Label "Dikoreksi admin" jika `is_corrected`; tombol Koreksi jika `can_request_correction` |
| Klik baris | `GET /api/intern/attendance/days/{date}` | Kantor dan Daily Report hari itu |

- [x] **Koreksi Absensi, sisi intern** (17 Okt 2026, docs/design-intern.md Alur 7)
  - `GET`, `POST /api/intern/attendance-corrections`; `GET .../{id}`; `POST .../{id}/cancel`; `GET .../{id}/evidence` (unduh bukti setelah hak akses dicek, tanpa URL publik).
  - Body (multipart): `date`, `clock_in`, `clock_out` (HH:MM), `reason`, `evidence` (opsional, maks 2 MB, PDF/Word/Excel/PowerPoint dari `config/uploads.php`). Jam tercatat disalin sebagai pembanding. Absensi tidak berubah sampai admin menyetujui.
  - Aturan: hanya hari kerja yang sudah lewat atau hari ini dalam periode magang; satu Pending per tanggal (juga dijaga unique index); batal hanya saat Pending ("Data ini sudah diproses oleh [nama].").
  - Setiap admin aktif mendapat baris `notifications`: "Rina W. mengajukan koreksi absensi 9 Okt." (link `/koreksi`, `open` = id). Broadcast Reverb belum.
  - Riwayat absensi menambah `has_pending_correction`; tombol Koreksi tidak muncul untuk tanggal yang masih Pending.
  - Model `AttendanceCorrection`, `Notification`; policy `AttendanceCorrectionPolicy`; logika di `App\Services\AttendanceCorrections`.
  - Test di `tests/Feature/Intern/AttendanceCorrectionTest.php` (31 test lolos).

### Catatan integrasi frontend: Koreksi Absensi

| Layar (design-intern.md 9) | Endpoint | Catatan |
| --- | --- | --- |
| Tab koreksi | `GET /api/intern/attendance-corrections` | Baris: `date`, `status`, `recorded`, `requested`, `final`, `decision_note` |
| Ajukan | `POST /api/intern/attendance-corrections` (multipart `date`, `clock_in`, `clock_out`, `reason`, `evidence`) | 201 "Permintaan koreksi terkirim. Menunggu admin." |
| Detail | `GET /api/intern/attendance-corrections/{id}` | Tombol Batalkan jika `can_cancel` |
| Batalkan | `POST .../{id}/cancel` | 422 jika sudah diproses admin |
| Bukti | `GET .../{id}/evidence` | Butuh header Authorization, ambil lewat fetch lalu buka blob |

- [x] **Task intern: daftar, Kanban, detail, perpindahan** (17 Okt 2026, docs/design-intern.md Alur 8)
  - `GET /api/intern/tasks`: filter `status`, `late`, `q` (judul), `sort` (`due` default, `newest`), `include_older_done`. Kolom Done hanya 30 hari terakhir secara default (`meta.hidden_done`). Tiap kartu: mentor, tenggat, `is_late`, `late_label` ("Lewat 2 hari"), `unread_comments`, `revise_pending`, `action` (start, submit, replace).
  - `GET /api/intern/tasks/{id}`: deskripsi, `submission` (bentuk sama dengan mentor), thread komentar (`is_unread` untuk disorot), `can_comment`. Membuka detail mencatat `task_reads`, jadi indikator komentar baru hilang.
  - `POST /api/intern/tasks/{id}/move` (`to`, `from` opsional): To Do ke In Progress, In Progress ke To Do jika belum pernah dikumpulkan. Ditolak dengan pesan prototipe: `not_started`, `submission_required` (In Review hanya lewat pengumpulan, Alur 9), `ever_submitted`, `in_review_locked`, `done_locked`, `mentor_only`, `stale` ("Status Task sudah berubah. Muat ulang.").
  - Model `TaskComment`, `TaskRead`; policy `TaskPolicy`; logika di `App\Services\InternTasks`. Exception `AttendanceRejected` diganti nama menjadi `ActionRejected`.
  - Test di `tests/Feature/Intern/TaskTest.php` (24 test lolos).

### Catatan integrasi frontend: Task intern

| Layar (design-intern.md 10) | Endpoint | Catatan |
| --- | --- | --- |
| Kanban dan Daftar | `GET /api/intern/tasks` | Kolom dari `status`; Done lebih dari 30 hari lewat `meta.hidden_done` dan `include_older_done=1` |
| Kartu | `title`, `mentor`, `due_at`, `is_late`, `late_label`, `unread_comments` | Angka kecil = `unread_comments` > 0 |
| Seret kartu | `POST /api/intern/tasks/{id}/move` `{to, from}` | 422 `reason` = kembalikan kartu dan tampilkan `message` |
| Detail | `GET /api/intern/tasks/{id}` | Tombol dari `action`; banner revisi jika `revise_pending`; `submission` sama bentuknya dengan detail Task mentor |

- [x] **Kumpulkan dan Ganti Hasil Task** (17 Okt 2026, docs/design-intern.md Alur 9)
  - `POST /api/intern/tasks/{id}/submission` (multipart: `link`, `file`, `from` opsional): boleh saat In Progress (kumpul pertama atau setelah Revise) dan In Review (Ganti Hasil). Status menjadi In Review, `ever_submitted` true, `revise_pending` false. Respons: "Hasil terkumpul. Menunggu pemeriksaan mentor."
  - Pengumpulan ulang menggantikan seluruh hasil (link dan file). File lama dihapus permanen; file baru dihapus lagi jika pengumpulan gagal. Task lewat tenggat tetap diterima.
  - Validasi: "Isi link atau pilih file.", "Format link tidak valid." (harus http/https), 2 MB, jenis file dengan saran kirim lewat link (`config/uploads.php` `mimes_or_link`).
  - Ditolak: `not_started` (To Do), `done` ("Task ini sudah selesai."), `accepted` ("Task sudah diterima mentor." jika intern sedang mengganti hasil saat mentor Accept). Baris Task dikunci selama pengumpulan.
  - Notifikasi mentor sesuai design-mentor.md 14: "Rina W. mengumpulkan Task 'Laporan API'." atau "Rina W. mengganti hasil Task 'Laporan API'." (saat In Review).
  - `GET /api/intern/tasks/{id}/submission/file`: unduh file hasil sendiri (`hasil-TSK-024.pdf`).
  - Service `App\Services\TaskSubmissions`, dan `App\Services\Notifier` untuk semua baris notifikasi (koreksi absensi ikut memakainya).
  - Test di `tests/Feature/Intern/TaskSubmissionTest.php` (19 test lolos).

### Catatan integrasi frontend: Kumpulkan Hasil

| Layar (design-intern.md 11) | Endpoint | Catatan |
| --- | --- | --- |
| Dialog Kumpulkan atau Ganti Hasil | `POST /api/intern/tasks/{id}/submission` (multipart `link`, `file`, `from`) | Peringatan ganti hasil ditulis frontend |
| Hasil terkumpul di detail | `submission {link, file {name, size}, submitted_at, submitted_late, late_hours}` | `file` null = tanpa file |
| Unduh file sendiri | `GET /api/intern/tasks/{id}/submission/file` | Butuh header Authorization, ambil lewat fetch lalu buka blob |

- [x] **Komentar Task, sisi intern** (17 Okt 2026, docs/design-intern.md Alur 10)
  - `POST /api/intern/tasks/{id}/comments` (`body`): balasan masuk thread, 201. Komentar kosong atau hanya spasi: "Tulis komentar dulu." Thread terkunci pada Task Done ("Task sudah selesai dan terkunci.", `done_locked`). Tidak ada endpoint ubah atau hapus komentar.
  - Mengirim balasan mencatat `task_reads`, jadi komentar sebelumnya tidak lagi dihitung baru.
  - Notifikasi mentor Task: "Rina W. membalas komentar di 'Laporan API'." (link `/task`, `open` = id, `to` = `comments`).
  - Service `App\Services\TaskComments`, bentuk komentar di `TaskCommentResource` (dipakai juga di detail Task).
  - Test di `tests/Feature/Intern/TaskCommentTest.php` (14 test lolos).

### Catatan integrasi frontend: Komentar Task

| Layar (design-intern.md 12) | Endpoint | Catatan |
| --- | --- | --- |
| Thread di detail | `comments` dari `GET /api/intern/tasks/{id}` | Sorot `is_unread`; komentar Revise ditandai `is_revision` |
| Kirim balasan | `POST /api/intern/tasks/{id}/comments` `{body}` | Tambahkan `data` ke thread; kotak komentar disembunyikan jika `can_comment` false |

- [x] **Izin, sisi intern** (17 Okt 2026, docs/design-intern.md Alur 11)
  - `GET /api/intern/leaves` (filter `status`, tanggal izin terbaru lebih dulu), `POST /api/intern/leaves` (multipart: `type` sick/urgent, `start_date`, `end_date`, `reason`, `evidence` opsional), `GET .../{id}`, `POST .../{id}/cancel`, `GET .../{id}/evidence`, `GET /api/intern/leaves/working-days` (pratinjau "Total: 2 hari kerja").
  - Validasi sesuai validateLeave: jenis, tanggal selesai tidak sebelum mulai, dalam periode magang, minimal satu hari kerja, tidak tumpang tindih dengan izin Pending atau Disetujui (dicek dengan baris akun dikunci), alasan wajib, lampiran 2 MB dan jenis file.
  - Tanggal lampau boleh, ditandai `submitted_late` ("Diajukan setelah tanggal izin"). `working_days` dihitung saat dibaca, jadi libur yang ditambahkan admin belakangan ikut mengurangi.
  - Detail: pemroses (`decided_by` nama dan role, untuk "Diproses oleh admin"), catatan, waktu. Batal hanya saat Pending ("Izin ini sudah diproses oleh [nama].").
  - Notifikasi mentor sesuai design-mentor.md 14: "Andi P. mengajukan Izin Sakit 13-14 Okt." dan "Andi P. membatalkan pengajuan izin 13-14 Okt." Rentang tanggal lewat `IndonesianDate::range()` (sama dengan formatRange frontend).
  - Izin disetujui mengubah status absensi lewat `AttendanceCalendar` (sudah ada); hari yang sudah clock in tetap Hadir.
  - Service `App\Services\InternLeaves`, policy `LeaveRequestPolicy`, resource `InternLeaveResource`.
  - Test di `tests/Feature/Intern/LeaveTest.php` (30 test lolos).

### Catatan integrasi frontend: Izin intern

| Layar (design-intern.md 13) | Endpoint | Catatan |
| --- | --- | --- |
| Riwayat izin | `GET /api/intern/leaves?status=` | Label "Diajukan setelah tanggal izin" jika `submitted_late` |
| Pratinjau "Total: 2 hari kerja" | `GET /api/intern/leaves/working-days?start_date=&end_date=` | |
| Ajukan | `POST /api/intern/leaves` (multipart `type`, `start_date`, `end_date`, `reason`, `evidence`) | 201 "Izin diajukan. Menunggu mentor." |
| Detail | `GET /api/intern/leaves/{id}` | "Diproses oleh admin" jika `decided_by.role` = `admin`; tombol Batalkan jika `can_cancel` |
| Batalkan | `POST /api/intern/leaves/{id}/cancel` | 422 jika sudah diproses |
| Lampiran | `GET /api/intern/leaves/{id}/evidence` | Butuh header Authorization, ambil lewat fetch lalu buka blob |

- [x] **Mentor Alur 1: login pertama, arah ke Dashboard, menu sidebar** (17 Okt 2026, docs/design-mentor.md 2.2 dan 3)
  - Login dan ganti password memakai endpoint yang sama dengan role lain (`/api/auth/login`, `PUT /api/auth/password`). `user.home_path` mentor = `/mentor/dashboard`. Selama `must_change_password` true, semua endpoint mentor ditolak 403 dengan `must_change_password: true`; frontend membuka Ganti Password, lalu `home_path` dari respons ganti password.
  - Grup route `role:mentor` dengan prefix `/api/mentor` (middleware `auth:sanctum`, `active`, `password.changed`, `role:mentor`). Intern dan admin ditolak 403 "Anda tidak memiliki akses."
  - `GET /api/mentor/menu`: `data` berisi `key`, `path`, `badge` untuk dashboard, interns, tasks, leaves, leave_calendar, performance. `badge` hanya terisi pada `leaves`: jumlah izin Pending milik intern yang **saat ini** dibimbing mentor itu (izin pending ikut pindah saat ganti mentor, design-mentor.md 13). Menu lain `badge: null`. Label Indonesia ditampilkan frontend.
  - Mentor tidak dicek periode magang; cukup `is_active`.
  - Test di `tests/Feature/Mentor/MenuTest.php` (8 test lolos).
- [x] **Profil Saya, semua role** (17 Okt 2026, design-mentor.md 3.3, design-intern.md 3.3, design-admin.md 13.3)
  - `PUT /api/auth/profile` (JSON `name`, `phone`): hanya nama dan nomor telepon. Field lain (email, role, title, is_active) diabaikan karena hanya admin yang boleh mengubahnya. `phone` kosong atau tidak dikirim = dihapus.
  - `POST /api/auth/profile/photo` (multipart `photo`): JPG, PNG, atau WebP, maks 2 MB (`config/uploads.php`). Foto lama dihapus permanen. `DELETE /api/auth/profile/photo`: hapus foto.
  - Ketiganya membalas 200 `{ "message": "Perubahan tersimpan.", "data": <user> }`; `data` sama dengan `/api/auth/me`.
  - Validasi (422): "Nama wajib diisi.", "Nama maksimal 255 karakter.", "Format nomor telepon tidak valid." (angka, spasi, `-`, boleh diawali `+`, 8 sampai 20 karakter), "Pilih foto lebih dulu.", "Foto harus berupa gambar JPG, PNG, atau WebP." (SVG ditolak), "Ukuran foto maksimal 2 MB."
  - Kolom baru `users.photo_path` (migration `2026_10_17_235349_add_photo_path_to_users_table`). Data user di login, `/auth/me`, ganti password, dan profil menambah `photo_url`: alamat bertanda tangan `GET /api/users/{id}/photo?...&signature=...` yang bisa langsung dipakai di `<img src>` tanpa header Authorization. Berlaku 24 sampai 48 jam, jadi ambil ulang lewat `/auth/me` saat aplikasi dibuka. `null` = belum ada foto, tampilkan inisial.
  - Ditolak sebelum password sementara diganti (`password.changed`), sama dengan endpoint lain.
  - Logika file di `App\Services\ProfilePhotos`, controller `App\Http\Controllers\Auth\ProfileController`.
  - Test di `tests/Feature/Auth/ProfileTest.php` (20 test lolos).

### Catatan integrasi frontend: Mentor Alur 1

| Langkah layar | Endpoint | Yang dibaca frontend |
| --- | --- | --- |
| Login | `POST /api/auth/login` `{email, password}` | `token`, `user.must_change_password`, `user.home_path` |
| Ganti Password (jika `must_change_password`) | `PUT /api/auth/password` `{password, password_confirmation}` | `data.home_path` lalu buka halaman itu |
| Muat ulang aplikasi | `GET /api/auth/me` | `data` (termasuk `photo_url` terbaru) |
| Sidebar mentor | `GET /api/mentor/menu` | `data[].key`, `path`, `badge` (angka di sebelah Izin) |
| Profil Saya: simpan | `PUT /api/auth/profile` `{name, phone}` | `message` untuk toast, `data` untuk mengganti user tersimpan |
| Profil Saya: foto | `POST` atau `DELETE /api/auth/profile/photo` | `data.photo_url` |

Semua request yang sudah login memakai header `Authorization: Bearer <token>` dan `Accept: application/json`. Respons 401 berarti kembali ke Login; 403 dengan `must_change_password: true` berarti buka Ganti Password.

- [x] **Dashboard Mentor** `GET /api/mentor/dashboard` (18 Okt 2026, docs/design-mentor.md Alur 2)
  - Intern bimbingan = intern dengan `intern_profiles.mentor_id` mentor ini. Task mengikuti `tasks.mentor_id` (sama dengan penerima notifikasi pengumpulan). Izin mengikuti mentor saat ini.
  - `holiday`: `null` pada hari kerja, `{name}` pada libur (`name` null = akhir pekan). `interns_total` untuk "Belum ada intern bimbingan." (0).
  - `today`: `interns`, `clocked_in` (sudah clock in, termasuk yang sudah clock out), `on_leave` (izin disetujui, belum clock in), `not_clocked_in`. Hanya intern aktif dalam periode magang. `null` pada hari libur (kartu disembunyikan). Tanda Terlambat clock in tidak dikirim ke mentor (keputusan 17 Okt 2026).
  - Empat kotak Perlu Tindakan, masing-masing `{total, items}` dengan maksimal 5 `items` (sisanya lewat Lihat semua):
    - `review_tasks`: Task In Review, paling lama menunggu lebih dulu (`submitted_at`). Baris: `id`, `code`, `title`, `intern {id, name, short_name}`, `submitted_at`, `is_late`.
    - `pending_leaves`: izin Pending, paling lama pending lebih dulu. Baris: `id`, `intern`, `type` (sick/urgent), `start_date`, `end_date`, `created_at`, `pending_hours`, `is_overdue` (lebih dari 24 jam, tanda "!"). Sama dengan pendingHours dan isOverduePending di mock-rules.
    - `unread_comments`: Task yang punya komentar dari orang lain yang belum dibaca mentor (setelah `task_reads.last_read_at` mentor). Baris: data Task, `status`, `unread_comments`. Paling lama belum dibaca lebih dulu.
    - `late_tasks`: Task belum Done yang lewat tenggat, aturan `Task::isLate()` (In Review dinilai dari waktu pengumpulan). Tenggat paling lama lewat lebih dulu. Baris: data Task, `status`, `due_at`, `late_label` ("Lewat 2 hari").
  - Task intern nonaktif tetap tampil, karena mentor tetap bisa memeriksanya (design-mentor.md 13.2).
  - `announcements`: 3 pengumuman terbaru dengan `for_mentor` true.
  - Logika di `App\Services\MentorDashboard`, controller `App\Http\Controllers\Mentor\DashboardController`.
  - Test di `tests/Feature/Mentor/DashboardTest.php` (16 test lolos).

### Catatan integrasi frontend: Dashboard Mentor

Contoh respons (`GET /api/mentor/dashboard`, Senin 12 Okt 2026 14:39):

```json
{
  "data": {
    "date": "2026-10-12",
    "holiday": null,
    "interns_total": 6,
    "today": { "interns": 6, "clocked_in": 4, "on_leave": 1, "not_clocked_in": 1 },
    "review_tasks": {
      "total": 3,
      "items": [
        { "id": 24, "code": "TSK-024", "title": "Desain ERD",
          "intern": { "id": 7, "name": "Andi Pratama", "short_name": "Andi P." },
          "submitted_at": "2026-10-09T10:00:00+07:00", "is_late": false }
      ]
    },
    "pending_leaves": {
      "total": 2,
      "items": [
        { "id": 11, "intern": { "id": 9, "name": "Dewi Sartika", "short_name": "Dewi S." },
          "type": "urgent", "start_date": "2026-10-13", "end_date": "2026-10-13",
          "created_at": "2026-10-11T12:39:00+07:00", "pending_hours": 26, "is_overdue": true }
      ]
    },
    "unread_comments": {
      "total": 1,
      "items": [
        { "id": 30, "code": "TSK-030", "title": "Uji login",
          "intern": { "id": 12, "name": "Doni Andika", "short_name": "Doni A." },
          "status": "in_progress", "unread_comments": 2 }
      ]
    },
    "late_tasks": {
      "total": 1,
      "items": [
        { "id": 18, "code": "TSK-018", "title": "Dokumen",
          "intern": { "id": 15, "name": "Budi Kurnia", "short_name": "Budi K." },
          "status": "todo", "due_at": "2026-10-10T14:00:00+07:00", "late_label": "Lewat 2 hari" }
      ]
    },
    "announcements": [
      { "id": 3, "title": "Libur nasional", "body": "...", "author_name": "Admin Sinta", "created_at": "2026-10-10T09:00:00+07:00" }
    ]
  }
}
```

| Bagian layar (design-mentor.md 4) | Field | Catatan |
| --- | --- | --- |
| Tanggal di judul | `date` | Format tampilan di frontend ("Senin, 12 Okt 2026") |
| Banner "Hari ini hari libur: [nama]" | `holiday.name` | `holiday` tidak null = libur; `name` null = tulis "akhir pekan" |
| "Belum ada intern bimbingan. Hubungi admin untuk penugasan." | `interns_total === 0` | |
| Kartu Intern saya hari ini (N intern) | `today.*` | Tidak dirender jika `today` null |
| Task menunggu review (N) | `review_tasks` | Judul memakai `total`; Lihat semua jika `total > 5` |
| Izin pending (N) | `pending_leaves` | Meta "26 jam" dari `pending_hours`; tanda "!" jika `is_overdue` |
| Komentar baru dari intern (N) | `unread_comments` | Meta "2 baru" dari `unread_comments`; Buka membuka Task di thread komentar |
| Task terlambat (N) | `late_tasks` | Meta dari `late_label` (huruf kecil di prototipe) |
| Kosong di tiap kotak | `total === 0` | "Tidak ada yang perlu ditindak hari ini." |
| Pengumuman | `announcements` | Disembunyikan jika kosong |

Tombol Buka menuju halaman Task, Izin, dan detailnya, yang endpoint mentornya belum dibuat (Alur 5 sampai 7).

- [x] **Intern Saya** (18 Okt 2026, docs/design-mentor.md Alur 3). Semua hanya baca; mentor tidak bisa mengubah absensi, memproses koreksi, atau mengomentari Daily Report.
  - Hubungan mentor dengan intern (`relation`): `current` = mentor saat ini (`intern_profiles.mentor_id`), termasuk intern nonaktif; `former` = pernah dibimbing (baris `mentor_histories` mentor itu yang `ended_at` terisi) dan kini dibimbing mentor lain. Intern lain ditolak 403 "Anda tidak memiliki akses ke intern ini." di semua endpoint `/interns/{id}/...`.
  - `GET /api/mentor/interns?status=active|inactive|former|all&q=`: default `active`. `inactive` = dinonaktifkan admin, belum mulai, atau sudah lewat tanggal selesai (sama dengan `AccountAccess`). `all` = semua intern bimbingan saat ini. Pencarian nama tanpa beda huruf besar. Urut nama. `meta.current_total` dan `meta.former_total` untuk membedakan "Belum ada intern bimbingan." dan "Tidak ada intern pada filter ini."
  - Baris daftar: `id`, `name`, `title`, `photo_url`, `start_date`, `end_date`, `is_active`, `relation`, `ends_in_days` (0 sampai 7 untuk "! berakhir N hari lagi", selain itu null), `today_state` (nilai `TodayState` seperti dashboard intern; null untuk intern nonaktif dan `former`, tampilkan "-").
  - `GET /api/mentor/interns/{id}`: data baris ditambah `email`, `phone`, `current_mentor {id, name}` (banner mentor lama: "Intern ini sekarang dibimbing [nama]."), `selectable_months {first, last}` untuk navigasi bulan.
  - `GET /api/mentor/interns/{id}/attendance?month=2026-10`: sama dengan riwayat absensi intern, **tanpa** `late_minutes`, `recap.late`, dan kolom koreksi (Terlambat tidak untuk mentor, keputusan 17 Okt 2026). Baris: `date`, `status`, `clock_in_at`, `clock_out_at`, `is_corrected` ("Dikoreksi admin"), `daily_report_sent`, `holiday_name`, `leave_type`. Bulan di luar periode: 422 "Bulan di luar periode magang."
  - `GET /api/mentor/interns/{id}/attendance/days/{date}`: detail satu hari dengan kantor dan Daily Report lengkap, tanpa `late_minutes`. Dipakai untuk klik baris di kedua tab.
  - `GET /api/mentor/interns/{id}/daily-reports?month=`: satu baris per hari kerja (libur tidak ikut), terbaru lebih dulu: `date`, `status`, `leave_type`, `report {work, notes, sent_at}` atau null, `report_missing` (sudah clock in tanpa laporan: "Belum ada laporan").
  - `GET /api/mentor/interns/{id}/tasks`: tenggat terbaru lebih dulu; `status`, `due_at`, `is_late`, `can_open`. Mentor lama hanya melihat Task yang ia buat dan `can_open` false.
  - `GET /api/mentor/interns/{id}/leaves`: pengajuan terbaru lebih dulu; `type`, tanggal, `working_days`, `status`, `has_evidence`, `submitted_at`, `decided_by {name, role}`, `can_open` (false untuk mentor lama).
  - Mentor lama melihat seluruh absensi dan Daily Report intern (mengikuti prototipe), bukan hanya selama periode bimbingannya.
  - Model baru `MentorHistory`. Logika di `App\Services\MentorInterns`; rekap dan Daily Report di `AttendanceHistory::monthForMentor()`, `dailyReports()`, `dayForMentor()`.
  - Test di `tests/Feature/Mentor/InternTest.php` (27 test lolos).

### Catatan integrasi frontend: Intern Saya

| Layar (design-mentor.md 5) | Endpoint | Catatan |
| --- | --- | --- |
| Daftar, filter Status dan Cari | `GET /api/mentor/interns?status=&q=` | Pilihan Aktif, Nonaktif, Pernah dibimbing, Semua = `active`, `inactive`, `former`, `all` |
| Kepala detail, banner nonaktif atau mentor lama | `GET /api/mentor/interns/{id}` | Banner "Intern ini sudah nonaktif. Data hanya dapat dilihat." jika `is_active` false |
| Tab Rekap Absensi | `GET /api/mentor/interns/{id}/attendance?month=` | Navigasi bulan dari `selectable_months`. Kosong jika semua baris `holiday`: "Belum ada data absensi pada bulan ini." |
| Klik baris (absensi atau laporan) | `GET /api/mentor/interns/{id}/attendance/days/{date}` | `daily_report` null = belum ada laporan |
| Tab Daily Report | `GET /api/mentor/interns/{id}/daily-reports?month=` | Status "Terkirim" jika `report` ada; teks abu-abu "Belum ada laporan" jika `report_missing` |
| Tab Task | `GET /api/mentor/interns/{id}/tasks` | Tanda Terlambat dari `is_late`; tombol Buka hanya jika `can_open` |
| Tab Izin | `GET /api/mentor/interns/{id}/leaves` | Tombol Buka (Pending) atau Lihat hanya jika `can_open`; "Diproses oleh admin" jika `decided_by.role` = `admin` |

Tombol Chat dengan intern menunggu fitur Chat (Alur 10).

- [x] **Buat, Ubah, dan Hapus Task oleh mentor** (18 Okt 2026, docs/design-mentor.md Alur 4)
  - `POST /api/mentor/tasks` (JSON `intern_id`, `title`, `description`, `due_at`): Task baru berstatus To Do untuk **satu** intern. Kode `TSK-<id>` tiga digit (TSK-024). Respons 201 "Task dibuat. Intern sudah diberi tahu."
  - Pilihan intern di formulir memakai `GET /api/mentor/interns?status=active` (hanya intern aktif bimbingan sendiri). Intern mentor lain, nonaktif, belum mulai, atau sudah selesai magang ditolak 422 pada `intern_id`.
  - `due_at` waktu lokal Asia/Jakarta: "2026-10-15 17:00" atau "2026-10-15T17:00"; ISO dengan zona waktu juga diterima. Detik dibuang.
  - Validasi (422, pesan sama dengan validateTask): "Pilih intern untuk Task ini.", "Judul wajib diisi.", "Judul maksimal 255 karakter.", "Deskripsi wajib diisi.", "Tenggat harus setelah waktu sekarang." (kosong, bukan tanggal, atau tidak setelah sekarang).
  - `PUT /api/mentor/tasks/{id}` (JSON `title`, `description`, `due_at`): selama belum Done. Intern tidak bisa diganti (`intern_id` diabaikan). Tenggat yang **tidak diubah** boleh tetap lewat, jadi Task terlambat masih bisa diperbaiki teksnya; tenggat yang diubah harus setelah sekarang. Task Done ditolak 422 "Task sudah selesai dan terkunci." (`reason: done_locked`). Respons "Perubahan tersimpan."
  - `DELETE /api/mentor/tasks/{id}`: hanya To Do tanpa komentar. Ditolak 422: "Task yang sudah dikerjakan tidak dapat dihapus." (`not_todo`), "Task yang sudah memiliki komentar tidak dapat dihapus." (`has_comments`). Respons "Task dihapus. Intern sudah diberi tahu."
  - Ubah dan hapus hanya untuk Task yang dipegang mentor itu (`tasks.mentor_id`); selain itu 403 "Anda tidak memiliki akses ke Task ini." Baris Task dikunci saat ubah dan hapus agar tidak bertabrakan dengan pengumpulan intern.
  - `GET /api/mentor/tasks/due-check?due_at=`: `{due_on_holiday, holiday_name, warning}` untuk peringatan "Tenggat jatuh pada hari libur." (Sabtu, Minggu, atau libur admin) sebelum Simpan. Respons buat dan ubah juga membawa `warning` yang sama. Task tetap tersimpan.
  - `data` buat dan ubah: `id`, `code`, `title`, `description`, `status`, `due_at`, `is_late`, `intern {id, name, short_name}`, `created_at`, `updated_at`, `can_edit` (tombol Ubah), `can_delete` (tombol Hapus).
  - Notifikasi intern sesuai design-intern.md 16: "Task baru dari Bu Sari: Desain ERD." (`/task`, `open` = id), "Task 'Desain ERD' diubah mentor." (hanya jika ada yang berubah), "Task 'Uji login' dibatalkan mentor." (`/task` tanpa `open`).
  - Logika di `App\Services\MentorTasks`, controller `App\Http\Controllers\Mentor\TaskController`, resource `MentorTaskResource`.
  - Test di `tests/Feature/Mentor/TaskFormTest.php` (32 test lolos).

### Catatan integrasi frontend: Buat dan Ubah Task

| Layar (design-mentor.md 6) | Endpoint | Catatan |
| --- | --- | --- |
| Pilihan Intern di formulir | `GET /api/mentor/interns?status=active` | Pakai `id` dan `name` |
| Peringatan tenggat hari libur saat tanggal dipilih | `GET /api/mentor/tasks/due-check?due_at=` | Tampilkan `warning` jika tidak null; Simpan tetap aktif |
| Simpan Task baru | `POST /api/mentor/tasks` | Toast dari `message`; error per kolom dari `errors` |
| Simpan perubahan | `PUT /api/mentor/tasks/{id}` | Kirim ketiga kolom; kolom Intern dinonaktifkan |
| Hapus Task (dialog konfirmasi) | `DELETE /api/mentor/tasks/{id}` | 422 dengan `message` jika status atau komentar berubah sejak dibuka |

Daftar dan Kanban Task mentor (tempat tombol Buat Task, Ubah, dan Hapus) ada di Alur 5.

- [x] **Halaman Task mentor: Kanban, Daftar, filter, sort, pengingat terlambat** (18 Okt 2026, docs/design-mentor.md Alur 5)
  - `GET /api/mentor/tasks`: semua Task yang dipegang mentor (`tasks.mentor_id`). Satu endpoint untuk Kanban dan Daftar; frontend mengelompokkan per `status`.
  - Filter (7.4): `intern_id`, `status` (todo, in_progress, in_review, done), `late=1` (hanya Terlambat), `due_from` dan `due_to` (Y-m-d, rentang tenggat), `q` (judul). Sort: `due` (tenggat terdekat, default), `newest` (terbaru dibuat), `intern` (nama intern). Filter salah: 422 "Filter Task tidak valid."
  - Kolom Done hanya 30 hari terakhir; `meta.hidden_done` = jumlah yang disembunyikan, `include_older_done=1` untuk menampilkannya.
  - Kartu (`MentorTaskResource`): `id`, `code`, `title`, `description`, `status`, `due_at`, `is_late`, `late_label` ("Lewat 2 hari", hanya sebelum dikumpulkan), `intern {id, name, short_name}`, `submitted_at`, `done_at`, `unread_comments` (komentar intern yang belum dibaca mentor), `revision_count`, `action` (`review` = Periksa, `open` = Buka, `view` = Lihat), `can_drag` (hanya In Review), `can_edit`, `can_delete`. Bentuk ini juga dipakai respons buat dan ubah Task (Alur 4).
  - Seret kartu: hanya In Review ke Done (Accept) atau In Progress (Revise); keduanya memakai endpoint Accept dan Revise di Alur 6. Perpindahan lain ditolak di frontend dengan "Perpindahan ini tidak diizinkan." (tooltip "Status ini diubah oleh intern." atau "Task sudah selesai.").
  - **Pengingat tenggat** (7.6): `php artisan app:remind-overdue-tasks`, dijadwalkan setiap hari 07:00 di `routes/console.php`. Task To Do atau In Progress yang lewat tenggat **lebih dari 2 hari kerja** (hari kerja setelah tanggal tenggat sampai hari ini; Sabtu, Minggu, dan libur tidak dihitung) membuat notifikasi mentor sekali: "Task 'Dokumen' milik Budi K. lewat tenggat lebih dari 2 hari kerja." (`/task`, `open` = id). Contoh: tenggat Jumat 9 Okt, pengingat Rabu 14 Okt. Task milik intern nonaktif dilewati.
  - Kolom baru `tasks.overdue_reminded_at` (migration `2026_10_18_011608_add_overdue_reminded_at_to_tasks_table`) mencegah pengingat berulang. Mengubah tenggat di Ubah Task mengosongkannya, jadi tenggat baru bisa diingatkan lagi.
  - Production perlu cron `* * * * * php artisan schedule:run` di server.
  - Logika di `App\Services\MentorTasks::list()` dan `App\Services\OverdueTaskReminders`, command `App\Console\Commands\RemindOverdueTasks`.
  - Test di `tests/Feature/Mentor/TaskBoardTest.php` (21 test lolos).

### Catatan integrasi frontend: Halaman Task mentor

| Layar (design-mentor.md 7) | Sumber | Catatan |
| --- | --- | --- |
| Kolom Kanban dan jumlahnya | `data[].status` | To Do (2), In Progress (3), dst. dihitung dari `data` |
| Kartu | `title`, `intern.short_name`, `due_at` atau `done_at`, `is_late`, `unread_comments` | Angka kecil = `unread_comments` > 0 |
| Ikon kunci di kartu | `can_drag` false | Hanya In Review yang bisa diseret |
| Tombol di Daftar | `action` | `review` = Periksa, `open` = Buka, `view` = Lihat |
| Pilihan filter Intern | `GET /api/mentor/interns?status=all` | Atau `active` jika hanya intern aktif |
| Done lebih dari 30 hari | `meta.hidden_done` | Tampilkan pilihan "Semua Done" jika > 0, lalu kirim `include_older_done=1` |

- [x] **Memeriksa hasil Task: detail, komentar, Accept, Revise** (18 Okt 2026, docs/design-mentor.md Alur 6)
  - `GET /api/mentor/tasks/{id}`: data kartu (Alur 5) ditambah `submission` (`link`, `file {name, size}` dalam byte, `submitted_at`, `submitted_late`, `late_hours` untuk "(terlambat 15 jam)"), `comments` (thread lama ke baru, `is_unread` untuk disorot, `is_revision` untuk komentar Revise), `can_review` (tombol Accept dan Revise, hanya In Review), `can_comment` (false saat Done), `intern_is_active`, `revise_warning`. Membuka detail mencatat `task_reads` mentor, jadi indikator komentar baru di kartu dan kotak Dashboard hilang.
  - `GET /api/mentor/tasks/{id}/submission/file`: Unduh (`hasil-TSK-024.pdf`); `?inline=1` untuk Pratinjau di tab baru. Tanpa URL publik.
  - `POST /api/mentor/tasks/{id}/comments` (`body`): 201. Kosong: "Tulis komentar dulu." Done: 422 "Task sudah selesai dan terkunci." (`done_locked`). Intern mendapat "Bu Sari berkomentar di 'Desain ERD'." (`/task`, `open`, `to: comments`).
  - `POST /api/mentor/tasks/{id}/accept` (`comment` opsional, `submitted_at`): In Review menjadi Done, `done_at` terisi, `revise_pending` false. "Task diterima dan ditandai Done." Intern mendapat "Task 'Laporan API' diterima." Intern nonaktif tetap bisa di-Accept.
  - `POST /api/mentor/tasks/{id}/revise` (`comment` wajib: "Komentar revisi wajib diisi.", `submitted_at`): kembali ke In Progress, `revise_pending` true, `revision_count` + 1, komentar disimpan dengan `is_revision` true. "Revisi terkirim. Task kembali ke In Progress." Intern mendapat "Task 'Laporan API' perlu direvisi." (`to: comments`). Intern nonaktif tetap bisa direvisi; respons membawa `warning` "Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi."
  - Seret kartu Kanban In Review ke Done = `accept`, ke In Progress = `revise` (setelah dialog komentar).
  - Perubahan bersamaan (8.6), baris Task dikunci: kirim `submitted_at` dari detail atau kartu; jika intern sudah mengganti hasil, 422 "Hasil baru dikumpulkan. Muat ulang." (`resubmitted`). Jika status bukan In Review lagi, 422 "Status Task sudah berubah. Muat ulang." (`stale`).
  - Mentor lama yang Task-nya sudah pindah ke mentor baru: 403 "Intern ini sudah dipindahkan ke mentor lain." (13.1). Mentor lain: 403 "Anda tidak memiliki akses ke Task ini." Berlaku juga untuk ubah dan hapus Task.
  - Logika di `App\Services\MentorTaskReview`, resource `MentorTaskDetailResource`, endpoint di `App\Http\Controllers\Mentor\TaskController`.
  - Test di `tests/Feature/Mentor/TaskReviewTest.php` (22 test lolos).

### Catatan integrasi frontend: Detail Task, Accept, Revise

| Layar (design-mentor.md 8) | Endpoint | Catatan |
| --- | --- | --- |
| Panel detail | `GET /api/mentor/tasks/{id}` | Simpan `submission.submitted_at` untuk dikirim saat Accept atau Revise |
| "Dikumpulkan: 12 Okt 08:30 (terlambat 15 jam)" | `submission.submitted_at`, `submission.late_hours` | `late_hours` null jika tepat waktu |
| Link hasil [Buka] | `submission.link` | Buka di tab baru |
| File [Pratinjau] [Unduh] | `GET .../submission/file?inline=1` dan tanpa `inline` | Butuh header Authorization, jadi unduh lewat fetch lalu buka blob |
| Kirim komentar | `POST .../comments` | Tambahkan `data` ke thread |
| Dialog Accept | `POST .../accept` | Komentar opsional |
| Dialog Revise | `POST .../revise` | Tampilkan `revise_warning` dari detail di dialog jika tidak null |
| 422 `resubmitted` atau `stale` | - | Tampilkan `message`, muat ulang detail, kembalikan kartu ke kolom asal |

- [x] **Memproses izin oleh mentor** (18 Okt 2026, docs/design-mentor.md Alur 7)
  - Cakupan: izin milik intern yang **saat ini** dibimbing (`intern_profiles.mentor_id`), termasuk riwayat yang diputuskan mentor sebelumnya. Izin intern lain: 403 "Anda tidak memiliki akses ke izin ini."
  - `GET /api/mentor/leaves?tab=pending|all&type=sick|urgent&intern_id=`: default tab `pending`. Urutan: Pending lebih dulu dari yang paling lama pending (9.2), sisanya pengajuan terbaru. `meta.pending_count` untuk "Pending (2)", tidak terpengaruh filter.
  - Baris (`MentorLeaveResource`): `intern {id, name, short_name}`, `type`, `start_date`, `end_date`, `working_days`, `has_evidence` ("Tanpa bukti" jika false), `status`, `submitted_at`, `submitted_late`, `pending_hours` ("diajukan 14 jam lalu"; null jika bukan Pending), `is_overdue` (lebih dari 24 jam, "! pending 26 jam"), `decided_by {name, role}`, `decided_at`, `can_decide` (Buka untuk Pending, Lihat selain itu).
  - `GET /api/mentor/leaves/{id}`: baris ditambah `reason`, `decision_note`, `evidence {name, size}`.
  - `GET /api/mentor/leaves/{id}/evidence`: Unduh (`lampiran-izin-2026-10-13.pdf`); `?inline=1` untuk Pratinjau. Tanpa URL publik.
  - `POST /api/mentor/leaves/{id}/approve` dan `/reject` (`note` wajib: "Catatan wajib diisi.", maks 1000 karakter): "Izin disetujui. Intern sudah diberi tahu." atau "Izin ditolak. Intern sudah diberi tahu." Izin tanpa lampiran tetap boleh diputuskan mentor (syarat bukti hanya untuk admin).
  - Izin disetujui langsung terbaca sebagai Izin di absensi hari kerja yang tercakup (dihitung `AttendanceCalendar`, tanpa menulis ulang absensi), juga di Rekap Absensi, Dashboard, dan kalender izin.
  - Notifikasi intern (design-intern.md 16): "Izin Sakit 13-14 Okt disetujui." atau "... ditolak." (`/izin`, `open` = id). Catatan dibaca intern di detail izin.
  - Sudah tidak Pending saat keputusan dikirim (9.4), baris izin dikunci: 422 "Pengajuan ini sudah dibatalkan intern." (`cancelled`), "Izin ini sudah diproses oleh admin." atau "Izin ini sudah diproses oleh [nama mentor]." (`already_processed`). Keputusan tidak bisa diubah.
  - `App\Services\LeaveDecisions` dibuat netral role, jadi bisa dipakai lagi untuk admin (tambahkan syarat bukti dan `audit_logs` di sisi admin). Daftar di `App\Services\MentorLeaves`, controller `App\Http\Controllers\Mentor\LeaveController`.
  - Test di `tests/Feature/Mentor/LeaveTest.php` (21 test lolos).

### Catatan integrasi frontend: Izin mentor

| Layar (design-mentor.md 9) | Endpoint | Catatan |
| --- | --- | --- |
| Tab Pending (N) dan Semua | `GET /api/mentor/leaves?tab=pending` atau `tab=all` | Angka tab dari `meta.pending_count` |
| Filter Jenis dan Intern | `type`, `intern_id` | Pilihan intern dari `GET /api/mentor/interns?status=all` |
| Detail | `GET /api/mentor/leaves/{id}` | Label "Tanpa bukti" jika `has_evidence` false |
| Lampiran [Pratinjau] [Unduh] | `GET .../evidence?inline=1` dan tanpa `inline` | Butuh header Authorization, ambil lewat fetch lalu buka blob |
| Tombol Setujui dan Tolak | `POST .../approve` dan `.../reject` `{note}` | Tombol nonaktif selama catatan kosong; hanya tampil jika `can_decide` |
| 422 `cancelled` atau `already_processed` | - | Tampilkan `message`, muat ulang detail sebagai hanya baca |

- [x] **Kalender Izin mentor** (18 Okt 2026, docs/design-mentor.md Alur 8). Hanya baca.
  - `GET /api/mentor/leave-calendar?month=2026-10&intern_id=`: tanpa `month`, bulan berjalan. Bulan tidak dibatasi periode magang. Format salah: 422 "Format bulan tidak valid."
  - `days`: setiap tanggal di bulan itu: `date`, `weekday` (1 = Senin sampai 7 = Minggu, untuk sel kosong di awal bulan), `is_today`, `is_off` (Sabtu, Minggu, atau libur admin; abu-abu), `holiday_name` (null pada akhir pekan, tulis "libur"), `entries` (`leave_id`, `intern_id`, `short_name`, `type`, `status`). Hari off selalu tanpa entri.
  - Hanya izin **Pending** (garis tepi) dan **Disetujui** (warna penuh) milik intern yang saat ini dibimbing. Ditolak dan dibatalkan tidak tampil. Izin yang melewati batas bulan ikut tampil pada tanggal yang masuk bulan itu.
  - `leaves`: daftar izin yang tampil bulan itu (`id`, `intern`, `type`, `start_date`, `end_date`, `status`) untuk ringkasan saat entri diklik. Kosong = "Tidak ada izin pada bulan ini."
  - Logika di `App\Services\MentorLeaveCalendar`, controller `App\Http\Controllers\Mentor\LeaveCalendarController`.
  - Test di `tests/Feature/Mentor/LeaveCalendarTest.php` (6 test lolos).

### Catatan integrasi frontend: Kalender Izin

| Layar (design-mentor.md 10) | Sumber | Catatan |
| --- | --- | --- |
| Navigasi bulan | `?month=` | Bebas maju mundur |
| Filter Intern | `?intern_id=` | Pilihan dari `GET /api/mentor/interns?status=all` |
| Sel tanggal | `data.days[]` | Sel kosong sebelum tanggal 1 = `weekday` tanggal 1 dikurangi 1 |
| Chip "Andi (S)" | `entries[].short_name`, `type` | `pending` bergaris tepi, `approved` penuh; 3 chip lalu "+N lagi" |
| Klik chip | `data.leaves` dicari dengan `leave_id` | Tautan Buka izin ke `/mentor/leaves` dengan id itu |

- [x] **Performa Intern: rekap kehadiran dan KPI** (18 Okt 2026, docs/design-mentor.md Alur 9). Hanya baca, tanpa export dan tanpa nilai.
  - `GET /api/mentor/performance?month=2026-10&intern_id=`: tanpa `month`, bulan berjalan. Request filter dipakai bersama Kalender Izin (`MonthFilterRequest`).
  - Rumus **sama dengan prototipe** (`performance.tsx`, `mock-rules.ts`), hanya status final sampai kemarin, Sabtu, Minggu, dan libur tidak dihitung:
    - Kehadiran = Hadir / (hari kerja - Izin). Lupa Clock Out tidak dihitung Hadir.
    - Task tepat waktu = Task Done yang dikumpulkan paling lambat tenggat / Task yang tenggatnya di bulan itu (`tasks_on_time` / `tasks_due` untuk "(8/10)").
    - Daily Report = hari Hadir dengan laporan / hari Hadir.
    - Revise = jumlah Revise pada Task bertenggat di bulan itu, informasi saja.
    - `late_tasks_now` = Task yang terlambat saat ini (kolom "Task terlambat saat ini" di prototipe), tidak bergantung bulan.
    - Terlambat clock in **bukan** KPI dan tidak dikirim ke mentor (keputusan 17 Okt 2026).
  - Persen dikirim sebagai bilangan bulat 0 sampai 100; null jika penyebut 0 (tampilkan "—").
  - `kpi.enough_data` false jika hari kerja final kurang dari 5: tampilkan "Data belum cukup" di baris KPI. `summary` (kartu Ringkasan) = rata-rata intern yang datanya cukup.
  - `interns`: intern bimbingan saat ini yang punya hari kerja atau Task bertenggat di bulan itu, urut nama, dengan `is_active` untuk label "Nonaktif". `interns_total` 0 = "Belum ada data. Hubungi admin untuk penugasan intern."; `interns` kosong = "Belum ada data pada periode ini."
  - `selectable_months {first, last}`: dari bulan mulai magang paling awal sampai bulan berjalan.
  - Logika di `App\Services\MentorPerformance` (memakai `AttendanceCalendar` yang sama dengan rekap absensi), controller `App\Http\Controllers\Mentor\PerformanceController`.
  - Test di `tests/Feature/Mentor/PerformanceTest.php` (7 test lolos).

### Catatan integrasi frontend: Performa Intern

| Layar (design-mentor.md 11) | Field | Catatan |
| --- | --- | --- |
| Periode dan Intern | `?month=`, `?intern_id=` | Pilihan bulan dari `selectable_months` |
| Kartu Ringkasan | `summary.attendance_rate`, `on_time_rate`, `daily_report_rate` | null = "—"; keterangan "Rata-rata intern dengan data cukup" |
| Rekap kehadiran | `interns[].recap` | Label "Nonaktif" jika `is_active` false |
| KPI per intern | `interns[].kpi` | Jika `enough_data` false: satu sel "Data belum cukup" |
| Catatan kecil | - | "KPI hanya untuk pemantauan dan bukan nilai intern." ditulis frontend |

- [x] **Penyeragaman kode intern dan mentor** (18 Okt 2026)
  - **Pesan 403 berbahasa Indonesia untuk intern.** Sebelumnya policy intern hanya mengembalikan true/false, sehingga Laravel membalas "This action is unauthorized." Sekarang: "Anda tidak memiliki akses ke Task ini.", "... ke izin ini.", "... ke permintaan koreksi ini."
  - **Akses lewat policy di kedua role.** Mentor tidak lagi memakai `abort_if` di controller: `TaskPolicy::manage` (termasuk "Intern ini sudah dipindahkan ke mentor lain."), `LeaveRequestPolicy::manage`, `UserPolicy::viewAsMentor`. Semua controller memanggil `Gate::authorize()`.
  - **Bentuk `submission` sama** di detail Task intern dan mentor: `{link, file: {name, size} | null, submitted_at, submitted_late, late_hours}`. Field `has_file` intern diganti `file` (null = tanpa file). Dibentuk `Task::submissionData()`.
  - **Nama field sama:** jumlah komentar belum dibaca selalu `unread_comments` (kotak Dashboard mentor sebelumnya `unread_count`).
  - **Satu sumber untuk aturan bersama** (di model): `TaskComment::scopeUnreadFor()` (komentar belum dibaca), `Task::markCommentsRead()`, `Task::withoutOldDone()` (Done lebih dari 30 hari), `Task::STALE`, `Task::DONE_LOCKED`, `Task::DONE_DAYS`, `Task::submissionFileName()`, `LeaveRequest::pendingHours()`, `isOverduePending()`, `evidenceFileName()`, `LeaveRequest::OVERDUE_PENDING_HOURS`.
  - **Request bersama** dipindah ke `App\Http\Requests\Shared`: `AttendanceHistoryRequest`, `TaskCommentRequest`, lalu (20 Okt 2026) `LeaveDecisionRequest` dan `ReviewerLeaveIndexRequest` (dulu `Mentor\LeaveIndexRequest`) yang dipakai mentor dan admin. `LeaveRequestResource` (khusus intern) diganti nama `InternLeaveResource`, sejajar dengan `MentorLeaveResource`.
  - Daftar dengan `meta` ditulis sama di kedua role (`response()->json(['data' => Resource::collection(...), 'meta' => ...])`); service mengembalikan data, controller yang membentuk respons.
  - Tabel "Catatan integrasi frontend" ditambahkan untuk setiap alur intern.

- [x] **Admin Alur 1: login pertama, arah ke Dashboard, menu sidebar** (20 Okt 2026, docs/design-admin.md 2.1, 2.2, dan 3)
  - Login dan ganti password memakai endpoint yang sama dengan role lain. `user.home_path` admin = `/admin/dashboard`. Selama `must_change_password` true, semua endpoint admin ditolak 403 dengan `must_change_password: true`.
  - `GET /api/admin/menu`: `data` berisi `key`, `path`, `badge` untuk dashboard, users, attendance, corrections, leaves, warnings, announcements, reports, settings, offices, audit_log (alamat dari design-admin.md 2.2). Intern dan mentor ditolak 403 "Anda tidak memiliki akses."
  - `badge` hanya terisi pada `corrections` (semua koreksi absensi Pending) dan `leaves` (izin Pending **lebih dari 24 jam**, karena admin hanya memproses izin yang menggantung; sama dengan `isOverduePending` di prototipe). Menu lain `badge: null`.
  - Scope baru `LeaveRequest::scopeOverduePending()`: versi query dari `isOverduePending()` (24 jam 1 menit ke atas), dipakai lagi untuk Dashboard dan daftar Izin admin.
  - Test di `tests/Feature/Admin/MenuTest.php` (9 test lolos).

### Catatan integrasi frontend: Admin Alur 1

| Langkah layar | Endpoint | Yang dibaca frontend |
| --- | --- | --- |
| Login | `POST /api/auth/login` `{email, password}` | `token`, `user.role` (`admin`), `user.must_change_password`, `user.home_path` (`/admin/dashboard`) |
| Ganti Password (jika `must_change_password`) | `PUT /api/auth/password` `{password, password_confirmation}` | `data.home_path` lalu buka halaman itu |
| Muat ulang aplikasi | `GET /api/auth/me` | `data.role` untuk menentukan sidebar dan Dashboard role |
| Sidebar admin | `GET /api/admin/menu` | `data[].key`, `path`, `badge` (angka di sebelah Koreksi dan Izin) |

Contoh respons `GET /api/admin/menu`:

```json
{ "data": [
  { "key": "dashboard", "path": "/admin/dashboard", "badge": null },
  { "key": "users", "path": "/admin/users", "badge": null },
  { "key": "attendance", "path": "/admin/attendance", "badge": null },
  { "key": "corrections", "path": "/admin/corrections", "badge": 2 },
  { "key": "leaves", "path": "/admin/leaves", "badge": 1 },
  { "key": "warnings", "path": "/admin/warnings", "badge": null },
  { "key": "announcements", "path": "/admin/announcements", "badge": null },
  { "key": "reports", "path": "/admin/reports", "badge": null },
  { "key": "settings", "path": "/admin/settings", "badge": null },
  { "key": "offices", "path": "/admin/offices", "badge": null },
  { "key": "audit_log", "path": "/admin/audit-log", "badge": null }
] }
```

Temuan untuk tim frontend (tidak diubah dari sisi backend): role tampilan di `MockProvider` selalu mulai dari `Intern` dan hanya disamakan dengan akun saat submit login (`LoginPage`). Setelah halaman dimuat ulang, admin yang masih login melihat sidebar dan Dashboard intern. Role perlu diambil dari `auth.user.role` (hasil `/api/auth/me`) setiap kali sesi dipulihkan.

- [x] **Dashboard Admin** `GET /api/admin/dashboard` (20 Okt 2026, docs/design-admin.md Alur 3)
  - Intern yang dihitung: akun aktif (`is_active`) dan tanggal itu masuk periode magangnya (aturan sama dengan `AccountAccess`). Data intern yang sudah dihapus tidak ikut di kotak mana pun.
  - `holiday`: `{name}` pada akhir pekan (`name` null) atau libur admin, selain itu null. `has_active_office` untuk banner "Belum ada kantor aktif. Intern tidak bisa clock in."
  - `today` (null pada hari libur): `interns`, `clocked_in` (termasuk yang sudah clock out), `on_leave` (izin disetujui, belum clock in), `not_clocked_in`, `late` dan `late_interns` (isi daftar saat kartu Terlambat diklik: `intern`, `clock_in_at`, `late_minutes`; urut jam clock in). Terlambat hanya tanda, jadi tetap dihitung Sudah Clock In. Tanpa pengaturan jam kerja, tidak ada yang terlambat.
  - `yesterday`: status final **hari kerja sebelumnya** (Senin melihat Jumat, libur dilewati), sama dengan prototipe: `date`, `present`, `leave`, `absent`, `missed_clock_out`. Terlambat tidak ikut. Intern yang hari terakhir magangnya tanggal itu tetap dihitung.
  - Tiga kotak Perlu Tindakan berbentuk `{total, items}`, maksimal 5 baris (Lihat semua jika `total > 5`):
    - `overdue_leaves`: izin Pending lebih dari 24 jam, paling lama lebih dulu. Baris: `id`, `intern`, `type`, `start_date`, `end_date`, `created_at`, `pending_hours`.
    - `pending_corrections`: koreksi Pending, paling lama diajukan lebih dulu. Baris: `id`, `intern`, `date`, `created_at`.
    - `ending_internships`: intern aktif yang selesai hari ini sampai 7 hari lagi, paling dekat lebih dulu. Baris: `intern`, `end_date`, `ends_in_days` (0 = hari terakhir, ditambahkan 23 Okt 2026), `mentor {id, name}` (untuk Tanya mentor). Lihat semua: `GET /api/admin/ending-internships` (Alur 6).
  - `intern` di semua baris: `{id, name, short_name}`.
  - Badge menu Koreksi dan Izin (`/api/admin/menu`) sama dengan `total` kedua kotak itu.
  - Logika di `App\Services\AdminDashboard`, controller `App\Http\Controllers\Admin\DashboardController`.
  - Test di `tests/Feature/Admin/DashboardTest.php` (15 test lolos).

### Catatan integrasi frontend: Dashboard Admin

Contoh respons (`GET /api/admin/dashboard`, Senin 12 Okt 2026 14:39):

```json
{ "data": {
  "date": "2026-10-12",
  "holiday": null,
  "has_active_office": true,
  "today": {
    "interns": 24, "clocked_in": 18, "on_leave": 2, "not_clocked_in": 4, "late": 1,
    "late_interns": [
      { "intern": { "id": 7, "name": "Rina Wulandari", "short_name": "Rina W." }, "clock_in_at": "08:15", "late_minutes": 15 }
    ]
  },
  "yesterday": { "date": "2026-10-09", "present": 20, "leave": 2, "absent": 1, "missed_clock_out": 1 },
  "overdue_leaves": { "total": 1, "items": [
    { "id": 12, "intern": { "id": 9, "name": "Andi Pratama", "short_name": "Andi P." }, "type": "sick",
      "start_date": "2026-10-13", "end_date": "2026-10-14", "created_at": "2026-10-11T08:39:00+07:00", "pending_hours": 30 }
  ] },
  "pending_corrections": { "total": 1, "items": [
    { "id": 4, "intern": { "id": 7, "name": "Rina Wulandari", "short_name": "Rina W." }, "date": "2026-10-09", "created_at": "2026-10-10T09:12:00+07:00" }
  ] },
  "ending_internships": { "total": 1, "items": [
    { "intern": { "id": 7, "name": "Rina Wulandari", "short_name": "Rina W." }, "end_date": "2026-10-17", "ends_in_days": 5, "mentor": { "id": 2, "name": "Budi Santoso" } }
  ] }
} }
```

| Bagian layar (design-admin.md 5) | Field | Catatan |
| --- | --- | --- |
| Banner libur | `holiday` | "Hari ini hari libur: [nama]"; `name` null = akhir pekan. Kartu hari ini disembunyikan (`today` null) |
| Banner kantor | `has_active_office` false | Tautan ke Lokasi Kantor |
| Kartu Sudah Clock In, Izin, Belum Clock In | `today.clocked_in`, `on_leave`, `not_clocked_in` | Judul panel memakai `today.interns` |
| Kartu Terlambat | `today.late`, `late_interns` | Klik membuka daftar nama, jam clock in, lama terlambat |
| Ringkasan kemarin | `yesterday` | Label tanggal dari `yesterday.date` (bisa Jumat saat Senin) |
| Izin pending > 24 jam | `overdue_leaves` | Buka: `/izin?open={id}`; meta "`pending_hours` jam" |
| Permintaan koreksi | `pending_corrections` | Buka: `/koreksi?open={id}`; tanggal absensi `date` |
| Magang berakhir dalam 7 hari | `ending_internships` | Tanya mentor memakai `mentor.name`; Perpanjang dan Lihat semua lihat "Akhir periode magang" (Alur 6) |
| Kotak kosong | `total === 0` | "Tidak ada yang perlu ditindak hari ini." |

- [x] **Kelola Akun Pengguna** (20 Okt 2026, docs/design-admin.md Alur 2). Semua tindakan yang mengubah data masuk `audit_logs` (aksi `Akun`, objek nama akun).
  - `GET /api/admin/users?q=&role=&status=&page=`: 10 per halaman, urut nama. `q` mencari nama atau email tanpa beda huruf besar. `status` = `active` (default; termasuk intern yang belum mulai, seperti prototipe), `inactive` (dinonaktifkan admin atau intern yang sudah lewat tanggal selesai), `all`. Baris: `id`, `name`, `email`, `role`, `title`, `status` (`active`, `not_started` = "Belum dimulai", `inactive`), `mentor {id, name}`, `start_date`, `end_date` (null untuk mentor dan admin). `meta`: `current_page`, `last_page`, `per_page`, `total`.
  - `GET /api/admin/mentors`: mentor aktif (`id`, `name`, `title`), urut nama, untuk pilihan di Tambah Akun dan Ganti Mentor.
  - `POST /api/admin/users`: `name`, `email`, `role`, `title` (opsional, kosong = label role), untuk intern juga `mentor_id` (mentor aktif), `start_date`, `end_date` (tidak boleh sebelum tanggal mulai, design-admin.md 4.2; sama dengan tanggal mulai boleh). Respons 201 berisi `data` (detail akun) dan `temporary_password` (**hanya tampil sekali**). Akun baru `must_change_password = true`. Intern langsung mendapat `intern_profiles` dan baris pertama `mentor_histories` (`started_at` = tanggal mulai). Email boleh memakai ulang email akun yang sudah dihapus.
  - `GET /api/admin/users/{id}`: baris daftar ditambah `phone`, `photo_url`, `is_active`, `must_change_password`, `created_at`, lalu `former_mentors [{id, name}]` (intern) atau `interns [{id, name, status}]` (mentor, intern bimbingan saat ini). Akun yang dihapus: 404.
  - `PUT /api/admin/users/{id}`: `name`, `email`, `title` (kosong = tetap), untuk intern juga `start_date`, `end_date`. `role` dan `mentor_id` diabaikan (role tidak bisa diubah, mentor lewat Ganti mentor).
  - `GET /api/admin/users/{id}/mentor-change`: ringkasan dampak (`current_mentor`, `active_tasks` = Task belum Done, `comments` di Task itu, `pending_leaves`).
  - `POST /api/admin/users/{id}/mentor` `{mentor_id}`: Task belum Done pindah ke mentor baru (`tasks.mentor_id`), Task Done tetap milik mentor lama. Izin Pending ikut pindah karena izin mengikuti mentor saat ini. `mentor_histories`: baris terbuka ditutup (`ended_at` = hari ini) dan baris baru dibuat; intern tanpa riwayat (data seeder lama) mendapat baris mentor lama dulu, agar mentor lama tetap melihatnya lewat "Pernah dibimbing". Notifikasi: intern "Mentor Anda sekarang [nama].", mentor baru "Intern [nama] kini menjadi bimbingan Anda.", mentor lama "Intern [nama] tidak lagi menjadi bimbingan Anda." (teks prototipe). Ditolak: `same_mentor` ("Pilih mentor baru."), `not_intern`.
  - `POST /api/admin/users/{id}/deactivate`: semua token akun itu dicabut. Ditolak (422 `reason`): `self` ("Anda tidak bisa menonaktifkan akun Anda sendiri."), `last_admin` ("Minimal harus ada satu admin aktif.", design-admin.md 15.5; hanya terpicu saat dua admin saling menonaktifkan bersamaan, karena admin tidak bisa menonaktifkan dirinya sendiri), `mentor_has_interns` ("Mentor ini masih memiliki intern aktif. Pindahkan intern ke mentor lain lebih dulu."), `already_inactive`.
  - `POST /api/admin/users/{id}/activate`. Ditolak: `internship_ended` ("Aktifkan kembali intern dengan memperbarui tanggal selesai magang."; frontend lalu membuka dialog Perpanjang), `already_active`.
  - Reset password tetap `POST /api/admin/users/{id}/reset-password`; pembuat password sementara kini satu tempat (`AccountManagement::temporaryPassword()`).
  - Logika di `App\Services\AdminUsers` (baca) dan `App\Services\AccountManagement` (ubah). Status akun dihitung `AccountAccess::status()` (enum `AccountStatus`), aturan sama dengan izin login.
  - Test di `tests/Feature/Admin/UserTest.php` (49 test lolos).

Keputusan di Alur 2 (aturan backend mengikuti docs/design-admin.md, bukan prototipe frontend; keputusan pemilik repo 20 Okt 2026):

- "Intern aktif" yang menghalangi nonaktif mentor = intern yang belum dinonaktifkan dan belum lewat tanggal selesai, **termasuk yang belum mulai**, agar intern yang akan mulai tidak kehilangan mentor.
- Pesan admin terakhir dan aturan tanggal selesai mengikuti design-admin.md (15.5 dan 4.2).
- Selalu ada minimal satu admin aktif: seeder membuat `admin@injourney.test` (development), `php artisan app:create-admin` membuat admin pertama (production), admin tidak bisa menonaktifkan dirinya sendiri, dan nonaktif bersamaan dikunci di database.

### Catatan integrasi frontend: Kelola Akun

| Layar (design-admin.md 4) | Endpoint | Catatan |
| --- | --- | --- |
| Daftar, Cari, Role, Status, halaman | `GET /api/admin/users?q=&role=&status=&page=` | "Menampilkan 1-10 dari 24" dari `meta`; status `not_started` = "Belum dimulai" |
| Menu Nonaktifkan atau Aktifkan | `status` baris | `active`/`not_started` = Nonaktifkan; `inactive` = Aktifkan |
| Pilihan mentor | `GET /api/admin/mentors` | Ganti mentor: sembunyikan `mentor.id` saat ini |
| Tambah Akun | `POST /api/admin/users` | Tampilkan `temporary_password` sekali dengan tombol Salin |
| Detail, tab Profil | `GET /api/admin/users/{id}` | "Mentor sebelumnya" dari `former_mentors`; "Intern bimbingan" dari `interns` |
| Ubah data | `PUT /api/admin/users/{id}` | Error per kolom dari `errors` (422) |
| Ganti mentor | `GET .../mentor-change` lalu `POST .../mentor` | "N Task aktif beserta M komentar", "N izin Pending" |
| Reset password | `POST .../reset-password` | `temporary_password` sekali |
| Nonaktifkan, Aktifkan | `POST .../deactivate`, `POST .../activate` | Penolakan 422 `message` untuk toast; `internship_ended` membuka dialog Perpanjang |

| Tab Absensi | `GET /api/admin/users/{id}/attendance?month=` lalu `.../attendance/days/{date}` | Lihat "Tab detail intern" di bawah |
| Tab Izin, Koreksi | `GET /api/admin/users/{id}/leaves`, `.../corrections` | |
| Tab Warning | `GET`/`POST /api/admin/users/{id}/warnings`, `PUT /api/admin/warnings/{id}` | Lihat "Warning" di bawah |

- [x] **Tab detail intern: Absensi, Izin, Koreksi** (20 Okt 2026, docs/design-admin.md 4.3). Hanya baca. Akun bukan intern ditolak 422 `not_intern` ("Akun ini bukan intern.").
  - `GET /api/admin/users/{id}/attendance?month=2026-10`: bentuk sama dengan riwayat absensi intern (`month`, `selectable_months`, `recap` termasuk `late`, `days` terbaru lebih dulu). Tiap hari: `date`, `status`, `clock_in_at`, `clock_out_at`, `late_minutes` (tanda Terlambat untuk admin, design-admin.md 2.2), `is_corrected` ("Dikoreksi admin"), `daily_report_sent`, `daily_report_work` (isi kolom Daily Report), `holiday_name`, `leave_type`, `has_pending_correction`. Bulan di luar periode: 422 "Bulan di luar periode magang."
  - `GET /api/admin/users/{id}/attendance/days/{date}`: detail satu hari dengan Terlambat, kantor clock in dan clock out, dan Daily Report lengkap (sama dengan detail hari milik intern).
  - `GET /api/admin/users/{id}/leaves`: semua izin, pengajuan terbaru lebih dulu: `id`, `type`, tanggal, `working_days`, `status`, `has_evidence`, `submitted_at`, `decided_by {name, role}`, `decision_note`, `decided_at`.
  - `GET /api/admin/users/{id}/corrections`: semua koreksi, terbaru lebih dulu: `id`, `date`, `submitted_at`, `status`, `recorded`, `requested`, `reason`, `has_evidence`, `decision_note` (kolom "Catatan admin"), `decided_by` (nama), `decided_at`.
  - Logika: `AttendanceHistory::monthForAdmin()`, `AdminUsers::leaves()`, `corrections()`. Controller `App\Http\Controllers\Admin\InternRecordController`.
  - Test di `tests/Feature/Admin/InternRecordTest.php` (10 test lolos).

- [x] **Warning** (20 Okt 2026, docs/design-admin.md Alur 8). Menu Warning dan tab Warning di detail intern memakai endpoint yang sama. Hanya admin; intern dan mentor 403.
  - `GET /api/admin/warnings?q=`: daftar intern (kiri halaman) dengan `warnings` (jumlah catatan), urut nama.
  - `GET /api/admin/users/{id}/warnings`: `late_this_month` ("Terlambat bulan ini: 3 kali", termasuk hari ini; tidak ada warning otomatis) dan `warnings` terbaru lebih dulu: `id`, `body`, `author {id, name}`, `created_at`, `updated_at`, `can_edit` (pembuat, dalam 24 jam; selain itu "Terkunci.").
  - `POST /api/admin/users/{id}/warnings` `{body}`: 201 "Catatan tersimpan. Tidak ada notifikasi ke intern atau mentor." Tanpa notifikasi. `body` kosong: "Catatan wajib diisi."; lebih dari 2000 karakter: "Catatan maksimal 2000 karakter." (ditambahkan 23 Okt 2026)
  - `PUT /api/admin/warnings/{id}` `{body}`: hanya pembuat dalam 24 jam, selain itu 422 `locked` ("Catatan hanya bisa diubah pembuatnya dalam 24 jam."). Tidak ada hapus. Simpan tanpa perubahan tidak masuk log; catatan milik akun intern yang sudah dihapus: 404 (23 Okt 2026).
  - Tambah dan ubah masuk `audit_logs` (aksi `Warning`, objek nama intern).
  - Model baru `Warning` (dan factory), relasi `User::warnings()`. Logika di `App\Services\AdminWarnings`, controller `App\Http\Controllers\Admin\WarningController`.
  - Perbaikan 23 Okt 2026: hari yang menjadi Libur setelah intern clock in (libur tanggal lampau, Alur 7) tidak lagi bertanda Terlambat. `AttendanceCalendar::days()` mengosongkan `late_minutes` pada hari Libur, jadi "Terlambat bulan ini", rekap `late`, dan detail hari ikut benar.
  - Test di `tests/Feature/Admin/WarningTest.php` (13 test lolos).

- [x] **Koreksi Absensi, sisi admin** (20 Okt 2026, docs/design-admin.md Alur 4)
  - `GET /api/admin/corrections?status=&intern_id=&from=&to=`: `status` = `pending` (default), `approved`, `rejected`, `cancelled`, `all`; `from`/`to` = rentang tanggal absensi. Pending urut paling lama diajukan lebih dulu (antrean), status lain terbaru lebih dulu. Baris: `id`, `intern {id, name, short_name}`, `date`, `submitted_at`, `status`. `meta.interns` = pilihan filter Intern (intern yang pernah mengajukan koreksi).
  - `GET /api/admin/corrections/{id}`: baris ditambah `recorded {clock_in, clock_out, status}` (jam saat diajukan dan status hari itu **sekarang**, misalnya `missed_clock_out`), `requested`, `reason`, `has_evidence`, `decision_note`, `final`, `decided_by`, `decided_at`, `can_decide` (false = layar hanya baca).
  - `GET /api/admin/corrections/{id}/evidence` (`?inline=1` untuk Pratinjau): file bukti, tanpa URL publik.
  - `POST /api/admin/corrections/{id}/approve` `{clock_in, clock_out, note}`: jam final menggantikan jam di `attendances` hari itu, atau membuat baris baru jika intern belum clock in; `is_corrected = true` ("Dikoreksi admin"); kantor dan koordinat lama tetap; validasi lokasi tidak dijalankan. Status hari itu dan tanda Terlambat terhitung ulang otomatis karena dihitung saat dibaca. Respons "Koreksi disetujui. Status absensi dihitung ulang."
  - `POST /api/admin/corrections/{id}/reject` `{note}`: data absensi tidak berubah. Respons "Koreksi ditolak. Data absensi tidak berubah."
  - Validasi: "Catatan verifikasi wajib diisi." (Setujui dan Tolak), "Jam clock out harus setelah jam clock in.", "Format jam tidak valid. Gunakan JJ:MM."
  - Ditolak (422 `reason`): `already_processed` ("Permintaan ini sudah diproses oleh [nama admin]."), `cancelled` ("Permintaan ini sudah dibatalkan intern."). Baris koreksi dikunci saat diputuskan, jadi dua admin atau pembatalan intern di saat yang sama tidak bertabrakan.
  - Notifikasi intern: "Koreksi absensi 9 Okt disetujui." / "... ditolak." (link `/absensi`, `tab` = `koreksi`, `open` = id). Catatan admin dibaca di detail koreksi.
  - `audit_logs` aksi `Absensi`: "Setujui koreksi 9 Okt: 08:02 - 17:00." atau "Tolak koreksi 9 Okt." (design-admin.md 13.1).
  - Logika di `App\Services\AdminCorrections`, controller `App\Http\Controllers\Admin\CorrectionController`, resource `AdminCorrectionResource`.
  - Test di `tests/Feature/Admin/CorrectionTest.php` (18 test lolos).

### Catatan integrasi frontend: Koreksi Absensi admin

| Layar (design-admin.md 6) | Endpoint | Catatan |
| --- | --- | --- |
| Daftar, filter Status, Intern, Tanggal | `GET /api/admin/corrections?status=&intern_id=&from=&to=` | Tombol Buka jika `pending`, Lihat selain itu. Kosong: "Belum ada permintaan koreksi." |
| Buka dari notifikasi, dashboard, atau tab Koreksi pengguna | `GET /api/admin/corrections/{id}` | `/koreksi?open={id}` |
| Data tercatat vs diajukan | `recorded`, `requested` | `recorded.status` untuk badge status |
| Tanya intern lewat chat | `intern.id` | Chat belum dibuat |
| Bukti | `GET .../evidence?inline=1` atau tanpa `inline` | Butuh header Authorization, ambil lewat fetch lalu buka blob |
| Setujui | `POST .../approve` `{clock_in, clock_out, note}` | Isi awal jam final dari `requested` |
| Tolak | `POST .../reject` `{note}` | |
| Admin lain sudah memproses / intern membatalkan | 422 `reason` | Tampilkan `message`, lalu muat ulang detail |

- [x] **Izin Pending, sisi admin** (20 Okt 2026, docs/design-admin.md Alur 5, design-mentor.md 13.4)
  - `GET /api/admin/leaves?tab=&type=&intern_id=`: semua intern. `tab` = `pending` (default) atau `all`. Pending lebih dulu dari yang paling lama pending, sisanya terbaru. Baris sama dengan sisi mentor (`intern`, `type`, tanggal, `working_days`, `has_evidence`, `status`, `submitted_at`, `pending_hours`, `is_overdue` untuk "! pending 30 jam", `decided_by`) ditambah `mentor {id, name}`, `can_decide` (masih Pending: tombol Tolak), `can_approve` (Pending lebih dari 24 jam dan ada bukti: tombol Setujui). `meta.pending_count` untuk "Pending (3)", `meta.interns` untuk filter Intern.
  - `GET /api/admin/leaves/{id}`: ditambah `reason`, `decision_note`, `evidence {name, size}`. `GET .../evidence` (`?inline=1` untuk Pratinjau).
  - `POST /api/admin/leaves/{id}/approve` `{note, evidence_checked: true}` dan `POST .../reject` `{note}`. Catatan wajib ("Catatan wajib diisi.").
  - **Tolak** boleh untuk semua izin Pending, tanpa menunggu 24 jam dan tanpa bukti (keputusan pemilik repo 20 Okt 2026; design-admin.md 7.4). **Setujui** hanya untuk izin Pending lebih dari 24 jam yang punya bukti.
  - Syarat Setujui admin (422 `reason`): `not_overdue` ("Izin ini masih menunggu mentor. Admin dapat menyetujuinya setelah Pending lebih dari 24 jam."), `no_evidence` ("Tidak ada surat resmi atau bukti."), `evidence_unchecked` (centang "Saya sudah memeriksa surat resmi atau bukti" belum dikirim), `already_processed` ("Izin ini sudah diproses oleh mentor." atau "... oleh admin."), `cancelled` ("Pengajuan ini sudah dibatalkan intern."). Baris izin dikunci saat diputuskan.
  - Setelah disetujui, hari kerja yang tercakup terbaca Izin (status dihitung saat dibaca).
  - Notifikasi: intern "Izin Sakit 13-14 Okt disetujui." / "ditolak." (sama dengan keputusan mentor), mentor saat ini "Izin Andi P. diproses oleh admin." (design-mentor.md 14). Mentor yang membuka izin itu mendapat "Izin ini sudah diproses oleh admin.".
  - `audit_logs` aksi `Izin`: "Setujui Izin Sakit 13-14 Okt." atau "Tolak Izin Sakit 13-14 Okt.".
  - Logika keputusan tetap satu tempat di `LeaveDecisions::decide()` (mentor dan admin); daftar di `App\Services\AdminLeaves`; controller `App\Http\Controllers\Admin\LeaveController`; resource `AdminLeaveResource` (turunan `MentorLeaveResource`).
  - **Pengingat ke admin** `php artisan app:remind-overdue-leaves` (scheduler setiap jam): "Izin Andi P. belum diproses mentor lebih dari 24 jam." ke semua admin aktif, link `/izin` `open` = id, sekali per izin (kolom baru `leave_requests.overdue_notified_at`, migration `2026_10_20_234211`). Service `OverdueLeaveReminders`.
  - Test di `tests/Feature/Admin/LeaveTest.php` (18 test lolos).

### Catatan integrasi frontend: Izin admin

| Layar (design-admin.md 7) | Endpoint | Catatan |
| --- | --- | --- |
| Tab Pending (N) / Semua, filter Jenis dan Intern | `GET /api/admin/leaves?tab=&type=&intern_id=` | "! pending N jam" jika `is_overdue`, dari `pending_hours` |
| Buka dari dashboard, notifikasi, atau tab Izin pengguna | `GET /api/admin/leaves/{id}` | `/izin?open={id}` |
| Pratinjau, Unduh lampiran | `GET .../evidence?inline=1` atau tanpa `inline` | Butuh header Authorization |
| Centang bukti, Setujui | `POST .../approve` `{note, evidence_checked}` | Tombol aktif jika `can_approve` dan dicentang; tooltip "Tidak ada surat resmi atau bukti." jika tidak ada bukti |
| Tolak | `POST .../reject` `{note}` | Aktif jika `can_decide` (masih Pending) |
| Sudah diproses atau dibatalkan | `can_decide` false | Layar hanya baca dengan keputusan, pemroses, dan catatan |

- [x] **Akhir periode magang** (23 Okt 2026, docs/design-admin.md Alur 6, 4.6, 14)
  - `POST /api/admin/users/{id}/extend` `{end_date}`: dialog Perpanjang dari Dashboard, menu Aksi "Perpanjang magang", atau setelah Aktifkan ditolak `internship_ended`. Respons "Perubahan tersimpan." dan `data` detail akun (sama dengan `GET /api/admin/users/{id}`). Setelah diperpanjang intern keluar dari daftar pengingat.
  - Validasi (422 `errors.end_date`): "Tanggal selesai baru wajib diisi.", "Format tanggal tidak valid.", "Tanggal baru harus setelah tanggal selesai saat ini." (8.3), "Tanggal selesai baru tidak boleh sebelum hari ini.". Akun bukan intern: 422 `not_intern` ("Akun ini bukan intern."). Profil dikunci saat diperpanjang, jadi dua admin bersamaan dibandingkan dengan tanggal selesai terbaru.
  - Intern yang dinonaktifkan admin ikut aktif lagi saat diperpanjang (4.6: mengaktifkan kembali intern dilakukan dengan memperbarui tanggal selesai; prototipe `ExtendDialog` juga `active: true`).
  - `audit_logs` aksi `Akun`: "Perpanjang magang dari 17 Okt 2026 ke 31 Des 2026." ditambah " Akun diaktifkan kembali." bila akun tadinya dinonaktifkan. Tidak ada notifikasi ke intern atau mentor (dokumen tidak menyebutkannya).
  - `GET /api/admin/ending-internships`: Lihat semua untuk kotak "Magang berakhir dalam 7 hari" (Dashboard hanya 5 baris). Baris sama dengan `ending_internships` di Dashboard: `intern`, `end_date`, `ends_in_days`, `mentor {id, name}`. Aturan satu tempat: scope `InternProfile::endingSoon()` (intern aktif, sudah mulai, selesai hari ini sampai 7 hari lagi) dan `App\Services\EndingInternships`.
  - **Pengingat ke admin** `php artisan app:remind-ending-internships` (scheduler setiap hari 07:00): "Magang Rina W. berakhir dalam 7 hari." ke semua admin aktif, link `/` (Dashboard). Sekali per tanggal selesai (kolom baru `intern_profiles.ending_notified_for`, migration `2026_10_23_202728`); setelah diperpanjang, tanggal baru diingatkan lagi saat masuk rentang 7 hari. Intern yang masuk rentang dengan sisa kurang dari 7 hari mendapat jumlah sebenarnya ("dalam 3 hari", "hari ini"). Service `EndingInternshipReminders`.
  - Nonaktif otomatis tidak butuh job: `AccountAccess` sudah menolak login dan request intern mulai hari setelah tanggal selesai (8.3, 17.1 no. 9), dan status di daftar Pengguna menjadi `inactive`.
  - Tanya mentor: chat belum dibuat. Draf pesan (8.2) disusun frontend dari `intern.name`, `end_date`, `mentor`.
  - Test di `tests/Feature/Admin/InternshipEndTest.php` (16 test lolos); `DashboardTest` disesuaikan untuk `ends_in_days`.

### Catatan integrasi frontend: Akhir periode magang

| Layar (design-admin.md 8) | Endpoint | Catatan |
| --- | --- | --- |
| Kotak "Magang berakhir dalam 7 hari" | `GET /api/admin/dashboard` `ending_internships` | `ends_in_days` 0 = "hari ini" |
| Lihat semua | `GET /api/admin/ending-internships` | Tampil jika `ending_internships.total > 5` |
| Tanya mentor | `mentor.id`, `mentor.name` | Draf: "Halo [mentor], masa magang [intern] berakhir [17 Okt 2026]. Apakah akan diperpanjang? ..." ; chat menunggu backend chat |
| Dialog Perpanjang | `POST /api/admin/users/{id}/extend` `{end_date}` | "Tanggal selesai saat ini" dari `end_date` baris; `min` input = besok dari tanggal itu dan tidak sebelum hari ini; error dari `errors.end_date` |
| Aktifkan intern yang magangnya berakhir | `POST .../activate` 422 `internship_ended` lalu dialog Perpanjang | Setelah Simpan akun langsung aktif, tidak perlu klik Aktifkan lagi |
| Notifikasi lonceng | baris `notifications` link `/` | "Magang Rina W. berakhir dalam 7 hari." |

- [x] **Pengaturan: Jam Kerja dan Kalender Libur** (23 Okt 2026, docs/design-admin.md Alur 7). Semua perubahan masuk `audit_logs` aksi `Kalender dan jam kerja` (13.1).
  - `GET /api/admin/settings/work-hours`: `current` (jam kerja yang berlaku hari ini `{effective_from, start, end}`, null jika belum diatur), `cutoff` (`"23:59"`, hanya informasi), `history` terbaru lebih dulu dengan `state` = `upcoming` (dijadwalkan), `current`, `past`.
  - `POST /api/admin/settings/work-hours` `{start_time, end_time, effective_from}`: respons "Perubahan tersimpan. Data absensi sebelumnya tidak berubah." dan isi `GET` terbaru. Tanggal efektif yang sudah punya pengaturan diganti. Validasi: "Jam pulang harus setelah jam masuk.", "Tanggal berlaku tidak boleh sebelum hari ini.", "Format jam tidak valid. Gunakan JJ:MM.". Log: objek "Jam kerja", "Ubah jam kerja menjadi 08:30 - 17:30 mulai 13 Okt 2026.".
  - Hari ini boleh menjadi tanggal efektif (sama dengan prototipe). Tanda Terlambat dan batas clock out hari ini langsung mengikuti jam baru; hari sebelumnya tidak berubah karena jam kerja dipilih per tanggal (`WorkHourSetting::effectiveOn`).
  - `GET /api/admin/holidays`: libur tambahan urut tanggal: `id`, `date`, `name`, `is_past`. Sabtu dan Minggu tidak disimpan; frontend mewarnainya sendiri.
  - `POST /api/admin/holidays` `{date, name, confirm}`, `PUT /api/admin/holidays/{id}` (sama), `DELETE /api/admin/holidays/{id}`. Validasi: "Tanggal dan nama libur wajib diisi.", "Sabtu dan Minggu sudah libur otomatis.", "Tanggal ini sudah menjadi hari libur." (juga saat dua admin menambah tanggal sama bersamaan).
  - **Tanggal lampau** (sebelum hari ini; hari ini dianggap belum lewat, 9.3): tanpa `confirm: true` ditolak 422 `{message: "Tanggal ini sudah lewat.", reason: "confirm_recalculate", affected: 21}` untuk dialog "Status absensi 21 intern pada tanggal ini akan dihitung ulang". Kirim ulang dengan `confirm: true` setelah "Ya, hitung ulang". Ubah libur meminta konfirmasi hanya jika tanggal berpindah dan tanggal lama atau baru sudah lewat; ubah nama saja tidak. Hapus tidak butuh `confirm` (dialog Hapus di frontend).
  - Hitung ulang tidak perlu job: status absensi dihitung saat dibaca, jadi tanggal yang menjadi libur langsung terbaca Libur (termasuk yang sudah clock in) dan tanggal yang dihapus kembali menjadi Hadir, Tidak Hadir, dan seterusnya. `affected` = intern (termasuk yang nonaktif, tanpa akun terhapus) yang tanggal itu masuk periode magangnya.
  - Log: objek tanggal ("2 Okt 2026"), detail `Tambah libur "Libur Daerah". 21 absensi dihitung ulang.`, `Ubah libur "X" (sebelumnya 2 Okt 2026).`, `Hapus libur "X".` Jumlah absensi hanya ditulis untuk tanggal lampau.
  - `ActionRejected` kini bisa membawa data tambahan di respons (dipakai untuk `affected`).
  - Logika di `App\Services\AdminWorkHours` dan `App\Services\AdminHolidays`; controller `Admin\WorkHourController`, `Admin\HolidayController`.
  - Test di `tests/Feature/Admin/SettingsTest.php` (25 test lolos).

### Catatan integrasi frontend: Pengaturan

| Layar (design-admin.md 9) | Endpoint | Catatan |
| --- | --- | --- |
| Tab Jam Kerja, "Jam kerja saat ini" | `GET /api/admin/settings/work-hours` | `current` null: tampilkan form kosong; teks batas dari `cutoff` |
| Simpan jam kerja | `POST /api/admin/settings/work-hours` | Error per kolom dari `errors`; tabel Riwayat dari `data.history` |
| Tab Kalender Libur, Daftar libur tambahan | `GET /api/admin/holidays` | Kosong: "Belum ada libur tambahan." |
| Tambah atau Ubah libur | `POST /api/admin/holidays`, `PUT .../{id}` | 422 `reason: confirm_recalculate`: buka dialog "Tanggal ini sudah lewat" memakai `affected`, lalu kirim ulang dengan `confirm: true` |
| Hapus libur | `DELETE /api/admin/holidays/{id}` | Kalimat "Status absensi tanggal itu dihitung ulang." jika `is_past` |

- [x] **Lokasi Kantor** (23 Okt 2026, docs/design-admin.md Alur 7B / 9A). Semua tindakan masuk `audit_logs` aksi `Lokasi kantor`, objek nama kantor. Tanpa notifikasi ke intern atau mentor.
  - `GET /api/admin/offices`: semua kantor (aktif dan nonaktif) urut nama: `id`, `name`, `latitude`, `longitude`, `clock_in_radius_meters`, `clock_out_radius_meters`, `is_active`. `meta.active_count` untuk "N kantor aktif", dialog kantor aktif terakhir, dan banner (0 = "Belum ada kantor aktif. Intern tidak bisa clock in."). `GET /api/admin/offices/{id}` untuk formulir Ubah.
  - `POST /api/admin/offices` dan `PUT /api/admin/offices/{id}` `{name, latitude, longitude, clock_in_radius_meters, clock_out_radius_meters}`. Kantor baru langsung aktif. Respons berisi `data` dan `meta.active_count`.
  - Validasi (9A.4): "Pilih titik kantor di peta." (koordinat kosong atau di luar -90..90 / -180..180), "Nama kantor wajib diisi.", "Nama kantor sudah dipakai kantor lain." (tanpa beda huruf besar, termasuk kantor nonaktif tetapi tidak kantor yang dihapus, juga saat dua admin menyimpan bersamaan), "Isi radius dalam meter, lebih dari 0." (bilangan bulat; tanpa rentang tetap sesuai keputusan 17.1 no. 16).
  - Log: "Tambah kantor di -6.1275, 106.6537, radius 150 m / 150 m."; Ubah hanya menyebut yang berubah ("Ubah nama dari \"...\".", "Ubah titik ke ...", "Ubah radius: clock in 120 m, clock out 300 m."); simpan tanpa perubahan tidak dicatat.
  - `POST /api/admin/offices/{id}/deactivate` dan `.../activate`: log "Nonaktifkan kantor." / "Aktifkan kantor.". Ditolak 422 `already_inactive` ("Kantor ini sudah nonaktif.") atau `already_active`. Kantor aktif terakhir boleh dinonaktifkan; konfirmasinya di dialog frontend (9A.6). Kedua endpoint ini dipakai untuk toggle Aktif/Nonaktif di frontend.
  - `DELETE /api/admin/offices/{id}`: hanya kantor nonaktif; kantor aktif ditolak 422 `still_active` ("Nonaktifkan kantor lebih dulu sebelum menghapusnya."). Respons "Kantor dihapus." dan `meta.active_count`. Log "Hapus kantor.". Penghapusan berupa soft delete (`offices.deleted_at`): kantor hilang dari daftar dan detail (404), riwayat absensi tetap menampilkan nama kantornya (`Attendance::clockInOffice()`/`clockOutOffice()` memakai `withTrashed`), dan nama serta titik yang sama boleh dipakai kantor baru. Unik nama kini indeks parsial `LOWER(name) WHERE deleted_at IS NULL` (migration `2026_10_23_205521`).
  - Ubah titik atau radius langsung berlaku untuk clock in dan clock out berikutnya (`AttendanceClock` membaca kantor aktif saat itu); absensi lama hanya menyimpan id kantor sehingga tidak berubah.
  - Logika di `App\Services\AdminOffices`; controller `Admin\OfficeController`; request `OfficeRequest`; resource `AdminOfficeResource` (turunan `OfficeResource` milik intern).
  - Test di `tests/Feature/Admin/OfficeTest.php` (24 test lolos).

### Catatan integrasi frontend: Lokasi Kantor

| Layar (design-admin.md 9A) | Endpoint | Catatan |
| --- | --- | --- |
| Daftar, "N kantor aktif", banner | `GET /api/admin/offices` | Kosong: "Belum ada kantor. Tambahkan kantor agar intern bisa clock in."; `meta.active_count === 0`: banner |
| Tambah Kantor (peta, pin, dua radius) | `POST /api/admin/offices` | Koordinat dari pin; error per kolom dari `errors` |
| Ubah | `GET /api/admin/offices/{id}` lalu `PUT` | |
| Toggle Aktif/Nonaktif | `POST .../deactivate`, `.../activate` | Dialog kantor aktif terakhir jika `is_active` dan `meta.active_count === 1` |
| Hapus (hanya kantor nonaktif) | `DELETE /api/admin/offices/{id}` | Sembunyikan atau nonaktifkan tombol Hapus jika `is_active`; dialog konfirmasi menjelaskan riwayat absensi tetap tersimpan |

Temuan untuk tim frontend: `validateOffice` di `frontend/src/lib/mock-rules.ts` masih membatasi radius 10 sampai 1000 m ("Isi radius antara 10 dan 1000 meter."). Dokumen memutuskan tanpa rentang tetap, cukup lebih dari 0 ("Isi radius dalam meter, lebih dari 0."); backend mengikuti dokumen.

- [x] **Pengumuman** (23 Okt 2026, docs/design-admin.md Alur 9, design-intern.md 16, design-mentor.md 14). Semua tindakan masuk `audit_logs` aksi `Pengumuman`, objek judul.
  - `GET /api/admin/announcements`: semua pengumuman terbaru lebih dulu: `id`, `title`, `body`, `author_name`, `created_at`, `updated_at`, `for_intern`, `for_mentor`.
  - `POST /api/admin/announcements` `{title, body, for_intern, for_mentor}`: 201 "Pengumuman terkirim ke bell icon penerima.". `PUT /api/admin/announcements/{id}` (sama): "Perubahan tersimpan.". `DELETE /api/admin/announcements/{id}`: "Pengumuman dihapus.".
  - Validasi: "Judul wajib diisi." (maksimal 255 karakter karena menjadi teks lonceng), "Isi pengumuman wajib diisi." (maksimal 5000), "Pilih minimal satu penerima." (`errors.recipients`).
  - Notifikasi lonceng: teks = judul pengumuman (design-intern.md 16, design-mentor.md 14), `link_path` `/`, `link_params` `{announcement: id}`. Penerima: akun role terpilih yang tidak dinonaktifkan; intern termasuk yang belum mulai magang, tidak termasuk yang magangnya sudah berakhir. Admin tidak menerima.
  - **Notifikasi mengikuti pengumumannya** (kolom baru `notifications.announcement_id`, migration `2026_10_23_211623`): ubah judul mengganti teks lonceng semua penerima tanpa mengubah status dibaca; role yang ditambahkan mendapat notifikasi; role yang dicabut kehilangan notifikasinya; hapus pengumuman ikut menghapus notifikasinya (cascade).
  - Log: "Buat pengumuman untuk Intern dan Mentor.", "Ubah pengumuman." atau "Ubah pengumuman, penerima kini Mentor.", "Hapus pengumuman.". Simpan tanpa perubahan tidak dicatat.
  - `GET /api/announcements/{id}` (semua role, `AnnouncementPolicy`): isi pengumuman saat notifikasi diklik (`id`, `title`, `body`, `author_name`, `created_at`, `updated_at`). Intern dan mentor hanya pengumuman role-nya ("Anda tidak memiliki akses ke pengumuman ini."); pengumuman yang dihapus 404. Kotak Pengumuman di Dashboard intern dan mentor (3 terbaru) sudah ada sebelumnya.
  - Logika di `App\Services\AdminAnnouncements` dan `Notifier::announce()`; controller `Admin\AnnouncementController` dan `Shared\AnnouncementController`.
  - Test di `tests/Feature/Admin/AnnouncementTest.php` (14 test lolos).

### Catatan integrasi frontend: Pengumuman

| Layar | Endpoint | Catatan |
| --- | --- | --- |
| Daftar (Judul, Penerima, Tanggal) | `GET /api/admin/announcements` | Penerima dari `for_intern`/`for_mentor`; tanggal dari `created_at` |
| Buat, Ubah | `POST`, `PUT /api/admin/announcements/{id}` | Error per kolom dari `errors` (`recipients` untuk centang penerima) |
| Hapus | `DELETE /api/admin/announcements/{id}` | Dialog konfirmasi di frontend |
| Klik notifikasi pengumuman (intern, mentor) | `GET /api/announcements/{id}` | `link_params.announcement`; tampilkan judul dan isi, misalnya dalam dialog di Dashboard |

- [x] **Laporan Excel** (23 Okt 2026, docs/design-admin.md Alur 10). File .xlsx dibuat dengan `openspout/openspout` ^5.12 (ringan, menulis baris per baris). Butuh ekstensi PHP `zip` (di Laragon lokal sudah diaktifkan di `php.ini`; pastikan juga ada di server production).
  - `GET /api/admin/reports/options`: pilihan filter `interns [{id, name}]` dan `mentors [{id, name, is_active}]`, termasuk akun nonaktif karena laporan bisa untuk periode lampau.
  - `POST /api/admin/reports/export` `{type, from, to, intern_id?, mentor_id?}`: `type` = `attendance` (Rekap Absensi) atau `tasks` (Rekap Task). Respons unduhan .xlsx (`rekap-absensi_2026-10-01_2026-10-31.xlsx`). Tanpa data: 422 `no_data` "Tidak ada data pada periode ini." Validasi: "Pilih jenis laporan.", "Periode tidak valid." (akhir sebelum awal), "Intern tidak ditemukan.", "Mentor tidak ditemukan.". Rekap Izin tidak ada.
  - Isi file: baris keterangan (nama aplikasi, jenis laporan, periode, filter, waktu dibuat dan nama admin), lalu tabel dengan judul kolom tebal.
  - **Rekap Absensi**: satu baris per intern: Intern, Mentor (mentor saat ini), Hadir, Izin, Tidak Hadir, Lupa Clock Out, Hari Terlambat, Total Hari Kerja. Hanya status final (aturan sama dengan rekap riwayat absensi): hari ini belum dihitung (ada baris keterangan jika periode mencakup hari ini), hari libur bukan hari kerja, tanggal di luar periode magang tidak dihitung, hari Libur tanpa tanda Terlambat. Intern tanpa hari kerja final di periode itu tidak ditampilkan. Filter Mentor memakai mentor intern saat ini.
  - **Rekap Task**: Kode, Intern, Mentor, Judul Task, Tenggat, Status (To Do, In Progress, In Review, Done), Terakhir Dikumpulkan, Terlambat. Task yang **tenggatnya** di dalam periode; filter Mentor memakai **mentor pemilik Task** (`tasks.mentor_id`); tanda Terlambat untuk Task yang hasil terakhirnya dikumpulkan setelah tenggat (In Review dan Done) atau belum dikumpulkan dan tenggatnya sudah lewat (keputusan pemilik repo 23 Okt 2026). Task milik akun intern yang dihapus tidak ikut.
  - `audit_logs` aksi `Laporan`, objek jenis laporan: "Export Excel 1 Okt 2026 - 31 Okt 2026, mentor Sari Wijaya." (12.1 langkah 5).
  - Logika di `App\Services\AdminReports`; controller `Admin\ReportController`; request `ReportRequest`. `TaskStatus::label()` baru untuk teks status di file.
  - Test di `tests/Feature/Admin/ReportTest.php` (12 test lolos; isi .xlsx dibaca ulang dengan reader OpenSpout).

### Catatan integrasi frontend: Laporan

| Layar (design-admin.md 12) | Endpoint | Catatan |
| --- | --- | --- |
| Pilihan Intern dan Mentor | `GET /api/admin/reports/options` | Tandai mentor nonaktif dengan `is_active` |
| Buat Excel | `POST /api/admin/reports/export` | Ambil lewat `fetch` dengan header Authorization lalu simpan blob; nama file dari header `Content-Disposition` |
| Tidak ada data | 422 `reason: no_data` | Tampilkan `message` |
| Error isian | 422 `errors` (`type`, `from`, `to`, `intern_id`, `mentor_id`) | |

Temuan untuk tim frontend: pratinjau Rekap Absensi di prototipe (`admin/reports.tsx`) belum punya kolom jumlah hari Terlambat (design-admin.md 12.3); file dari backend sudah memuatnya.

- [x] **Log Aktivitas** (23 Okt 2026, docs/design-admin.md 13.1). Chat (13.2) masih ditunda; Profil admin (13.3) sudah tercakup "Profil Saya, semua role" (17 Okt 2026), termasuk tanpa ganti password mandiri.
  - `GET /api/admin/audit-logs?from=&to=&admin_id=&action=&page=`: 20 per halaman, terbaru lebih dulu. Baris: `id`, `created_at`, `admin {id, name}` (nama saat tindakan dilakukan, jadi tetap benar walau admin berganti nama atau akunnya dihapus), `action` (jenis aksi), `object`, `detail`. `meta`: `current_page`, `last_page`, `per_page`, `total` ("N catatan").
  - `GET /api/admin/audit-logs/options`: `admins` (admin yang pernah tercatat, nama saat ini, termasuk akun nonaktif atau terhapus) dan `actions` (Akun, Absensi, Izin, Kalender dan jam kerja, Lokasi kantor, Warning, Pengumuman, Laporan; urutan 13.1, konstanta `AuditLog::ACTIONS`).
  - Validasi: "Periode tidak valid.", "Jenis aksi tidak valid.".
  - Hanya baca: tidak ada endpoint ubah atau hapus, dan model `AuditLog` menolak update dan delete (LogicException).
  - Logika di `App\Services\AdminAuditLogs`; controller `Admin\AuditLogController`; request `AuditLogIndexRequest`.
  - Test di `tests/Feature/Admin/AuditLogTest.php` (12 test lolos).

### Catatan integrasi frontend: Log Aktivitas

| Layar (design-admin.md 13.1) | Endpoint | Catatan |
| --- | --- | --- |
| Filter Tanggal, Admin, Jenis aksi | `GET /api/admin/audit-logs/options` | `admins[].id` untuk `admin_id`, `actions[]` untuk `action` |
| Tabel Waktu, Admin, Jenis, Objek, Detail | `GET /api/admin/audit-logs?...` | Waktu dari `created_at`; Admin dari `admin.name`; halaman dari `meta`. Kosong: "Tidak ada aktivitas pada filter ini." |

- [x] **WebSocket: lonceng notifikasi dan chat, semua role** (23 Okt 2026, design-intern.md 14 dan 16, design-mentor.md 12 dan 14, design-admin.md 13.2 dan 14, backend/CLAUDE.md "Real time")
  - **Reverb** dipasang (`laravel/reverb` ^1.0 lewat `php artisan install:broadcasting --reverb`): `config/broadcasting.php`, `config/reverb.php`, `routes/channels.php`. Otorisasi channel di `POST /api/broadcasting/auth` dengan token Sanctum (middleware `auth:sanctum`, `active`, `password.changed`), bukan sesi web. `REVERB_ALLOWED_ORIGINS` (baru) membatasi host frontend yang boleh membuka WebSocket; bawaan `*`.
  - Installer ikut memperbarui paket: `laravel/framework` 13.35 ke 13.38, Symfony 8.1.x, dan **Guzzle turun dari 8 ke 7** (dibutuhkan `pusher/pusher-php-server`, dependensi Reverb; HTTP client Laravel 13 mendukung keduanya). Perubahan `resources/js/app.tsx` dari installer dibatalkan karena Inertia akan dilepas. `CreateAdmin` disesuaikan dengan tipe `option()` framework terbaru.
  - **Channel**: `private-users.{id}` (hanya pemilik akun: lonceng, pesan, status dibaca), `private-chats.{low}.{high}` (dua peserta percakapan, id kecil lebih dulu: client event `client-typing`), `presence-online` (semua pengguna yang membuka aplikasi: status online; `user_info` = `{id, name}`). Client event diterima dari anggota channel (`accept_client_events_from = members`).
  - **Event** di `users.{id}` (nama dengan titik di depan untuk Echo): `.notification.sent` `{notification, unread_count}` (item baru, atau notifikasi chat yang naik lagi), `.notifications.read` `{ids | null (semua), unread_count}` (sinkron antar-tab), `.notifications.changed` `{unread_count}` (judul pengumuman diubah atau pengumuman dihapus: muat ulang daftar), `.chat.message` `{message, sender {id, name}}` (ke penerima dan pengirim), `.chat.read` `{reader_id, partner_id, last_read_id, read_at}` (ke pembaca dan pengirim: tanda "Dibaca"). Semua disimpan ke database lebih dulu, lalu dikirim lewat queue setelah transaksi selesai (`ShouldBroadcast` + `ShouldDispatchAfterCommit`). Semua notifikasi yang sudah ada (izin, Task, koreksi, pengingat, pengumuman) otomatis ikut real-time karena lewat `Notifier`.
  - **Lonceng** `GET /api/notifications?cursor=`: 20 item per muatan, terbaru lebih dulu (`id`, `text`, `link_path`, `link_params`, `read_at`, `created_at`), `meta.next_cursor` dan `meta.unread_count`. `POST /api/notifications/{id}/read` (milik orang lain 404), `POST /api/notifications/read-all`.
  - **Notifikasi chat** satu baris per pengirim (kolom baru `notifications.chat_sender_id`, unik per penerima dan pengirim, migration `2026_10_23_215426`): "Pesan baru dari Sari Wijaya.", link `/chat` `{to: id pengirim}`. Pesan berikutnya dari orang yang sama menjadikan baris itu belum dibaca lagi dan naik ke atas (`created_at` diperbarui), tanpa baris baru. Membuka percakapan ikut membaca notifikasi itu.
  - **Chat** (tabel `chat_messages` sudah ada, model baru `ChatMessage` dan factory):
    - `GET /api/chats?q=`: percakapan milik sendiri, pesan terakhir paling baru lebih dulu: `partner {id, name, role, title, photo_url, can_send}`, `last_message`, `unread_count`; `meta.unread_total` untuk angka di ikon chat. Admin hanya melihat percakapannya sendiri. Akun yang dihapus tidak tampil.
    - `GET /api/chats/contacts?q=`: akun yang bisa dihubungi selain diri sendiri (maks 50, urut nama) untuk memulai chat.
    - `GET /api/chats/{userId}/messages?before_id=`: 30 pesan, lama ke baru, `meta.has_more`, `meta.partner`.
    - `POST /api/chats/{userId}/messages` `{body}`: 201 dengan pesan. Teks saja, maksimal 2000 karakter ("Pesan wajib diisi.", "Pesan maksimal 2000 karakter."), tanpa ubah atau hapus. Ditolak 422 `inactive_recipient` ("Akun ini nonaktif.") untuk akun yang dinonaktifkan atau magangnya berakhir, `self` ("Anda tidak bisa chat dengan diri sendiri."). Dibatasi 60 pesan per menit.
    - `POST /api/chats/{userId}/read`: tandai semua pesan dari orang itu dibaca, `meta.unread_total`.
  - **Akun yang bisa dihubungi** satu aturan (`User::scopeReachable()` dan `isReachable()`): tidak dinonaktifkan, dan untuk intern magangnya belum berakhir (yang belum mulai termasuk). Dipakai chat dan penerima pengumuman.
  - Logika di `App\Services\Chats`, `App\Services\UserNotifications`, `App\Services\Notifier`; controller `Shared\ChatController`, `Shared\NotificationController`; event di `App\Events`.
  - Test di `tests/Feature/Realtime` (`NotificationTest`, `ChatTest`, `ChannelAuthTest`: 29 test lolos; otorisasi channel diuji dengan driver Reverb tanpa server). Uji coba ujung ke ujung dengan `reverb:start` dan dua klien WebSocket (database SQLite terpisah): berlangganan dan penolakan channel, status online, indikator mengetik, pesan dan notifikasi real-time, tanda Dibaca, sinkron angka lonceng; 13/13 lolos.

### Catatan integrasi frontend: Lonceng dan Chat

Sambungan (paket `laravel-echo` dan `pusher-js`):

```ts
new Echo({
  broadcaster: "reverb",
  key: REVERB_APP_KEY, wsHost: REVERB_HOST, wsPort: REVERB_PORT, wssPort: REVERB_PORT,
  forceTLS: REVERB_SCHEME === "https", enabledTransports: ["ws", "wss"],
  authEndpoint: `${API_URL}/api/broadcasting/auth`,
  auth: { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
});
echo.private(`users.${me.id}`)
  .listen(".notification.sent", ...).listen(".notifications.read", ...).listen(".notifications.changed", ...)
  .listen(".chat.message", ...).listen(".chat.read", ...);
echo.join("online").here(...).joining(...).leaving(...);
echo.private(`chats.${Math.min(a, b)}.${Math.max(a, b)}`).whisper("typing", { user_id: me.id }).listenForWhisper("typing", ...);
```

| Layar | Data awal (REST) | Pembaruan real-time | Catatan |
| --- | --- | --- | --- |
| Lonceng (angka dan popup) | `GET /api/notifications`, muat berikutnya dengan `?cursor=` | `.notification.sent` (sisipkan atau ganti item ber-`id` sama, pindah ke atas), `.notifications.read`, `.notifications.changed` (muat ulang) | Angka dari `unread_count`. Klik item: `POST .../{id}/read`, lalu buka `link_path` + `link_params` |
| Tandai semua dibaca | `POST /api/notifications/read-all` | `.notifications.read` dengan `ids: null` di tab lain | |
| Ikon chat (angka) | `GET /api/chats` `meta.unread_total` | `.chat.message` dari orang lain menambah, `.chat.read` milik sendiri mengurangi | |
| Daftar percakapan, Cari kontak | `GET /api/chats?q=`, `GET /api/chats/contacts?q=` | `.chat.message` memindahkan percakapan ke atas | Tampilkan kontak baru di bawah percakapan |
| Isi percakapan | `GET /api/chats/{id}/messages`, gulir ke atas dengan `before_id` | `.chat.message` (abaikan `id` yang sudah ada) | Saat percakapan terbuka dan pesan masuk, panggil `POST /api/chats/{id}/read` |
| Tanda "Dibaca" | `read_at` pada pesan | `.chat.read`: pesan milik sendiri dengan `id <= last_read_id` ke `reader_id` menjadi Dibaca | |
| Kotak kirim | `meta.partner.can_send` | - | false: tutup kotak kirim dengan "Akun ini nonaktif." |
| Sedang mengetik | - | whisper `typing` di `chats.{low}.{high}` | Kirim paling sering tiap 2-3 detik, sembunyikan bila tidak ada kabar beberapa detik |
| Status online | - | presence `online` | Titik hijau untuk `id` yang ada di daftar anggota |
| Tanya mentor (Alur 6), Tanya intern (Alur 4) | `POST /api/chats/{id}/messages` | | Draf pesan disusun frontend |

Temuan untuk tim frontend: prototipe membuka chat dengan `search.to` berupa nama; backend memakai id pengguna (`link_params.to`, `/api/chats/{id}`).

- [x] **Pemeriksaan keamanan backend** (23 Okt 2026)
  - Kode: tidak ada temuan berkeyakinan tinggi (IDOR, SQL injection, path traversal, privilege escalation, deserialisasi, secret di repo). Diperbaiki: **formula injection di Excel laporan**. Nama atau judul Task berawalan `=` sebelumnya ditulis sebagai rumus Excel; kini semua teks ditulis sebagai teks (`AdminReports::row()`, test di `ReportTest`).
  - Catatan penguatan (belum dikerjakan): koneksi WebSocket yang sudah terbuka tetap menerima event sampai putus walau token sudah dicabut (logout, reset password, nonaktif); Reverb hanya memeriksa izin saat berlangganan. Opsi: putuskan koneksi Reverb pengguna saat akunnya dinonaktifkan atau direset.
  - Dependensi: `composer audit` bersih. Advisory Laravel 2026 sudah tertutup versi terpasang (TokenGuard CVE-2026-114509 diperbaiki di 13.29, terpasang 13.38; CRLF email CVE-2026-48019; Reverb CVE-2026-23524 diperbaiki di 1.7, terpasang 1.12).
- [x] **Pembersihan komentar** (23 Okt 2026): komentar yang mengulang kode, rujukan dokumen, dan catatan keputusan dihapus dari `app/`, `routes/`, `database/`, `bootstrap/`, dan `tests/` (catatan keputusan tetap di file ini dan `docs/`). Yang tersisa hanya tipe PHPDoc dan penjelasan logika yang tidak terlihat dari kode (penguncian baris, update bersyarat, batasan database, keamanan). Diverifikasi: token kode di 247 file identik sebelum dan sesudah.

## Berikutnya

- [ ] **PHP2Shell (CVE-2026-109618 dan CVE-2026-109619, RCE tanpa login di mesin PHP).** Perbarui PHP ke 8.4.27, 8.5.12, atau 8.3.36 ke atas di semua mesin (lokal Laragon saat ini 8.4.12, masih rentan) dan jadikan syarat host production. Sampai diperbarui: `session.upload_progress.enabled=0` dan `post_max_size` kecil (aplikasi hanya butuh 2 MB per file) di `php.ini`, lalu restart worker PHP.

- [ ] Jalankan `php artisan migrate` di database development dan production untuk kolom `users.photo_path`, `tasks.overdue_reminded_at`, `leave_requests.overdue_notified_at`, `intern_profiles.ending_notified_for`, `offices.deleted_at` (beserta indeks nama baru), `notifications.announcement_id`, dan `notifications.chat_sender_id`.
- [ ] Pasang cron `schedule:run` di server production (pengingat Task terlambat setiap hari, pengingat izin pending ke admin setiap jam, pengingat akhir magang ke admin setiap hari).
- [ ] Development: jalankan `php artisan reverb:start` dan `php artisan queue:work` bersama server API, karena broadcast lewat queue (`QUEUE_CONNECTION=database`). Tanpa worker, data tetap tersimpan tetapi tidak dikirim real-time.
- [ ] Production: Reverb dan queue worker dijaga Supervisor, lewat `wss://` di belakang reverse proxy; isi `REVERB_ALLOWED_ORIGINS` dengan host frontend.
- [ ] Admin: jumlah hari Terlambat di daftar menu Absensi (design-admin 2.2). Kartu Terlambat di dashboard, jumlah Terlambat di Warning (20 Okt 2026), dan kolom Hari Terlambat di Rekap Absensi Excel (23 Okt 2026) sudah selesai.
- [ ] Pastikan ekstensi PHP `zip` aktif di server production (dibutuhkan export Excel).
- [ ] Hapus `database/generate_migrations.php` (migration sudah terbentuk).
- [ ] Lepas Inertia dari starter (`HandleInertiaRequests`, `resources/js`, `config/inertia.php`, `routes/web.php`). `tests/Feature/ExampleTest.php` masih gagal karena membuka halaman Inertia yang butuh build Vite; hapus bersama Inertia.
- [ ] CORS: izinkan origin frontend (`http://localhost:<port>` saat development, domain Vercel saat production).
- [ ] Sambungkan frontend: simpan token, kirim header `Authorization: Bearer <token>`, arahkan ke Ganti Password jika `must_change_password`, kembali ke login saat respons 401 atau 403 akun nonaktif.

## Keputusan pemilik repo

Keputusan atas perbedaan kecil antara kode dan dokumen/prototipe (18 Okt 2026). Kode **tidak diubah**; tinjau lagi setelah frontend tersambung (lihat bagian berikut).

- **Ubah Task yang lewat tenggat: tetap seperti sekarang.** Tenggat yang tidak diubah boleh tetap lewat, jadi Task terlambat masih bisa diperbaiki judul dan deskripsinya. Tenggat yang diubah harus setelah waktu sekarang. (Prototipe `validateTask` selalu mewajibkan tenggat setelah sekarang.)
- **Lupa Clock Out tidak dihitung Hadir di KPI Kehadiran.** Sama dengan prototipe (`attendanceRate`). Perbaikannya lewat koreksi absensi: setelah admin menyetujui, hari itu menjadi Hadir dan KPI ikut berubah karena dihitung saat dibaca. Di rekap, Lupa Clock Out tetap kolom sendiri, tidak masuk Tidak Hadir.
- **Notifikasi keputusan izin tetap singkat**: "Izin Sakit 13-14 Okt disetujui." tanpa catatan mentor. Catatan dibaca intern di detail izin. (design-mentor.md 9.1 menyebut notifikasi berisi catatan; design-intern.md 16 memakai teks singkat.)
- **Kantor boleh dihapus** (23 Okt 2026). Berbeda dengan design-admin.md 9A.5 dan 16 ("Menghapus kantor" tidak bisa). Hanya kantor nonaktif, berupa soft delete agar riwayat absensi tetap utuh, dan nama kantor yang dihapus boleh dipakai lagi. Dokumen desain perlu disesuaikan oleh pemiliknya.
- **Hari yang dijadikan libur setelah intern clock in terbaca Libur tanpa tanda Terlambat** (23 Okt 2026). Status Libur mengalahkan Hadir dan Lupa Clock Out (aturan lama, sama dengan prototipe), dan tanpa jam masuk tidak ada Terlambat. Hari itu tidak masuk "Terlambat bulan ini" di Warning maupun rekap `late`.
- **Notifikasi pengumuman mengikuti pengumumannya** (23 Okt 2026). Dokumen hanya menyebut "perubahan tampil ke penerima". Ubah judul mengganti teks lonceng tanpa menandai belum dibaca, perubahan penerima menambah atau menghapus notifikasi, dan hapus pengumuman menghapus notifikasinya. Penerima: akun aktif, termasuk intern yang belum mulai magang.
- **Rekap Task** (23 Okt 2026). Dokumen hanya menyebut kolom. Task masuk laporan bila tenggatnya di dalam periode, filter Mentor memakai mentor pemilik Task, dan Terlambat juga menandai Task Done atau In Review yang hasil terakhirnya dikumpulkan setelah tenggat (berbeda dengan tampilan aplikasi yang tidak menandai Task Done).
- **Chat dan lonceng real-time** (23 Okt 2026). Pesan chat masuk lonceng satu baris per pengirim (dokumen menulis notifikasi per pesan baru, prototipe tidak memasukkannya ke lonceng). Chat baru hanya ke akun yang bisa dihubungi; percakapan lama dengan akun nonaktif tetap terbaca. Teks saja, tanpa ubah atau hapus. Fitur tambahan yang dipilih: sinkron status dibaca antar-tab, tanda "Dibaca", indikator mengetik, dan status online (dokumen tidak menyebutkannya).

## Ditinjau setelah integrasi frontend

Perubahan yang muncul dari keputusan di atas atau dari integrasi dicatat di sini dulu, lalu dikerjakan pada pengembangan berikutnya setelah tim frontend menyambungkan API. Jangan langsung mengubah kode.

- [ ] Samakan aturan tenggat saat Ubah Task di frontend (`validateTask` di `frontend/src/lib/mock-rules.ts` masih menolak tenggat lampau yang tidak diubah), atau sebaliknya jika tim memilih aturan prototipe.
- [ ] Pastikan teks bantuan KPI di halaman Performa menjelaskan bahwa Lupa Clock Out tidak dihitung hadir sampai dikoreksi.
- [ ] Cek ulang bentuk respons yang berubah saat penyeragaman (`submission.file` menggantikan `has_file`, `unread_comments` di kotak Dashboard mentor) terhadap kode frontend.

## Perlu diputuskan

- [ ] Intern yang diperpanjang setelah magangnya lewat (misalnya selesai 9 Okt, diperpanjang 12 Okt sampai 30 Nov): hari kerja 10-11 Okt kini masuk periode magang dan terbaca Tidak Hadir, karena periode disimpan sebagai satu rentang `start_date` sampai `end_date`. Dokumen tidak membahas jeda periode. Pilihan: biarkan (admin memakai koreksi), atau simpan tanggal aktif kembali agar hari jeda tidak dihitung.

- [ ] Pengingat Task terlambat (design-mentor.md 7.6) saat ini **tidak** dikirim untuk Task milik intern nonaktif, karena intern itu tidak bisa mengumpulkan lagi. Dokumen tidak membahasnya.
- [ ] Masa berlaku token. Saat ini `expiration` di `config/sanctum.php` bernilai `null`, jadi token berlaku sampai logout, direset admin, atau akun dinonaktifkan.

## Masih terbuka

- [ ] Host untuk Laravel API dan Reverb (VPS atau platform container).
- [ ] Penanganan GPS kurang akurat dan VPN saat validasi lokasi.

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
    - `ending_internships`: intern aktif yang selesai hari ini sampai 7 hari lagi, paling dekat lebih dulu. Baris: `intern`, `end_date`, `mentor {id, name}` (untuk Tanya mentor).
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
    { "intern": { "id": 7, "name": "Rina Wulandari", "short_name": "Rina W." }, "end_date": "2026-10-17", "mentor": { "id": 2, "name": "Budi Santoso" } }
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
| Magang berakhir dalam 7 hari | `ending_internships` | Tanya mentor memakai `mentor.name`; Perpanjang menunggu endpoint Alur 6 |
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
  - `POST /api/admin/users/{id}/warnings` `{body}`: 201 "Catatan tersimpan. Tidak ada notifikasi ke intern atau mentor." Tanpa notifikasi. `body` kosong: "Catatan wajib diisi."
  - `PUT /api/admin/warnings/{id}` `{body}`: hanya pembuat dalam 24 jam, selain itu 422 `locked` ("Catatan hanya bisa diubah pembuatnya dalam 24 jam."). Tidak ada hapus.
  - Tambah dan ubah masuk `audit_logs` (aksi `Warning`, objek nama intern).
  - Model baru `Warning` (dan factory), relasi `User::warnings()`. Logika di `App\Services\AdminWarnings`, controller `App\Http\Controllers\Admin\WarningController`.
  - Test di `tests/Feature/Admin/WarningTest.php` (9 test lolos).

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

## Berikutnya

- [ ] Jalankan `php artisan migrate` di database development dan production untuk kolom `users.photo_path`, `tasks.overdue_reminded_at`, dan `leave_requests.overdue_notified_at`.
- [ ] Pasang cron `schedule:run` di server production (pengingat Task terlambat setiap hari, pengingat izin pending ke admin setiap jam).
- [ ] Chat dan lonceng notifikasi untuk semua role (design-mentor.md Alur 10, design-intern.md Alur 12, design-admin.md 13.2). Ditunda sampai fitur dasar ketiga role selesai.
- [ ] Broadcast notifikasi lewat Reverb (private channel `users.{id}`), setelah baris `notifications` dibuat.
- [ ] Admin: kolom jumlah hari Terlambat di Rekap Absensi Excel dan daftar Absensi (design-admin 12.3). Kartu Terlambat di dashboard dan jumlah Terlambat di Warning sudah selesai (20 Okt 2026).
- [ ] Hapus `database/generate_migrations.php` (migration sudah terbentuk).
- [ ] Lepas Inertia dari starter (`HandleInertiaRequests`, `resources/js`, `config/inertia.php`, `routes/web.php`). `tests/Feature/ExampleTest.php` masih gagal karena membuka halaman Inertia yang butuh build Vite; hapus bersama Inertia.
- [ ] CORS: izinkan origin frontend (`http://localhost:<port>` saat development, domain Vercel saat production).
- [ ] Sambungkan frontend: simpan token, kirim header `Authorization: Bearer <token>`, arahkan ke Ganti Password jika `must_change_password`, kembali ke login saat respons 401 atau 403 akun nonaktif.

## Keputusan pemilik repo

Keputusan atas perbedaan kecil antara kode dan dokumen/prototipe (18 Okt 2026). Kode **tidak diubah**; tinjau lagi setelah frontend tersambung (lihat bagian berikut).

- **Ubah Task yang lewat tenggat: tetap seperti sekarang.** Tenggat yang tidak diubah boleh tetap lewat, jadi Task terlambat masih bisa diperbaiki judul dan deskripsinya. Tenggat yang diubah harus setelah waktu sekarang. (Prototipe `validateTask` selalu mewajibkan tenggat setelah sekarang.)
- **Lupa Clock Out tidak dihitung Hadir di KPI Kehadiran.** Sama dengan prototipe (`attendanceRate`). Perbaikannya lewat koreksi absensi: setelah admin menyetujui, hari itu menjadi Hadir dan KPI ikut berubah karena dihitung saat dibaca. Di rekap, Lupa Clock Out tetap kolom sendiri, tidak masuk Tidak Hadir.
- **Notifikasi keputusan izin tetap singkat**: "Izin Sakit 13-14 Okt disetujui." tanpa catatan mentor. Catatan dibaca intern di detail izin. (design-mentor.md 9.1 menyebut notifikasi berisi catatan; design-intern.md 16 memakai teks singkat.)

## Ditinjau setelah integrasi frontend

Perubahan yang muncul dari keputusan di atas atau dari integrasi dicatat di sini dulu, lalu dikerjakan pada pengembangan berikutnya setelah tim frontend menyambungkan API. Jangan langsung mengubah kode.

- [ ] Samakan aturan tenggat saat Ubah Task di frontend (`validateTask` di `frontend/src/lib/mock-rules.ts` masih menolak tenggat lampau yang tidak diubah), atau sebaliknya jika tim memilih aturan prototipe.
- [ ] Pastikan teks bantuan KPI di halaman Performa menjelaskan bahwa Lupa Clock Out tidak dihitung hadir sampai dikoreksi.
- [ ] Cek ulang bentuk respons yang berubah saat penyeragaman (`submission.file` menggantikan `has_file`, `unread_comments` di kotak Dashboard mentor) terhadap kode frontend.

## Perlu diputuskan

- [ ] Pengingat Task terlambat (design-mentor.md 7.6) saat ini **tidak** dikirim untuk Task milik intern nonaktif, karena intern itu tidak bisa mengumpulkan lagi. Dokumen tidak membahasnya.
- [ ] Masa berlaku token. Saat ini `expiration` di `config/sanctum.php` bernilai `null`, jadi token berlaku sampai logout, direset admin, atau akun dinonaktifkan.

## Masih terbuka

- [ ] Host untuk Laravel API dan Reverb (VPS atau platform container).
- [ ] Penanganan GPS kurang akurat dan VPN saat validasi lokasi.

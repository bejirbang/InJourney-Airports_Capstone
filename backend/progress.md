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
- [x] **Dashboard Intern** `GET /api/intern/dashboard` (17 Okt 2026, docs/design-intern.md Alur 2)
  - `today`: kondisi kartu Hari Ini (`not_clocked_in`, `clocked_in`, `clocked_out`, `holiday`, `on_leave`, `outside_period`), jam clock in dan out, Daily Report terkirim, nama libur, jenis izin. `daily_report_reminder` untuk banner.
  - `monthly_recap`: hadir, izin, tidak hadir, lupa clock out, hari kerja berjalan. Hanya status final (sampai kemarin), dalam periode magang, tanpa hari libur.
  - `tasks`: jumlah To Do, In Progress, In Review, Terlambat, total, dan tenggat terdekat. `internship`: periode dan mentor. `announcements`: 3 pengumuman terbaru untuk intern.
  - Status kehadiran dihitung di `App\Services\AttendanceCalendar` (dipakai lagi untuk riwayat absensi dan Performa). Label Terlambat di `Task::isLate()`.
  - Model baru: `Attendance`, `DailyReport`, `LeaveRequest`, `Task`, `Holiday`, `Announcement` beserta factory. Enum baru: `TaskStatus`, `LeaveType`, `RequestStatus`, `AttendanceStatus`, `TodayState`.
  - Test di `tests/Feature/Intern/DashboardTest.php` (18 test lolos).
- [x] **Clock In** `POST /api/intern/attendance/clock-in` (17 Okt 2026, docs/design-intern.md Alur 3)
  - Body: `latitude`, `longitude` dari browser. Jarak dihitung di backend (Haversine, `Office::distanceTo()`). Diterima jika masuk radius clock in salah satu kantor aktif; yang dicatat kantor terdekat yang masuk radius.
  - Ditolak (422, `message` dan `reason`): `outside_period`, `holiday` (akhir pekan atau tabel `holidays`), `on_leave` (izin disetujui), `already_clocked_in`, `no_active_office`, `outside_radius`. Izin Pending tidak menghalangi. Tidak ada batas jam clock in.
  - Respons 201: "Clock in berhasil pukul HH:MM." dan data absensi (`AttendanceResource`). Kartu Hari Ini di dashboard menambah `has_active_office`.
  - Logika di `App\Services\AttendanceClock`. Model `Office` dan factory-nya. Seeder menambah "Kantor Pusat Terminal 3" (titik sama dengan data contoh frontend).
  - Test di `tests/Feature/Intern/ClockInTest.php` (20 test lolos).
- [x] **Daily Report** `GET` dan `PUT /api/intern/attendance/daily-report` (17 Okt 2026, docs/design-intern.md Alur 4)
  - Hanya untuk hari ini, setelah clock in, dan dapat diubah sampai clock out. Satu laporan per absensi (dibuat atau diperbarui). Hari lupa clock out ikut terkunci setelah 23:59 karena bukan hari ini lagi.
  - Body: `work` (wajib, "Isi apa yang Anda kerjakan hari ini."), `notes` (opsional). Respons 201 "Daily Report terkirim." untuk kiriman pertama, 200 "Perubahan tersimpan." untuk perubahan. `sent_at` = waktu simpan terakhir, `editable` untuk tombol Ubah.
  - Ditolak (422): `not_clocked_in` ("Clock in dulu untuk mengisi Daily Report."), `clocked_out` ("Laporan terkunci setelah clock out.").
  - Logika di `App\Services\DailyReports`. Exception penolakan aturan bisnis: `ActionRejected` (respons 422 berisi `message` dan `reason`).
  - Test di `tests/Feature/Intern/DailyReportTest.php` (16 test lolos).
- [x] **Clock Out** `POST /api/intern/attendance/clock-out` (17 Okt 2026, docs/design-intern.md Alur 5)
  - Body: `latitude`, `longitude`. Urutan pemeriksaan: Daily Report terkirim, jam pulang, lalu radius clock out kantor aktif mana pun (boleh berbeda dari kantor clock in).
  - Ditolak (422): `not_clocked_in`, `already_clocked_out`, `daily_report_missing`, `before_work_end` ("Belum saatnya clock out, tunggu 1 jam 1 menit lagi."; clock out sebelum jam pulang tidak boleh, keputusan 17 Okt 2026), `no_active_office`, `outside_radius`. Hari kemarin yang lupa clock out tidak bisa ditutup lagi.
  - Respons 200: "Clock out berhasil pukul HH:MM. Terima kasih." Daily Report ikut terkunci.
  - Jam pulang dari `work_hour_settings` yang berlaku hari itu (`WorkHourSetting::effectiveOn()`). Tanpa pengaturan jam kerja, tidak ada batas jam pulang. Kartu Hari Ini menambah `work_hours`. Seeder menambah jam kerja 08:00 sampai 17:00.
  - Logika di `App\Services\AttendanceClock::clockOut()`. Pemeriksaan radius dipakai bersama clock in.
  - Test di `tests/Feature/Intern/ClockOutTest.php` (20 test lolos).
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
- [x] **Koreksi Absensi, sisi intern** (17 Okt 2026, docs/design-intern.md Alur 7)
  - `GET`, `POST /api/intern/attendance-corrections`; `GET .../{id}`; `POST .../{id}/cancel`; `GET .../{id}/evidence` (unduh bukti setelah hak akses dicek, tanpa URL publik).
  - Body (multipart): `date`, `clock_in`, `clock_out` (HH:MM), `reason`, `evidence` (opsional, maks 2 MB, PDF/Word/Excel/PowerPoint dari `config/uploads.php`). Jam tercatat disalin sebagai pembanding. Absensi tidak berubah sampai admin menyetujui.
  - Aturan: hanya hari kerja yang sudah lewat atau hari ini dalam periode magang; satu Pending per tanggal (juga dijaga unique index); batal hanya saat Pending ("Data ini sudah diproses oleh [nama].").
  - Setiap admin aktif mendapat baris `notifications`: "Rina W. mengajukan koreksi absensi 9 Okt." (link `/koreksi`, `open` = id). Broadcast Reverb belum.
  - Riwayat absensi menambah `has_pending_correction`; tombol Koreksi tidak muncul untuk tanggal yang masih Pending.
  - Model `AttendanceCorrection`, `Notification`; policy `AttendanceCorrectionPolicy`; logika di `App\Services\AttendanceCorrections`.
  - Test di `tests/Feature/Intern/AttendanceCorrectionTest.php` (31 test lolos).
- [x] **Task intern: daftar, Kanban, detail, perpindahan** (17 Okt 2026, docs/design-intern.md Alur 8)
  - `GET /api/intern/tasks`: filter `status`, `late`, `q` (judul), `sort` (`due` default, `newest`), `include_older_done`. Kolom Done hanya 30 hari terakhir secara default (`meta.hidden_done`). Tiap kartu: mentor, tenggat, `is_late`, `late_label` ("Lewat 2 hari"), `unread_comments`, `revise_pending`, `action` (start, submit, replace).
  - `GET /api/intern/tasks/{id}`: deskripsi, hasil terkumpul, thread komentar (`is_unread` untuk disorot), `can_comment`. Membuka detail mencatat `task_reads`, jadi indikator komentar baru hilang.
  - `POST /api/intern/tasks/{id}/move` (`to`, `from` opsional): To Do ke In Progress, In Progress ke To Do jika belum pernah dikumpulkan. Ditolak dengan pesan prototipe: `not_started`, `submission_required` (In Review hanya lewat pengumpulan, Alur 9), `ever_submitted`, `in_review_locked`, `done_locked`, `mentor_only`, `stale` ("Status Task sudah berubah. Muat ulang.").
  - Model `TaskComment`, `TaskRead`; policy `TaskPolicy`; logika di `App\Services\InternTasks`. Exception `AttendanceRejected` diganti nama menjadi `ActionRejected`.
  - Test di `tests/Feature/Intern/TaskTest.php` (24 test lolos).
- [x] **Kumpulkan dan Ganti Hasil Task** (17 Okt 2026, docs/design-intern.md Alur 9)
  - `POST /api/intern/tasks/{id}/submission` (multipart: `link`, `file`, `from` opsional): boleh saat In Progress (kumpul pertama atau setelah Revise) dan In Review (Ganti Hasil). Status menjadi In Review, `ever_submitted` true, `revise_pending` false. Respons: "Hasil terkumpul. Menunggu pemeriksaan mentor."
  - Pengumpulan ulang menggantikan seluruh hasil (link dan file). File lama dihapus permanen; file baru dihapus lagi jika pengumpulan gagal. Task lewat tenggat tetap diterima.
  - Validasi: "Isi link atau pilih file.", "Format link tidak valid." (harus http/https), 2 MB, jenis file dengan saran kirim lewat link (`config/uploads.php` `mimes_or_link`).
  - Ditolak: `not_started` (To Do), `done` ("Task ini sudah selesai."), `accepted` ("Task sudah diterima mentor." jika intern sedang mengganti hasil saat mentor Accept). Baris Task dikunci selama pengumpulan.
  - Notifikasi mentor sesuai design-mentor.md 14: "Rina W. mengumpulkan Task 'Laporan API'." atau "Rina W. mengganti hasil Task 'Laporan API'." (saat In Review).
  - `GET /api/intern/tasks/{id}/submission/file`: unduh file hasil sendiri (`hasil-TSK-024.pdf`).
  - Service `App\Services\TaskSubmissions`, dan `App\Services\Notifier` untuk semua baris notifikasi (koreksi absensi ikut memakainya).
  - Test di `tests/Feature/Intern/TaskSubmissionTest.php` (19 test lolos).
- [x] **Komentar Task, sisi intern** (17 Okt 2026, docs/design-intern.md Alur 10)
  - `POST /api/intern/tasks/{id}/comments` (`body`): balasan masuk thread, 201. Komentar kosong atau hanya spasi: "Tulis komentar dulu." Thread terkunci pada Task Done ("Task sudah selesai dan terkunci.", `done_locked`). Tidak ada endpoint ubah atau hapus komentar.
  - Mengirim balasan mencatat `task_reads`, jadi komentar sebelumnya tidak lagi dihitung baru.
  - Notifikasi mentor Task: "Rina W. membalas komentar di 'Laporan API'." (link `/task`, `open` = id, `to` = `comments`).
  - Service `App\Services\TaskComments`, bentuk komentar di `TaskCommentResource` (dipakai juga di detail Task).
  - Test di `tests/Feature/Intern/TaskCommentTest.php` (14 test lolos).
- [x] **Izin, sisi intern** (17 Okt 2026, docs/design-intern.md Alur 11)
  - `GET /api/intern/leaves` (filter `status`, tanggal izin terbaru lebih dulu), `POST /api/intern/leaves` (multipart: `type` sick/urgent, `start_date`, `end_date`, `reason`, `evidence` opsional), `GET .../{id}`, `POST .../{id}/cancel`, `GET .../{id}/evidence`, `GET /api/intern/leaves/working-days` (pratinjau "Total: 2 hari kerja").
  - Validasi sesuai validateLeave: jenis, tanggal selesai tidak sebelum mulai, dalam periode magang, minimal satu hari kerja, tidak tumpang tindih dengan izin Pending atau Disetujui (dicek dengan baris akun dikunci), alasan wajib, lampiran 2 MB dan jenis file.
  - Tanggal lampau boleh, ditandai `submitted_late` ("Diajukan setelah tanggal izin"). `working_days` dihitung saat dibaca, jadi libur yang ditambahkan admin belakangan ikut mengurangi.
  - Detail: pemroses (`decided_by` nama dan role, untuk "Diproses oleh admin"), catatan, waktu. Batal hanya saat Pending ("Izin ini sudah diproses oleh [nama].").
  - Notifikasi mentor sesuai design-mentor.md 14: "Andi P. mengajukan Izin Sakit 13-14 Okt." dan "Andi P. membatalkan pengajuan izin 13-14 Okt." Rentang tanggal lewat `IndonesianDate::range()` (sama dengan formatRange frontend).
  - Izin disetujui mengubah status absensi lewat `AttendanceCalendar` (sudah ada); hari yang sudah clock in tetap Hadir.
  - Service `App\Services\InternLeaves`, policy `LeaveRequestPolicy`.
  - Test di `tests/Feature/Intern/LeaveTest.php` (30 test lolos).

## Berikutnya

- [ ] Mentor dan admin: memutuskan izin (catatan wajib; admin hanya untuk izin Pending yang punya bukti), notifikasi ke intern. design-mentor.md dan design-admin.md Alur 5.
- [ ] Admin: memutuskan koreksi (Setujui/Tolak, catatan wajib, jam final, perbarui atau buat `attendances` dengan `is_corrected = true`, notifikasi ke intern, `audit_logs`, pesan "Permintaan ini sudah diproses oleh [nama admin]."). design-admin.md Alur 4.
- [ ] Broadcast notifikasi lewat Reverb (private channel `users.{id}`), setelah baris `notifications` dibuat.
- [ ] Admin: kartu "Terlambat hari ini" di dashboard, jumlah terlambat bulan ini di layar Warning, kolom jumlah hari Terlambat di Rekap Absensi Excel dan daftar Absensi (design-admin 5, 10, 12.3).
- [ ] Hapus `database/generate_migrations.php` (migration sudah terbentuk).
- [ ] Lepas Inertia dari starter (`HandleInertiaRequests`, `resources/js`, `config/inertia.php`, `routes/web.php`). `tests/Feature/ExampleTest.php` masih gagal karena membuka halaman Inertia yang butuh build Vite; hapus bersama Inertia.
- [ ] CORS: izinkan origin frontend (`http://localhost:<port>` saat development, domain Vercel saat production).
- [ ] Sambungkan frontend: simpan token, kirim header `Authorization: Bearer <token>`, arahkan ke Ganti Password jika `must_change_password`, kembali ke login saat respons 401 atau 403 akun nonaktif.
- [ ] Kelola akun oleh admin: tambah (password sementara tampil sekali), ubah, nonaktifkan/aktifkan, ganti mentor. Pakai `AuditLog::record()`.

## Perlu diputuskan

- [ ] Masa berlaku token. Saat ini `expiration` di `config/sanctum.php` bernilai `null`, jadi token berlaku sampai logout, direset admin, atau akun dinonaktifkan.

## Masih terbuka

- [ ] Host untuk Laravel API dan Reverb (VPS atau platform container).
- [ ] Penanganan GPS kurang akurat dan VPN saat validasi lokasi.

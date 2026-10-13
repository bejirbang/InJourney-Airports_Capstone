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

## Berikutnya

- [ ] Hapus `database/generate_migrations.php` (migration sudah terbentuk).
- [ ] Lepas Inertia dari starter (`HandleInertiaRequests`, `resources/js`, `config/inertia.php`, `routes/web.php`). `tests/Feature/ExampleTest.php` masih gagal karena membuka halaman Inertia yang butuh build Vite; hapus bersama Inertia.
- [ ] CORS: izinkan origin frontend (`http://localhost:<port>` saat development, domain Vercel saat production).
- [ ] Sambungkan frontend: simpan token, kirim header `Authorization: Bearer <token>`, arahkan ke Ganti Password jika `must_change_password`, kembali ke login saat respons 401 atau 403 akun nonaktif.
- [ ] Kelola akun oleh admin: tambah (password sementara tampil sekali), ubah, nonaktifkan/aktifkan, ganti mentor. Pakai `AuditLog::record()`.
- [ ] Buat PHP enum lain di `app/Enums` (status Task, jenis izin, status pengajuan) dengan nilai yang sama seperti di migration.

## Perlu diputuskan

- [ ] Masa berlaku token. Saat ini `expiration` di `config/sanctum.php` bernilai `null`, jadi token berlaku sampai logout, direset admin, atau akun dinonaktifkan.

## Masih terbuka

- [ ] Host untuk Laravel API dan Reverb (VPS atau platform container).
- [ ] Penanganan GPS kurang akurat dan VPN saat validasi lokasi.

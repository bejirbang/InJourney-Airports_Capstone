# Progress Backend

Catatan pekerjaan backend dan hal yang belum boleh terlupa.

## Selesai

- [x] Koneksi database diubah ke PostgreSQL (`DB_CONNECTION=pgsql`). Produksi memakai Supabase. (13 Okt 2026)
- [x] Skrip pembuat 18 migration tabel aplikasi: `database/generate_migrations.php`. (13 Okt 2026)
  - `users`: kolom akun, soft delete, email unik hanya untuk akun yang belum dihapus.
  - `attendances`: `clock_in_office_id` dan `clock_out_office_id`.
  - `attendance_corrections`: satu koreksi `pending` per intern per tanggal (unique index parsial).
  - `notifications`: tabel sendiri sesuai ERD, bukan tabel bawaan Laravel.
  - `audit_logs`: kolom `admin_name`.
  - Aturan foreign key untuk penghapusan akun, lihat "Penghapusan akun" di `backend_architecture_ERD.md`.

## Berikutnya

- [ ] Jalankan `php database/generate_migrations.php`, lalu `php artisan migrate:fresh`. Hapus skrip setelah file migration terbentuk.
- [ ] **Pasang Sanctum dan buat tabel `personal_access_tokens`**: `php artisan install:api`. Perintah ini juga membuat `routes/api.php`. Tabel ini belum ada di migration saat ini.
- [ ] Tambah trait `SoftDeletes` di model `User`. Tanpa trait ini, `delete()` langsung menghapus permanen.
- [ ] Buat PHP enum di `app/Enums` (role, status Task, jenis izin, status pengajuan) dengan nilai yang sama seperti di migration.
- [ ] Lepas Inertia dari starter (`HandleInertiaRequests`, `resources/js`, `config/inertia.php`).

## Masih terbuka

- [ ] Host untuk Laravel API dan Reverb (VPS atau platform container).
- [ ] Penanganan GPS kurang akurat dan VPN saat validasi lokasi.

# design-admin.md - Desain Role Admin (Lengkap, Berdasarkan Alur)

Sistem: Web Intern Management dan Attendance System
Versi: Draft 2 | Tanggal: 10 Oktober 2026 | Acuan: PRD tanggal 7 Oktober 2026
Perubahan Draft 2: menu Lokasi Kantor (Bagian 9A), batas file 2 MB, validasi lokasi saat clock in dan clock out.

Tanda yang dipakai di dokumen ini:
- **[Keputusan]** = sudah disepakati di PRD.
- **[Usulan]** = pilihan desain dari saya. Per 10 Oktober 2026 semua usulan di dokumen ini **diikuti**, kecuali hal yang tercantum di Bagian 17.2.

---

## 1. Cara Membaca Dokumen Ini

Dokumen disusun menurut **alur kerja Admin**, bukan menurut daftar menu. Tiap alur berisi: tujuan, langkah demi langkah, sketsa layar, kondisi khusus, dan dampaknya (log dan notifikasi). Dengan begitu tim bisa melihat urutan layar dan perilaku sistem di tiap langkah.

Isi:
1. Cara membaca
2. Gambaran Admin dan navigasi
3. Alur 1 - Setup awal
4. Alur 2 - Kelola akun pengguna
5. Alur 3 - Pantauan harian lewat Dashboard
6. Alur 4 - Koreksi absensi
7. Alur 5 - Izin pending
8. Alur 6 - Akhir periode magang
9. Alur 7 - Kalender libur dan jam kerja
9A. Alur 7B - Lokasi kantor
10. Alur 8 - Catatan warning
11. Alur 9 - Pengumuman
12. Alur 10 - Export laporan PDF
13. Alur 11 - Log aktivitas, chat, profil
14. Notifikasi Admin (bell icon)
15. Aturan tampilan (status, warna, pesan)
16. Hak akses Admin (bisa dan tidak bisa)
17. Keputusan tambahan dan hal yang masih terbuka

---

## 2. Gambaran Admin dan Navigasi

**Peran:** Admin adalah PIC magang di perusahaan. **[Keputusan]** Jumlah admin ditentukan perusahaan, semua admin berhak sama.

**Platform:** web, utamanya desktop. Di tablet sidebar bisa dilipat. Di layar kecil tabel bisa digeser ke samping. **[Usulan]**

### 2.1 Kerangka halaman

```
+------------------------------------------------------------------------+
| [Logo]  Nama Sistem                         [Chat] [Bell 3] [Admin v]  |
+-------------+----------------------------------------------------------+
| Dashboard   |                                                          |
| Pengguna    |                                                          |
| Absensi     |                  AREA KONTEN HALAMAN                     |
| Koreksi (2) |                                                          |
| Izin (1)    |                                                          |
| Warning     |                                                          |
| Pengumuman  |                                                          |
| Laporan     |                                                          |
| Pengaturan  |                                                          |
| Lokasi Kantor|                                                         |
| Log Aktivitas|                                                         |
+-------------+----------------------------------------------------------+
```

Angka kecil di sebelah Koreksi dan Izin adalah jumlah yang menunggu diproses.

### 2.2 Menu sidebar

| Menu | Isi | Alamat halaman (usulan) |
|---|---|---|
| Dashboard | Ringkasan hari ini dan pengingat | /admin/dashboard |
| Pengguna | Daftar akun, tambah, ubah, nonaktif, reset password, ganti mentor | /admin/users |
| Absensi | Data absensi dan rekap bulanan | /admin/attendance |
| Koreksi | Permintaan koreksi absensi dari intern | /admin/corrections |
| Izin | Semua pengajuan izin, proses yang Pending | /admin/leaves |
| Warning | Catatan peringatan per intern | /admin/warnings |
| Pengumuman | Buat dan kelola pengumuman per role | /admin/announcements |
| Laporan | Export PDF | /admin/reports |
| Pengaturan | Jam kerja dan kalender libur | /admin/settings |
| Lokasi Kantor | Daftar kantor, titik di peta, radius clock in dan clock out | /admin/offices |
| Log Aktivitas | Jejak tindakan admin | /admin/audit-log |

Chat dan notifikasi (bell icon) ada di navbar atas, bukan di sidebar. **[Keputusan]** Tidak ada halaman notifikasi terpisah.

---

## 3. Alur 1 - Setup Awal

**Tujuan:** menyiapkan sistem sebelum intern mulai memakainya.
**Pelaku:** Admin pertama.
**Catatan teknis:** akun admin pertama disiapkan oleh tim teknis saat sistem dipasang. Admin berikutnya dibuat oleh admin yang sudah ada. **[Usulan]**

### Urutan yang disarankan

| No | Langkah Admin | Respons sistem | Layar |
|---|---|---|---|
| 1 | Login dengan akun yang diberikan | Sistem meminta ganti password sementara | Login, lalu Ganti Password |
| 2 | Mengisi password baru dan konfirmasinya | Password tersimpan, masuk ke Dashboard | Ganti Password |
| 3 | Membuka Pengaturan, tab **Jam Kerja**, mengisi jam masuk dan jam pulang | Jam kerja global tersimpan | Pengaturan |
| 4 | Membuka tab **Kalender Libur**, menambah hari libur | Tanggal libur tampil di kalender | Pengaturan |
| 5 | Membuka **Lokasi Kantor**, menambah kantor lewat peta, mengisi nama dan dua radius | Kantor tersimpan dan aktif | Lokasi Kantor |
| 6 | Membuka Pengguna, menambah akun Mentor | Akun dibuat, password sementara tampil sekali | Pengguna |
| 7 | Menambah akun Intern, memilih mentor dan periode magang | Akun dibuat, password sementara tampil sekali | Pengguna |
| 8 | Menyampaikan email internal dan password sementara ke tiap pengguna | - | - |

Mengapa jam kerja dan kalender dulu: status kehadiran dihitung dari keduanya. Kalau diisi belakangan, absensi awal bisa salah hitung.
Mengapa lokasi kantor sebelum akun intern: tanpa kantor aktif, intern tidak bisa clock in.

### Layar Ganti Password (login pertama)

```
+----------------------------------------------+
|  Ganti Password                              |
|  Demi keamanan, buat password baru Anda.     |
|                                              |
|  Password baru        [____________] (mata)  |
|  Ulangi password baru [____________] (mata)  |
|                                              |
|  Syarat: minimal 8 karakter, ada huruf dan   |
|  angka.                                      |
|                                              |
|                         [ Simpan Password ]  |
+----------------------------------------------+
```

Aturan:
- Halaman lain tidak bisa dibuka sebelum password diganti.
- Password baru tidak boleh sama dengan password sementara.
- Syarat password (8 karakter, huruf dan angka) adalah **[Usulan]**.

---

## 4. Alur 2 - Kelola Akun Pengguna

**Tujuan:** membuat dan merawat akun Intern, Mentor, dan Admin.
**Halaman:** Pengguna.

### 4.1 Daftar pengguna

```
+------------------------------------------------------------------------+
| Pengguna                                          [ + Tambah Akun ]    |
| Cari: [______________]  Role: [Semua v]  Status: [Aktif v]             |
|                                                                        |
| Nama          Role    Mentor        Periode Magang       Status  Aksi  |
| ------------------------------------------------------------------     |
| Andi Pratama  Intern  Bu Sari       1 Sep - 31 Des 2026  Aktif   [...] |
| Bu Sari       Mentor  -             -                    Aktif   [...] |
| Rina Wulandari Intern Pak Budi      1 Mar - 30 Sep 2026  Nonaktif [...] |
|                                                                        |
| Menampilkan 1-10 dari 24                              [<] 1 2 3 [>]    |
+------------------------------------------------------------------------+
```

Menu aksi [...] per baris:
- Lihat detail
- Ubah data
- Ganti mentor (hanya untuk Intern)
- Reset password
- Nonaktifkan atau Aktifkan

Aturan:
- Tidak ada tombol **Hapus**. **[Keputusan]** Akun hanya dinonaktifkan agar data tetap ada.
- Default filter Status = Aktif.

### 4.2 Tambah akun

Langkah:

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Klik **Tambah Akun** | Formulir terbuka |
| 2 | Mengisi data dan memilih role | Kolom khusus Intern tampil bila role = Intern |
| 3 | Klik **Simpan** | Sistem memeriksa isian |
| 4 | - | Akun dibuat, sistem membuat **password sementara** |
| 5 | - | Dialog menampilkan password sementara **satu kali** dengan tombol **Salin** |
| 6 | Menyalin dan menutup dialog | Kembali ke daftar, akun baru muncul |

```
+--------------------------------------------------+
| Tambah Akun                                      |
|                                                  |
| Nama lengkap *      [_________________________]  |
| Email internal *    [_________________________]  |
| Role *              ( ) Intern ( ) Mentor ( ) Admin |
|                                                  |
| -- Tampil jika role = Intern --                  |
| Mentor *            [Pilih mentor            v]  |
| Tanggal mulai *     [__/__/____]                 |
| Tanggal selesai *   [__/__/____]                 |
|                                                  |
| Password sementara dibuat otomatis oleh sistem.  |
|                                                  |
|                        [ Batal ]  [ Simpan ]     |
+--------------------------------------------------+
```

Validasi:

| Kolom | Aturan | Pesan jika salah |
|---|---|---|
| Nama | Wajib | "Nama wajib diisi." |
| Email | Wajib, format benar, belum dipakai | "Email sudah terdaftar." |
| Mentor | Wajib untuk Intern, hanya mentor aktif | "Pilih mentor untuk intern ini." |
| Tanggal selesai | Tidak boleh sebelum tanggal mulai | "Tanggal selesai harus sesudah tanggal mulai." |

Catatan:
- Password sementara hanya tampil satu kali. Jika terlewat, admin memakai **Reset password**.
- Intern wajib mengganti password pada login pertama. **[Keputusan]**
- Login memakai **email internal** yang didaftarkan admin saat membuat akun. Tidak ada Google OAuth. **[Keputusan]** Semua pembuatan akun bergantung pada admin. **[Keputusan]**
- Role tidak bisa diubah setelah akun dibuat; jika perlu, buat akun baru. **[Usulan]**

### 4.3 Detail pengguna (khusus Intern)

```
+------------------------------------------------------------------------+
| < Pengguna      Andi Pratama                      [Ubah] [Aksi v]      |
| Status: Aktif   Mentor: Bu Sari   Periode: 1 Sep - 31 Des 2026         |
|                                                                        |
| [Profil] [Absensi] [Izin] [Koreksi] [Warning]                          |
| ---------------------------------------------------------------------- |
| (isi tab yang dipilih)                                                 |
+------------------------------------------------------------------------+
```

| Tab | Isi |
|---|---|
| Profil | Data akun, mentor, periode magang |
| Absensi | Riwayat absensi intern ini |
| Izin | Riwayat izin dan statusnya |
| Koreksi | Riwayat permintaan koreksi |
| Warning | Catatan peringatan (hanya admin yang melihat) |

Tidak ada dashboard performa seluruh intern untuk admin. **[Keputusan]**

### 4.4 Ganti mentor

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Aksi, lalu **Ganti mentor** | Dialog terbuka |
| 2 | Memilih mentor baru | Sistem menghitung dampak |
| 3 | Membaca ringkasan dampak | Menampilkan jumlah Task aktif, komentar, dan izin pending yang akan pindah |
| 4 | Klik **Pindahkan** | Data pindah ke mentor baru, riwayat lama tetap tersimpan |
| 5 | - | Mentor baru dan intern menerima notifikasi, tindakan masuk log |

```
+--------------------------------------------------+
| Ganti Mentor - Andi Pratama                      |
| Mentor saat ini: Bu Sari                         |
| Mentor baru *    [Pilih mentor               v]  |
|                                                  |
| Yang akan dipindahkan ke mentor baru:            |
|  - 4 Task aktif beserta komentarnya              |
|  - 1 izin Pending                                |
| Riwayat lama tetap tersimpan.                    |
|                                                  |
|                  [ Batal ]  [ Pindahkan ]        |
+--------------------------------------------------+
```

Aturan: satu intern tepat satu mentor. **[Keputusan]**

### 4.5 Reset password

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Aksi, lalu **Reset password** | Dialog konfirmasi |
| 2 | Klik **Ya, reset** | Sistem membuat password sementara baru |
| 3 | - | Password tampil satu kali dengan tombol **Salin** |
| 4 | Menyampaikan password ke pengguna | Pengguna wajib ganti password saat login berikutnya |

Admin tidak mengetik password sendiri. **[Keputusan]**

### 4.6 Nonaktifkan dan aktifkan akun

Dialog konfirmasi menjelaskan dampaknya:

```
+--------------------------------------------------+
| Nonaktifkan akun Andi Pratama?                   |
|                                                  |
|  - Tidak bisa login dan clock in.                |
|  - Data tetap bisa dilihat mentor dan admin.     |
|  - Mentor tetap bisa memeriksa Task yang sudah   |
|    dikumpulkan.                                  |
|                                                  |
|               [ Batal ]  [ Nonaktifkan ]         |
+--------------------------------------------------+
```

Aturan:
- Nonaktif, bukan hapus. **[Keputusan]**
- Admin tidak bisa menonaktifkan akunnya sendiri, dan harus tersisa minimal satu admin aktif. **[Usulan]**
- Mentor yang masih punya intern aktif tidak bisa dinonaktifkan. Sistem meminta admin memindahkan interns ke mentor lain dulu. **[Usulan]**
- Mengaktifkan kembali intern dilakukan dengan memperbarui tanggal selesai magang. **[Usulan]**

**Dampak seluruh Alur 2:** setiap tambah, ubah, ganti mentor, reset password, dan nonaktif masuk **Log Aktivitas**.

---

## 5. Alur 3 - Pantauan Harian Lewat Dashboard

**Tujuan:** admin melihat apa yang perlu ditindak hari ini dalam satu layar.
**Halaman:** Dashboard.

### 5.1 Layout

```
+------------------------------------------------------------------------+
| Dashboard                                      Senin, 12 Okt 2026      |
|                                                                        |
| [Sudah Clock In] [Izin]   [Belum Clock In]                             |
|      18            2           4                                       |
| Status final (Tidak Hadir, Lupa Clock Out) ditetapkan setelah 23:59.   |
| Kemarin: Hadir 20 | Izin 2 | Tidak Hadir 1 | Lupa Clock Out 1          |
|                                                                        |
| PERLU TINDAKAN                                                         |
| +--------------------------------+ +---------------------------------+ |
| | Izin pending > 24 jam (2)      | | Permintaan koreksi (3)          | |
| | Andi P.  Sakit   30 jam  [Buka]| | Rina W.  9 Okt    [Buka]        | |
| | Dewi S.  Urgent  26 jam  [Buka]| | Budi K.  8 Okt    [Buka]        | |
| |                [Lihat semua]   | |                  [Lihat semua]  | |
| +--------------------------------+ +---------------------------------+ |
|                                                                        |
| +--------------------------------------------------------------------+ |
| | Magang berakhir dalam 7 hari (2)                                   | |
| | Rina W.  Selesai 17 Okt  Mentor: Pak Budi  [Tanya mentor][Perpanjang]|
| | Doni A.  Selesai 18 Okt  Mentor: Bu Sari   [Tanya mentor][Perpanjang]|
| +--------------------------------------------------------------------+ |
+------------------------------------------------------------------------+
```

### 5.2 Penjelasan tiap bagian

| Bagian | Isi | Aturan |
|---|---|---|
| Kartu hari ini | Jumlah Sudah Clock In, Izin, Belum Clock In | Pada hari berjalan intern yang belum clock in disebut "Belum Clock In", bukan "Tidak Hadir", karena status final baru ditetapkan setelah 23:59. **[Usulan berdasar aturan cut-off]** |
| Ringkasan kemarin | Hadir, Izin, Tidak Hadir, Lupa Clock Out | Memakai status final yang sudah ditetapkan sistem |
| Izin pending > 24 jam | Izin yang belum diproses mentor lebih dari 24 jam | **[Keputusan]** Menampilkan jenis izin dan lama pending. Tombol **Buka** menuju Alur 5 |
| Permintaan koreksi | Permintaan koreksi absensi yang menunggu | Tombol **Buka** menuju Alur 4 |
| Magang berakhir dalam 7 hari | Intern yang tanggal selesainya H-7 sampai hari H | **[Keputusan]** Tombol **Tanya mentor** dan **Perpanjang** menuju Alur 6 |

Tiap daftar menampilkan maksimal 5 baris, sisanya lewat **Lihat semua**.

### 5.3 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Hari ini Sabtu, Minggu, atau libur | Banner "Hari ini hari libur: [nama libur]". Kartu hari ini disembunyikan |
| Belum ada kantor aktif | Banner "Belum ada kantor aktif. Intern tidak bisa clock in." dengan tautan ke Lokasi Kantor |
| Tidak ada yang perlu ditindak | Tulisan "Tidak ada yang perlu ditindak hari ini." di tiap kotak |
| Data gagal dimuat | Pesan "Data gagal dimuat." dan tombol **Coba lagi** |

---

## 6. Alur 4 - Koreksi Absensi

**Tujuan:** memperbaiki data absensi yang salah, setelah diverifikasi.
**Pemicu:** intern mengajukan permintaan koreksi, admin menerima notifikasi.
**Halaman:** Koreksi.
**Prinsip:** admin **menanyakan dan memverifikasi dulu** sebelum menyetujui. **[Keputusan]**

### 6.1 Langkah

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Menerima notifikasi di bell atau melihat kotak Koreksi di Dashboard | Daftar menampilkan permintaan berstatus **Pending** |
| 2 | Membuka satu permintaan | Panel detail terbuka |
| 3 | Membaca data tercatat dan data yang diajukan | - |
| 4 | Klik **Tanya intern lewat chat** bila perlu klarifikasi | Chat dengan intern terbuka |
| 5 | Mengisi **Catatan verifikasi** | - |
| 6a | Klik **Setujui** | Absensi diperbarui, status dihitung ulang otomatis |
| 6b | Klik **Tolak** | Permintaan ditutup, data absensi tidak berubah |
| 7 | - | Intern menerima notifikasi berisi hasil dan catatan. Tindakan masuk log |

### 6.2 Layar daftar

```
+------------------------------------------------------------------------+
| Koreksi Absensi                                                        |
| Status: [Pending v]  Intern: [Semua v]  Tanggal: [__ s/d __]           |
|                                                                        |
| Intern        Tanggal absensi  Diajukan pada   Status     Aksi         |
| Rina W.       9 Okt 2026       10 Okt 09:12    Pending    [Buka]       |
| Budi K.       8 Okt 2026       9 Okt 14:30     Disetujui  [Lihat]      |
| Dewi S.       2 Okt 2026       3 Okt 08:05     Ditolak    [Lihat]      |
+------------------------------------------------------------------------+
```

### 6.3 Layar detail dan keputusan

```
+--------------------------------------------------------------+
| Koreksi - Rina Wulandari, 9 Okt 2026            Status: Pending |
|                                                              |
| DATA TERCATAT          DATA DIAJUKAN INTERN                  |
| Clock in : 08:02       Clock in : 08:02                      |
| Clock out: -           Clock out: 17:00                      |
| Status   : Lupa Clock Out                                    |
|                                                              |
| Alasan intern: "Lupa clock out karena listrik padam."        |
|                                                              |
| [ Tanya intern lewat chat ]                                  |
|                                                              |
| KEPUTUSAN ADMIN                                              |
| Clock in final  [08:02]   Clock out final [17:00]            |
| Catatan verifikasi *                                         |
| [____________________________________________________]       |
|                                                              |
|                       [ Tolak ]        [ Setujui ]           |
+--------------------------------------------------------------+
```

### 6.4 Aturan

- Admin hanya mengubah **jam clock in dan clock out**. Status (Hadir, Lupa Clock Out, dan seterusnya) dihitung ulang otomatis oleh sistem sesuai aturan, bukan diketik admin. **[Usulan]**
- Catatan verifikasi wajib diisi baik saat Setujui maupun Tolak. **[Usulan]** Tujuannya agar jejak keputusan jelas.
- Data hasil koreksi diberi label kecil **"Dikoreksi admin"** di daftar absensi. Validasi lokasi tidak dijalankan ulang untuk koreksi. **[Usulan]**
- Batas waktu pengajuan koreksi tidak dibatasi sistem. Kebijakannya diserahkan ke perusahaan, yang penting fiturnya ada. **[Keputusan]**
- Setelah diproses, permintaan tidak bisa dibuka ulang. Jika masih salah, intern mengajukan permintaan baru. **[Usulan]**
- Bukti koreksi maksimal 2 MB per file. **[Keputusan]**

### 6.5 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Catatan verifikasi kosong | Tombol Setujui dan Tolak tidak aktif, pesan "Catatan verifikasi wajib diisi." |
| Jam clock out lebih awal dari clock in | Pesan "Jam clock out harus setelah jam clock in." |
| Dua admin membuka permintaan yang sama | Admin kedua yang menekan tombol mendapat pesan "Permintaan ini sudah diproses oleh [nama admin]." |

---

## 7. Alur 5 - Izin Pending

**Tujuan:** menutup pengajuan izin yang menggantung ketika mentor belum merespons.
**Pemicu:** izin Pending lebih dari 24 jam muncul di Dashboard.
**Halaman:** Izin.
**Prinsip:**
- Admin hanya memproses izin yang **masih Pending**. Izin yang sudah diproses mentor **tidak bisa diubah** admin. **[Keputusan]**
- Admin hanya boleh menyetujui bila ada **surat resmi atau bukti**. **[Keputusan]**

### 7.1 Langkah

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Klik **Buka** pada pengingat Dashboard atau membuka menu Izin | Daftar izin tampil, yang Pending lebih dari 24 jam diberi tanda |
| 2 | Membuka satu pengajuan | Detail dan lampiran tampil |
| 3 | Memeriksa lampiran (pratinjau atau unduh) | - |
| 4 | Mencentang "Saya sudah memeriksa bukti" | Tombol Setujui aktif |
| 5 | Mengisi catatan, lalu klik **Setujui** atau **Tolak** | Status berubah |
| 6 | - | Jika disetujui: status absensi pada hari izin berubah otomatis menjadi **Izin**. Intern dan mentor menerima notifikasi. Tindakan masuk log |

### 7.2 Layar daftar

```
+------------------------------------------------------------------------+
| Izin                                                                   |
| Tab: [Pending (3)] [Semua]       Jenis: [Semua v]  Intern: [Semua v]   |
|                                                                        |
| Intern    Mentor    Jenis   Tanggal           Hari kerja Bukti Status  |
| Andi P.   Bu Sari   Sakit   13-14 Okt         2          Ada   Pending |
|                                         ! pending 30 jam    [Buka]    |
| Dewi S.   Pak Budi  Urgent  13 Okt            1          Tidak Pending |
|                                         ! pending 26 jam    [Buka]    |
| Doni A.   Bu Sari   Sakit   5 Okt             1          Ada  Disetujui|
+------------------------------------------------------------------------+
```

Jenis izin hanya **Sakit** dan **Urgent**. **[Keputusan]** Jumlah hari kerja dihitung dari kalender kerja. **[Keputusan]**

### 7.3 Layar detail dan keputusan

```
+--------------------------------------------------------------+
| Izin - Andi Pratama                              Status: Pending |
| Mentor: Bu Sari        Jenis: Sakit                          |
| Tanggal: 13-14 Okt 2026 (2 hari kerja)                       |
| Alasan: "Demam, disarankan istirahat dokter."                |
|                                                              |
| Lampiran: surat_dokter.pdf     [Pratinjau] [Unduh]           |
|                                                              |
| [x] Saya sudah memeriksa surat resmi atau bukti              |
| Catatan *  [_______________________________________]         |
|                                                              |
|                       [ Tolak ]        [ Setujui ]           |
+--------------------------------------------------------------+
```

### 7.4 Aturan dan kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Pengajuan tanpa lampiran | Tombol **Setujui** nonaktif, tooltip "Tidak ada surat resmi atau bukti." Admin tetap dapat **Tolak** dengan catatan, atau menunggu mentor |
| Izin sudah diproses mentor | Layar hanya-baca: menampilkan keputusan, pemroses (mentor), dan catatan. Tidak ada tombol keputusan |
| Intern membatalkan saat admin membuka detail | Status menjadi **Dibatalkan**, tombol keputusan hilang, pesan "Pengajuan ini sudah dibatalkan intern." |
| Mentor memproses saat admin membuka detail | Pesan "Izin ini sudah diproses oleh mentor." dan layar menjadi hanya-baca |
| Setelah izin disetujui | Absensi pada hari kerja yang tercakup berubah menjadi Izin. Hari non-kerja tidak ikut dihitung |

Catatan wajib diisi untuk Setujui maupun Tolak. **[Usulan]**
Lampiran izin maksimal 2 MB per file. **[Keputusan]**

---

## 8. Alur 6 - Akhir Periode Magang

**Tujuan:** memastikan setiap intern diperpanjang atau dinonaktifkan secara sadar, tanpa terlewat.
**Pemicu:** intern masuk daftar "Magang berakhir dalam 7 hari" di Dashboard. **[Keputusan]**

### 8.1 Langkah

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Melihat daftar pengingat H-7 di Dashboard | Daftar menampilkan intern, tanggal selesai, dan mentornya |
| 2 | Klik **Tanya mentor** | Chat dengan mentor intern terbuka, berisi draf pesan yang bisa diedit |
| 3 | Menunggu jawaban mentor di chat | - |
| 4a | Jika **diperpanjang**: klik **Perpanjang**, isi tanggal selesai baru | Tanggal selesai berubah, intern keluar dari daftar pengingat |
| 4b | Jika **tidak diperpanjang**: tidak perlu tindakan | Pada tanggal berakhir akun otomatis **Nonaktif** |
| 5 | - | Perubahan masuk log |

### 8.2 Layar

Draf pesan pada **Tanya mentor** (bisa diubah):

```
Halo Bu Sari, masa magang Rina Wulandari berakhir 17 Okt 2026.
Apakah akan diperpanjang? Mohon konfirmasinya. Terima kasih.
```

Dialog perpanjang:

```
+--------------------------------------------------+
| Perpanjang Magang - Rina Wulandari               |
| Tanggal selesai saat ini : 17 Okt 2026           |
| Tanggal selesai baru *   [__/__/____]            |
|                                                  |
|                 [ Batal ]  [ Simpan ]            |
+--------------------------------------------------+
```

### 8.3 Aturan

- Tanggal baru harus setelah tanggal selesai saat ini.
- Akun tetap aktif sepanjang tanggal selesai. Status Nonaktif berlaku mulai **hari berikutnya** agar intern masih bisa clock in di hari terakhir. **[Usulan]**
- Setelah Nonaktif: intern tidak bisa login atau clock in, data tetap terlihat, dan mentor tetap bisa memeriksa Task yang sudah dikumpulkan. **[Keputusan]**
- Revise terhadap Task intern nonaktif tidak bisa ditindaklanjuti intern karena tidak bisa login. Hal ini sudah disepakati sebagai konsekuensi alur.
- Absensi hanya dihitung dalam periode magang. Hari sebelum mulai dan sesudah selesai tidak dihitung Tidak Hadir. **[Keputusan]**

---

## 9. Alur 7 - Kalender Libur dan Jam Kerja

**Tujuan:** mengatur aturan dasar yang dipakai sistem untuk menentukan status kehadiran.
**Halaman:** Pengaturan, dengan dua tab.

### 9.1 Tab Jam Kerja

```
+--------------------------------------------------+
| Pengaturan  [Jam Kerja] [Kalender Libur]         |
|                                                  |
| Jam kerja berlaku untuk semua intern.            |
| Jam masuk   [08:00]                              |
| Jam pulang  [17:00]                              |
| Berlaku mulai [__/__/____]                       |
|                                                  |
| Batas penetapan status otomatis: 23:59           |
|                                                  |
|                                    [ Simpan ]    |
+--------------------------------------------------+
```

- Jam kerja bersifat **global**. **[Keputusan]**
- Batas penetapan status 23:59 hanya ditampilkan sebagai informasi (tidak bisa diubah). **[Keputusan]**
- Jam pulang harus setelah jam masuk.
- Perubahan jam kerja berlaku mulai **tanggal efektif** yang dipilih admin dan **tidak mengubah** data absensi sebelumnya. **[Usulan, diikuti]**

### 9.2 Tab Kalender Libur

```
+------------------------------------------------------------------------+
| Pengaturan  [Jam Kerja] [Kalender Libur]                               |
|                                                                        |
|            < Oktober 2026 >                         [ + Tambah Libur ] |
|  Sen  Sel  Rab  Kam  Jum  Sab  Min                                     |
|                  1    2    3(a) 4(a)                                   |
|   5    6    7    8    9   10(a) 11(a)                                  |
|  12   13   14   15   16   17(a) 18(a)                                  |
|  ...                                                                   |
|  (a) = libur otomatis Sabtu dan Minggu (abu-abu)                       |
|  Libur tambahan admin diberi warna dan nama libur.                     |
|                                                                        |
| Daftar libur tambahan                                                  |
| 17 Agu 2026  Hari Kemerdekaan                       [Ubah] [Hapus]     |
+------------------------------------------------------------------------+
```

Aturan:
- Sabtu dan Minggu libur otomatis dan tidak perlu dimasukkan. **[Keputusan]**
- Admin menambah atau mengoreksi hari libur lain. **[Keputusan]**
- Menghapus libur berarti tanggal itu kembali menjadi hari kerja.

### 9.3 Langkah menambah libur

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Klik **Tambah Libur** | Dialog terbuka |
| 2 | Mengisi tanggal dan nama libur | - |
| 3 | Klik **Simpan** | Jika tanggal **belum lewat**: libur langsung tersimpan |
| 4 | Jika tanggal **sudah lewat**: sistem menampilkan dialog dampak | Dialog menjelaskan efeknya |
| 5 | Klik **Ya, hitung ulang** | Status absensi tanggal itu dihitung ulang otomatis (misalnya Tidak Hadir menjadi Libur) |
| 6 | - | Tindakan masuk log, termasuk jumlah absensi yang berubah |

```
+----------------------------------------------------------+
| Tanggal ini sudah lewat                                  |
| 3 Okt 2026 akan menjadi hari libur.                      |
| Status absensi 21 intern pada tanggal ini akan dihitung  |
| ulang (contoh: Tidak Hadir menjadi Libur).               |
|                                                          |
|              [ Batal ]  [ Ya, hitung ulang ]             |
+----------------------------------------------------------+
```

Penghitungan ulang otomatis untuk libur tanggal lampau sudah **[Keputusan]**.

---

## 9A. Alur 7B - Lokasi Kantor

**Tujuan:** menentukan di mana intern boleh clock in dan clock out.
**Halaman:** Lokasi Kantor (menu sendiri di sidebar).
**Aturan dasar:** **[Keputusan]** Admin membuat kantor dengan memilih titik di peta, memberi nama, lalu mengisi radius maksimal clock in dan radius maksimal clock out. Kedua radius boleh berbeda.

### 9A.1 Layar daftar

```
+------------------------------------------------------------------------+
| Lokasi Kantor                                    [ + Tambah Kantor ]   |
|                                                                        |
| Nama                     Radius clock in  Radius clock out  Status Aksi|
| Kantor Pusat Terminal 3  100 m            300 m             Aktif  [...]|
| Kantor Cabang Terminal 1 150 m            150 m             Nonaktif[...]|
+------------------------------------------------------------------------+
```

Menu aksi [...] per baris: Ubah, Nonaktifkan atau Aktifkan.
Kondisi kosong: "Belum ada kantor. Tambahkan kantor agar intern bisa clock in."

### 9A.2 Langkah menambah kantor

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Klik **Tambah Kantor** | Formulir dengan peta terbuka |
| 2 | Mencari alamat di kotak cari, atau menggeser peta | Peta berpindah ke lokasi yang dicari |
| 3 | Klik titik kantor di peta | Pin muncul. Pin bisa digeser untuk dirapikan |
| 4 | Mengisi nama kantor | - |
| 5 | Mengisi radius clock in dan radius clock out (meter) | Dua lingkaran tampil di peta sebagai pratinjau |
| 6 | Klik **Simpan** | Kantor tersimpan dan aktif. Tindakan masuk log |

### 9A.3 Layar formulir

```
+--------------------------------------------------------------+
| Tambah Kantor                                                |
|                                                              |
| Cari alamat [_______________________________] [Cari]         |
| +----------------------------------------------------------+ |
| |                                                          | |
| |              ( PETA )        o  <- pin kantor            | |
| |        lingkaran 1 = radius clock in                     | |
| |        lingkaran 2 = radius clock out                    | |
| +----------------------------------------------------------+ |
| Koordinat: -6.1256, 106.6559 (terisi otomatis dari pin)      |
|                                                              |
| Nama kantor *            [______________________________]    |
| Radius clock in (m) *    [ 100 ]                             |
| Radius clock out (m) *   [ 300 ]                             |
|                                                              |
|                              [ Batal ]  [ Simpan ]           |
+--------------------------------------------------------------+
```

Formulir **Ubah** memakai layar yang sama dengan data terisi.

### 9A.4 Validasi

| Kolom | Aturan | Pesan jika salah |
|---|---|---|
| Pin | Wajib dipasang di peta | "Pilih titik kantor di peta." |
| Nama | Wajib, belum dipakai kantor lain | "Nama kantor wajib diisi." |
| Radius clock in | Wajib, angka 10 sampai 1000 **[Usulan]** | "Isi radius antara 10 dan 1000 meter." |
| Radius clock out | Wajib, angka 10 sampai 1000 **[Usulan]** | "Isi radius antara 10 dan 1000 meter." |

### 9A.5 Aturan

- Clock in diterima bila posisi intern berada dalam **radius clock in** salah satu kantor aktif. Clock out memakai **radius clock out**. **[Keputusan]**
- Intern boleh memakai kantor aktif mana pun, tidak terikat satu kantor. **[Usulan, belum diputuskan]**
- Kantor tidak dihapus, hanya dinonaktifkan, agar riwayat absensi tetap menunjuk kantornya. **[Usulan]**
- Mengubah titik atau radius hanya berlaku untuk clock in dan clock out berikutnya. Absensi lama tidak berubah. **[Usulan]**
- Peta memakai **Leaflet dengan OpenStreetMap**, gratis dan tanpa API key. Pencarian alamat memakai Nominatim. **[Usulan]**

### 9A.6 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Belum ada kantor aktif | Banner di halaman ini dan di Dashboard: "Belum ada kantor aktif. Intern tidak bisa clock in." |
| Menonaktifkan kantor aktif terakhir | Dialog konfirmasi menjelaskan bahwa intern tidak bisa clock in sampai ada kantor aktif |
| Peta gagal dimuat | Pesan "Peta gagal dimuat." dan tombol **Coba lagi**. Kantor tidak bisa disimpan tanpa pin |
| Pencarian alamat tidak menemukan hasil | Pesan "Alamat tidak ditemukan. Geser peta dan pilih titik secara manual." |

**Dampak:** tambah, ubah, nonaktifkan, dan aktifkan kantor masuk Log Aktivitas. Tidak ada notifikasi ke intern atau mentor.

---

## 10. Alur 8 - Catatan Warning

**Tujuan:** admin mencatat peringatan untuk intern.
**Halaman:** Warning.
**Aturan:** catatan sederhana, **tanpa level dan tanpa aturan eskalasi**. **[Keputusan]** Hanya **admin** yang melihatnya, intern dan mentor tidak. **[Keputusan]**

### 10.1 Langkah

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Membuka menu Warning atau tab Warning di detail intern | Daftar intern atau riwayat catatan tampil |
| 2 | Memilih intern | Riwayat catatan tampil berurutan dari terbaru |
| 3 | Klik **Tambah Catatan** | Kotak isian terbuka |
| 4 | Menulis catatan, klik **Simpan** | Catatan tersimpan dengan tanggal dan nama admin otomatis |
| 5 | - | Tindakan masuk log. **Tidak ada notifikasi ke intern atau mentor** |

### 10.2 Layar

```
+--------------------------------------------------------------+
| Warning - Andi Pratama     (Hanya terlihat oleh admin)       |
|                                         [ + Tambah Catatan ] |
| 10 Okt 2026 - Admin Sinta                                    |
|   Terlambat clock in 3 kali dalam seminggu, sudah ditegur    |
|   lisan.                                                     |
| ------------------------------------------------------------ |
| 2 Okt 2026 - Admin Sinta                                     |
|   Tidak mengisi Daily Report dua hari berturut-turut.        |
+--------------------------------------------------------------+
```

Label "Hanya terlihat oleh admin" selalu tampil agar tidak salah paham.

Kondisi kosong: "Belum ada catatan untuk intern ini."
Admin yang membuat catatan boleh **mengubahnya dalam 24 jam**. Setelah itu catatan terkunci dan tidak bisa dihapus. Setiap perubahan masuk Log Aktivitas. **[Usulan, diikuti]**

---

## 11. Alur 9 - Pengumuman

**Tujuan:** menyampaikan informasi umum ke role tertentu.
**Halaman:** Pengumuman.
**Aturan:** admin memilih role penerima. **[Keputusan]** Pengumuman tampil di bell icon penerima. **[Keputusan]**

### 11.1 Langkah

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Klik **Buat Pengumuman** | Formulir terbuka |
| 2 | Mengisi judul dan isi | - |
| 3 | Memilih penerima: Intern, Mentor, atau keduanya | - |
| 4 | Klik **Kirim** | Pengumuman tersimpan dan muncul di bell icon penerima |
| 5 | Dapat **Ubah** atau **Hapus** nanti | Perubahan tampil ke penerima, hapus meminta konfirmasi |

### 11.2 Layar

```
+--------------------------------------------------------------+
| Pengumuman                              [ + Buat Pengumuman ]|
|                                                              |
| Judul                     Penerima          Tanggal   Aksi   |
| Libur 17 Agustus          Intern, Mentor    10 Okt  [Ubah][Hapus]
| Batas laporan akhir       Intern            5 Okt   [Ubah][Hapus]
+--------------------------------------------------------------+

+--------------------------------------------------------------+
| Buat Pengumuman                                              |
| Judul *     [_______________________________________]       |
| Isi *       [_______________________________________]       |
|             [_______________________________________]       |
| Penerima *  [x] Intern   [ ] Mentor                          |
|                                                              |
|                     [ Batal ]  [ Kirim ]                     |
+--------------------------------------------------------------+
```

Validasi: judul dan isi wajib, minimal satu penerima dipilih (pesan "Pilih minimal satu penerima.").

---

## 12. Alur 10 - Export Laporan PDF

**Tujuan:** menghasilkan laporan resmi untuk perusahaan atau kampus.
**Halaman:** Laporan.
**Aturan:** format **PDF saja**, dan hanya admin yang bisa export (mentor tidak). **[Keputusan]**

### 12.1 Langkah

| No | Langkah Admin | Respons sistem |
|---|---|---|
| 1 | Memilih jenis laporan | Filter yang relevan tampil |
| 2 | Mengisi periode dan filter | - |
| 3 | Klik **Buat PDF** | Sistem menyusun laporan |
| 4 | - | PDF terunduh. Jika tidak ada data, pesan "Tidak ada data pada periode ini." |
| 5 | - | Export masuk log (jenis laporan, periode, admin) |

### 12.2 Layar

```
+--------------------------------------------------------------+
| Laporan (Export PDF)                                         |
|                                                              |
| Jenis laporan *   ( ) Rekap Absensi                          |
|                   ( ) Rekap Izin                             |
|                   ( ) Rekap Task                             |
| Periode *         [__/__/____] s/d [__/__/____]              |
| Intern            [Semua v]                                  |
| Mentor            [Semua v]                                  |
|                                                              |
|                                  [ Buat PDF ]                |
+--------------------------------------------------------------+
```

### 12.3 Isi tiap laporan (usulan kolom)

| Laporan | Kolom utama |
|---|---|
| Rekap Absensi | Intern, jumlah Hadir, Izin, Tidak Hadir, Lupa Clock Out, total hari kerja |
| Rekap Izin | Intern, jenis, tanggal, hari kerja, status, pemroses, catatan |
| Rekap Task | Intern, mentor, judul Task, status (To Do, In Progress, In Review, Done), tanda Terlambat |

Kolom di atas **[Usulan]**, tim boleh menyesuaikan.

---

## 13. Alur 11 - Log Aktivitas, Chat, Profil

### 13.1 Log Aktivitas

**Tujuan:** menjaga akuntabilitas, karena admin bisa mengubah data milik intern dan mentor. **[Keputusan]**
**Sifat:** hanya-baca, tidak bisa diedit atau dihapus oleh siapa pun.

```
+------------------------------------------------------------------------+
| Log Aktivitas                                                          |
| Tanggal: [__ s/d __]  Admin: [Semua v]  Jenis aksi: [Semua v]          |
|                                                                        |
| Waktu            Admin   Aksi                 Objek        Detail      |
| 10 Okt 13:02     Sinta   Setujui koreksi      Rina W.      9 Okt 17:00 |
| 10 Okt 10:15     Sinta   Tambah libur         3 Okt        21 absensi  |
|                                                            dihitung ulang|
| 9 Okt 16:40      Dedi    Reset password       Andi P.      -           |
+------------------------------------------------------------------------+
```

Jenis aksi yang dicatat:

| Kelompok | Contoh aksi |
|---|---|
| Akun | Tambah, ubah, nonaktifkan, aktifkan, reset password, ganti mentor, perpanjang magang |
| Absensi | Setujui koreksi, tolak koreksi |
| Izin | Setujui izin pending, tolak izin pending |
| Kalender dan jam kerja | Tambah, ubah, hapus libur, ubah jam kerja, penghitungan ulang absensi |
| Lokasi kantor | Tambah, ubah titik atau radius, nonaktifkan, aktifkan |
| Warning | Tambah catatan |
| Pengumuman | Buat, ubah, hapus |
| Laporan | Export PDF |

Karena semua admin berhak sama, kolom **Admin** menunjukkan siapa yang melakukan tiap tindakan.

### 13.2 Chat

- Admin bisa chat dengan semua pengguna. **[Keputusan]**
- Admin **tidak bisa membaca chat orang lain**. **[Keputusan]** Daftar chat hanya menampilkan percakapan milik admin sendiri.
- Ada notifikasi untuk pesan baru. **[Keputusan]**
- Dipakai juga untuk klarifikasi koreksi (Alur 4) dan menanyakan perpanjangan ke mentor (Alur 6).

### 13.3 Profil

- Admin dapat mengedit profil sendiri (nama, foto, kontak). **[Keputusan]**
- Tidak ada ganti password mandiri. Password hanya diganti saat login pertama dan lewat reset oleh admin lain. **[Usulan, diikuti]**

---

## 14. Notifikasi Admin (Bell Icon)

Tidak ada halaman notifikasi terpisah, cukup bell icon di navbar. **[Keputusan]** Klik item membawa langsung ke layar terkait.

| Kejadian | Isi notifikasi | Tujuan klik |
|---|---|---|
| Intern mengajukan koreksi absensi | "Rina W. mengajukan koreksi absensi 9 Okt." | Detail koreksi |
| Izin pending lebih dari 24 jam | "Izin Andi P. belum diproses mentor lebih dari 24 jam." | Detail izin |
| Magang segera berakhir (H-7) | "Magang Rina W. berakhir dalam 7 hari." | Dashboard, kotak akhir magang |
| Pesan chat baru | "Pesan baru dari Bu Sari." | Chat |

Admin **tidak** menerima notifikasi setiap izin baru, karena izin diproses mentor lebih dulu. Admin baru masuk bila izin terlambat diproses. **[Usulan berdasar alur]**
Deteksi anomali tidak dibuat. **[Keputusan]**

---

## 15. Aturan Tampilan

### 15.1 Status dan warna

Warna tidak boleh menjadi satu-satunya penanda. Selalu sertakan teks pada badge.

| Status | Dipakai untuk | Warna (usulan) |
|---|---|---|
| Hadir | Absensi | Hijau (#2E7D32) |
| Izin | Absensi | Biru (#1565C0) |
| Tidak Hadir | Absensi | Merah (#C62828) |
| Lupa Clock Out | Absensi | Oranye (#EF6C00) |
| Libur | Absensi | Abu-abu (#757575) |
| Dikoreksi admin | Label kecil pada absensi | Abu-abu gelap |
| Pending | Izin, koreksi | Kuning (#F9A825) |
| Disetujui | Izin, koreksi | Hijau |
| Ditolak | Izin, koreksi | Merah |
| Dibatalkan | Izin | Abu-abu |
| Aktif | Akun, kantor | Hijau |
| Nonaktif | Akun, kantor | Abu-abu |

### 15.2 Format

- Tanggal: "Sen, 12 Okt 2026". Waktu: 24 jam, misalnya 17:00. Zona waktu mengikuti perusahaan.
- Lama pending izin ditulis dalam jam, misalnya "30 jam".
- Radius ditulis dalam meter, misalnya "100 m".
- Tombol utama (Simpan, Setujui, Kirim) di kanan bawah. Tombol batal di sebelah kirinya.

### 15.3 Kondisi layar

| Kondisi | Tampilan |
|---|---|
| Memuat | Kerangka abu-abu atau indikator loading |
| Kosong | Teks penjelas singkat, misalnya "Belum ada permintaan koreksi." |
| Gagal | "Terjadi kesalahan. Coba lagi." dengan tombol **Coba lagi** |
| Tidak punya akses | "Anda tidak memiliki akses ke halaman ini." |

### 15.4 Dialog konfirmasi

Dipakai untuk tindakan yang berdampak: nonaktifkan akun, ganti mentor, reset password, tambah libur tanggal lampau, hapus pengumuman, nonaktifkan kantor. Isinya selalu menjelaskan **dampaknya** dalam kalimat biasa, dan tombol konfirmasi memakai kata kerja jelas (contoh: "Nonaktifkan", bukan "OK").

### 15.5 Pesan sistem penting

| Situasi | Pesan |
|---|---|
| Berhasil disimpan | "Perubahan tersimpan." |
| Password sementara dibuat | "Password sementara hanya tampil sekali. Salin sebelum menutup." |
| Akses ke data yang sudah diproses pihak lain | "Data ini sudah diproses oleh [nama]." |
| Izin tanpa bukti | "Tidak ada surat resmi atau bukti." |
| Akun terakhir admin | "Minimal harus ada satu admin aktif." |
| Belum ada kantor aktif | "Belum ada kantor aktif. Intern tidak bisa clock in." |

---

## 16. Hak Akses Admin

| Area | Admin bisa | Admin tidak bisa |
|---|---|---|
| Akun | Buat, ubah, nonaktifkan, aktifkan, reset password, ganti mentor, atur periode magang | Menghapus akun |
| Absensi | Melihat semua, memproses koreksi | Mengubah status langsung tanpa permintaan koreksi, memulai koreksi di luar alur |
| Izin | Memproses yang Pending dengan bukti | Mengubah izin yang sudah diproses mentor |
| Warning | Membuat dan melihat | - (hanya admin yang melihat) |
| Pengumuman | Buat, ubah, hapus, pilih role penerima | - |
| Kalender dan jam kerja | Mengatur libur dan jam kerja | Mengubah batas 23:59 |
| Lokasi kantor | Menambah, mengubah, menonaktifkan, mengaktifkan kantor dan radiusnya | Menghapus kantor |
| Laporan | Export PDF | Export format lain |
| Chat | Chat dengan semua orang | Membaca chat orang lain |
| Task | Ikut dalam export Task | Membuat atau menilai Task (hak mentor) |
| Performa | - | Dashboard performa seluruh intern |
| Log | Melihat | Mengubah atau menghapus log |

---

## 17. Keputusan Tambahan dan Hal yang Masih Terbuka

### 17.1 Keputusan tambahan

Per 10 Oktober 2026, hal berikut dianggap disepakati. Nomor 1 sampai 10 mengikuti usulan, nomor 11 sampai 13 adalah keputusan baru.

| No | Topik | Keputusan |
|---|---|---|
| 1 | Login | Email internal, akun dibuat admin, tanpa Google OAuth |
| 2 | Ganti password | Tidak ada ganti password mandiri. Hanya saat login pertama dan reset oleh admin |
| 3 | Perubahan jam kerja | Berlaku mulai tanggal efektif yang dipilih admin, tidak mengubah data lama |
| 4 | Edit catatan warning | Pembuat boleh mengubah dalam 24 jam, setelah itu terkunci |
| 5 | Role akun | Tidak bisa diubah setelah akun dibuat. Jika perlu, buat akun baru |
| 6 | Menonaktifkan mentor | Diblokir bila masih punya intern aktif. Admin memindahkan intern lebih dulu |
| 7 | Catatan verifikasi | Wajib pada keputusan koreksi absensi dan izin (setujui maupun tolak) |
| 8 | Akun admin | Admin tidak bisa menonaktifkan akunnya sendiri, dan minimal satu admin aktif |
| 9 | Nonaktif otomatis | Berlaku mulai hari setelah tanggal selesai magang |
| 10 | Koreksi absensi | Admin hanya mengubah jam clock in dan clock out. Status dihitung ulang otomatis |
| 11 | Lokasi kantor | Admin membuat kantor lewat peta, dengan nama, radius clock in, dan radius clock out yang boleh berbeda |
| 12 | Batas ukuran file | Maksimal 2 MB, berlaku untuk lampiran izin, bukti koreksi, dan hasil Task |
| 13 | Validasi lokasi | Berlaku saat clock in dan clock out, memakai radius kantor aktif |

### 17.2 Hal yang masih terbuka

| No | Topik | Keterangan |
|---|---|---|
| 1 | Jenis file lampiran | Usulan awal: PDF, JPG, PNG |
| 2 | Intern dan kantor | Intern terikat satu kantor, atau boleh memakai kantor aktif mana pun (usulan: mana pun) |
| 3 | Batas radius | Usulan 10 sampai 1000 meter, belum diputuskan |
# design-intern.md - Desain Role Intern (Lengkap, Berdasarkan Alur)

Sistem: Web Intern Management dan Attendance System
Versi: Draft 2 | Tanggal: 10 Oktober 2026 | Acuan: PRD tanggal 7 Oktober 2026, design-admin.md (Draft 2), dan design-mentor.md
Perubahan Draft 2: validasi lokasi saat clock in dan clock out memakai radius kantor aktif (menu Lokasi Kantor di sisi admin), batas file 2 MB.

Tanda yang dipakai di dokumen ini:
- **[Keputusan]** = sudah disepakati di PRD atau di percakapan.
- **[Usulan]** = pilihan desain dari saya. Per 10 Oktober 2026 semua usulan di dokumen ini **diikuti**, kecuali hal yang tercantum di Bagian 20.

---

## 1. Cara Membaca Dokumen Ini

Dokumen disusun menurut **alur kerja Intern**, bukan menurut daftar menu. Tiap alur berisi: tujuan, langkah demi langkah, sketsa layar, kondisi khusus, dan dampaknya (status dan notifikasi). Cara penulisannya sama dengan `design-admin.md` dan `design-mentor.md`.

Isi:
1. Cara membaca
2. Gambaran Intern dan navigasi
3. Alur 1 - Login pertama dan profil
4. Alur 2 - Dashboard
5. Alur 3 - Clock in
6. Alur 4 - Daily Report
7. Alur 5 - Clock out
8. Alur 6 - Riwayat absensi dan rekap bulanan
9. Alur 7 - Koreksi absensi
10. Alur 8 - Task (daftar, Kanban, detail)
11. Alur 9 - Mengumpulkan hasil dan menindaklanjuti revisi
12. Alur 10 - Komentar Task
13. Alur 11 - Izin
14. Alur 12 - Chat dan notifikasi
15. Situasi khusus
16. Notifikasi Intern (bell icon)
17. Aturan tampilan (status, warna, pesan)
18. Hak akses Intern (bisa dan tidak bisa)
19. Keputusan tambahan (mengikuti usulan)
20. Hal yang masih terbuka (menyentuh backend)

---

## 2. Gambaran Intern dan Navigasi

**Peran:** Intern melakukan clock in dan clock out, mengisi Daily Report, mengerjakan Task dari mentor, serta mengajukan izin dan koreksi absensi. **[Keputusan]**

**Relasi:** satu intern memiliki tepat satu mentor. **[Keputusan]** Intern hanya melihat data miliknya sendiri.

**Platform:** web, dengan layar desktop dan layar kecil. Clock in dan clock out sering dilakukan dari ponsel, jadi halaman Absensi harus nyaman di layar kecil. Di layar kecil sidebar menjadi menu bawah, dan Kanban menjadi satu kolom per layar. **[Usulan]**

### 2.1 Kerangka halaman

```
+------------------------------------------------------------------------+
| [Logo]  Nama Sistem                         [Chat] [Bell 2] [Intern v] |
+--------------+---------------------------------------------------------+
| Dashboard    |                                                         |
| Absensi      |                                                         |
| Task         |                AREA KONTEN HALAMAN                      |
| Izin         |                                                         |
+--------------+---------------------------------------------------------+
```

### 2.2 Menu sidebar

| Menu | Isi | Alamat halaman (usulan) |
|---|---|---|
| Dashboard | Status hari ini, rekap bulanan, ringkasan Task | /intern/dashboard |
| Absensi | Tab Hari Ini (clock in, Daily Report, clock out), Riwayat, Koreksi | /intern/attendance |
| Task | Kanban dan daftar Task, detail, pengumpulan hasil, komentar | /intern/tasks |
| Izin | Ajukan izin, riwayat izin, batalkan izin Pending | /intern/leaves |

Chat dan notifikasi (bell icon) ada di navbar atas, bukan di sidebar. **[Keputusan]** Tidak ada halaman notifikasi terpisah.

Menu yang **tidak ada** untuk Intern: Laporan atau Export, Pengaturan, Warning, Log Aktivitas, Pengumuman (intern hanya menerima), dan Performa. Intern tidak melihat catatan warning. **[Keputusan]**

---

## 3. Alur 1 - Login Pertama dan Profil

**Tujuan:** intern masuk ke sistem untuk pertama kali dengan aman.
**Latar:** akun intern dibuat oleh admin dengan **email internal**, beserta password sementara. Tidak ada login Google OAuth. **[Keputusan]** Semua pembuatan akun bergantung pada admin. **[Keputusan]**

### 3.1 Langkah

| No | Langkah Intern | Respons sistem | Layar |
|---|---|---|---|
| 1 | Menerima email internal dan password sementara dari admin | - | - |
| 2 | Login | Sistem meminta ganti password | Login, lalu Ganti Password |
| 3 | Mengisi password baru dan konfirmasinya | Password tersimpan, masuk ke Dashboard | Ganti Password |
| 4 | (Opsional) membuka menu profil di navbar dan melengkapi nama, foto, kontak | Profil tersimpan | Profil |

Layar Ganti Password sama dengan yang dipakai Admin (lihat `design-admin.md`, Alur 1). Halaman lain tidak bisa dibuka sebelum password diganti. **[Keputusan]**

### 3.2 Layar Login

```
+----------------------------------------------+
|  Masuk                                       |
|                                              |
|  Email internal  [____________________]      |
|  Password        [____________________] (mata)|
|                                              |
|                          [ Masuk ]           |
|                                              |
|  Lupa password? Hubungi admin.               |
+----------------------------------------------+
```

| Situasi | Pesan |
|---|---|
| Email atau password salah | "Email atau password salah." |
| Akun nonaktif (magang sudah selesai) | "Akun Anda tidak aktif. Hubungi admin." **[Usulan]** |
| Masa magang belum dimulai | "Masa magang Anda belum dimulai." **[Usulan]** |

### 3.3 Lupa password dan profil

- Intern tidak memulihkan password sendiri. Ia menghubungi admin, admin menekan reset, lalu menyampaikan password sementara baru. **[Keputusan]**
- Tidak ada ganti password mandiri. Password hanya diganti saat login pertama dan lewat reset oleh admin. **[Usulan, diikuti]**
- Intern dapat mengedit profil sendiri (nama, foto, kontak). **[Keputusan]** Email internal, mentor, dan periode magang hanya bisa diubah admin.

---

## 4. Alur 2 - Dashboard

**Tujuan:** intern melihat status hari ini dan apa yang perlu dikerjakan dalam satu layar.
**Halaman:** Dashboard.
**Keputusan:** rekap kehadiran bulanan tampil di dashboard. **[Keputusan]**

### 4.1 Layout

```
+------------------------------------------------------------------------+
| Dashboard                                      Senin, 12 Okt 2026      |
|                                                                        |
| ! Daily Report hari ini belum dikirim.              [Isi Daily Report] |
|                                                                        |
| +-----------------------------+  +-----------------------------------+ |
| | HARI INI                    |  | REKAP BULAN INI (Oktober 2026)    | |
| | Status: Sudah Clock In      |  | Hadir 8       | Izin 1            | |
| | Clock in: 08:02             |  | Tidak Hadir 0 | Lupa Clock Out 1  | |
| |        [ CLOCK OUT ]        |  | Hari kerja berjalan: 10           | |
| +-----------------------------+  +-----------------------------------+ |
|                                                                        |
| TASK AKTIF                                                             |
| To Do 2  |  In Progress 3  |  In Review 1                              |
| Tenggat terdekat: Desain ERD - 14 Okt 17:00            [Lihat Task]    |
| 1 Task [Terlambat]                                                     |
|                                                                        |
| Periode magang: 1 Sep - 31 Des 2026         Mentor: Bu Sari            |
+------------------------------------------------------------------------+
```

### 4.2 Penjelasan tiap bagian

| Bagian | Isi | Aturan |
|---|---|---|
| Banner Daily Report | Muncul jika sudah clock in tetapi Daily Report hari ini belum terkirim | Daily Report wajib sebelum clock out. **[Keputusan]** Banner hilang setelah laporan terkirim |
| Kartu Hari Ini | Status hari ini dan tombol aksi | Tombol berubah sesuai kondisi: **Clock In**, **Clock Out**, atau tanpa tombol (lihat tabel 4.3) |
| Rekap bulan ini | Jumlah Hadir, Izin, Tidak Hadir, Lupa Clock Out, hari kerja berjalan | **[Keputusan]** Memakai status final yang sudah ditetapkan sistem. Hari berjalan belum dihitung sampai lewat 23:59 |
| Task aktif | Jumlah Task per status dan tenggat terdekat | Task Terlambat ditandai merah dan dihitung terpisah. Klik membuka halaman Task |
| Periode magang dan mentor | Informasi saja | **[Usulan]** |

### 4.3 Kondisi kartu Hari Ini

| Kondisi | Tampilan kartu |
|---|---|
| Hari kerja, belum clock in | "Belum Clock In" dan tombol **Clock In** |
| Sudah clock in, belum clock out | "Sudah Clock In" dan tombol **Clock Out** |
| Sudah clock out | "Hadir, clock out 17:03". Tanpa tombol |
| Hari Sabtu, Minggu, atau libur | "Hari ini libur: [nama libur]". Tanpa tombol. **[Keputusan]** soal hari non-kerja |
| Izin hari ini sudah disetujui | "Izin hari ini (Sakit)". Tanpa tombol. **[Keputusan]** soal status otomatis Izin |
| Di luar periode magang | "Di luar periode magang." Tanpa tombol |

### 4.4 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Belum ada Task | "Belum ada Task dari mentor." |
| Data gagal dimuat | "Data gagal dimuat." dan tombol **Coba lagi** |

---

## 5. Alur 3 - Clock In

**Tujuan:** mencatat kehadiran hari ini.
**Halaman:** Absensi, tab **Hari Ini** (atau tombol di Dashboard).
**Aturan:**
- Sistem memvalidasi lokasi saat clock in. Clock in diterima bila posisi intern berada dalam **radius clock in** salah satu **kantor aktif**. **[Keputusan]**
- Kantor dan radiusnya dibuat admin di menu Lokasi Kantor (lihat `design-admin.md`, Bagian 9A). **[Keputusan]**
- Intern boleh clock in di kantor aktif mana pun, tidak terikat satu kantor. **[Usulan, belum diputuskan]**

### 5.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Membuka Absensi atau Dashboard | Kartu Hari Ini tampil dengan tombol **Clock In** |
| 2 | Menekan **Clock In** | Sistem meminta lokasi dari browser dan membandingkannya dengan radius clock in kantor aktif |
| 3 | - | Jika berada dalam radius: clock in tercatat, tampil jam clock in |
| 4 | - | Tampilan berubah menjadi "Sudah Clock In". Muncul pengingat untuk mengisi Daily Report |

### 5.2 Layar

```
+--------------------------------------------------------------+
| Absensi   [Hari Ini] [Riwayat] [Koreksi]                     |
|                                                              |
| Senin, 12 Okt 2026               Jam kerja: 08:00 - 17:00    |
|                                                              |
|                       08:02:15                               |
|                Status: Belum Clock In                        |
|                                                              |
|                  [    CLOCK IN    ]                          |
|       Lokasi Anda akan diperiksa saat tombol ditekan.        |
+--------------------------------------------------------------+
```

### 5.3 Pesan validasi lokasi

| Situasi | Pesan |
|---|---|
| Sedang memeriksa | "Memeriksa lokasi..." |
| Lokasi sesuai | "Clock in berhasil pukul 08:02." |
| Di luar radius clock in semua kantor aktif | "Lokasi Anda belum sesuai. Clock in belum bisa dilakukan." dan tombol **Coba lagi** |
| Belum ada kantor aktif | "Belum ada kantor aktif. Clock in belum bisa dilakukan. Hubungi admin." Tombol Clock In tidak aktif |
| Akses lokasi ditolak di browser | "Izinkan akses lokasi di browser untuk melakukan clock in." |
| Gagal mengambil lokasi | "Lokasi tidak dapat dibaca. Coba lagi." |

Batas jarak memakai radius tiap kantor yang diatur admin. Penanganan kasus khusus (GPS kurang akurat, VPN) ditentukan tim teknis, lihat Bagian 20.

### 5.4 Aturan

- Clock in hanya pada **hari kerja** dalam **periode magang**. **[Keputusan]**
- Satu hari hanya satu kali clock in. Setelah berhasil, tombol Clock In hilang. **[Usulan]**
- Clock in tidak dibatasi jam tertentu. Jam clock in tersimpan apa adanya dan dapat dilihat mentor dan admin. Sistem **tidak** memberi status "terlambat" pada absensi, karena status kehadiran hanya Hadir, Izin, Tidak Hadir, dan Lupa Clock Out. **[Usulan berdasar daftar status di PRD]**
- Batas penetapan status otomatis adalah 23:59. Tanpa clock in sampai 23:59, status hari itu menjadi **Tidak Hadir**. **[Keputusan]**

### 5.5 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Hari libur atau akhir pekan | Tombol tidak tersedia. "Hari ini libur." |
| Izin hari ini sudah disetujui | Tombol tidak tersedia. "Anda sedang izin hari ini." |
| Izin hari ini masih Pending | Clock in tetap bisa. Setelah clock in, hari itu dikeluarkan dari izin saat diproses dan tetap berstatus Hadir. **[Usulan]** |
| Koneksi terputus saat menekan tombol | "Clock in belum tercatat. Periksa koneksi lalu coba lagi." Sistem tidak mencatat clock in sebelum ada konfirmasi dari server |
| Admin menambah libur pada hari ini | Tombol hilang saat halaman dimuat ulang |
| Admin mengubah titik atau radius kantor | Berlaku untuk clock in dan clock out berikutnya. Absensi yang sudah tercatat tidak berubah |

---

## 6. Alur 4 - Daily Report

**Tujuan:** melaporkan apa yang dikerjakan hari itu.
**Halaman:** Absensi, tab **Hari Ini**, di bawah kartu clock in.
**Aturan:**
- Daily Report adalah laporan intern tentang apa yang dikerjakan hari itu. Ini **berbeda dari Task**. **[Keputusan]**
- Wajib dikirim **sebelum clock out**. **[Keputusan]**
- Dapat diedit **sampai clock out**. **[Keputusan]**
- Tidak ada syarat bahwa pekerjaan harian harus selesai untuk clock out. **[Keputusan]**

### 6.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Setelah clock in, membuka bagian Daily Report (atau menekan tombol di banner Dashboard) | Formulir tampil |
| 2 | Menulis apa yang dikerjakan hari ini | - |
| 3 | Klik **Simpan Laporan** | Laporan tersimpan, status menjadi **Terkirim** |
| 4 | (Jika perlu) klik **Ubah** dan simpan ulang | Laporan diperbarui |
| 5 | Clock out | Laporan terkunci dan tidak bisa diubah lagi |

### 6.2 Layar

```
+--------------------------------------------------------------+
| Daily Report - Senin, 12 Okt 2026         Status: Belum dikirim |
|                                                              |
| Yang saya kerjakan hari ini *                                |
| [__________________________________________________]        |
| [__________________________________________________]        |
|                                                              |
| Kendala atau catatan (opsional)                              |
| [__________________________________________________]        |
|                                                              |
| Dapat diubah sampai Anda clock out.                          |
|                                         [ Simpan Laporan ]   |
+--------------------------------------------------------------+
```

Dua kolom isian (pekerjaan dan kendala) adalah **[Usulan]**. Mentor dan admin hanya dapat membaca. **[Keputusan]** Mentor hanya melihat laporan, tidak menulis komentar pada Daily Report. **[Usulan]**

### 6.3 Validasi

| Kolom | Aturan | Pesan jika salah |
|---|---|---|
| Yang saya kerjakan | Wajib, tidak boleh kosong atau hanya spasi | "Isi apa yang Anda kerjakan hari ini." |

### 6.4 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Belum clock in | Formulir tidak tersedia. "Clock in dulu untuk mengisi Daily Report." |
| Sudah clock out | Hanya baca. Tombol Ubah hilang |
| Lupa clock out hingga 23:59 | Status hari itu **Lupa Clock Out** dan laporan terkunci. Jika perlu, ajukan koreksi (Alur 7) |
| Hari Izin atau libur | Tidak ada Daily Report |
| Koneksi terputus saat menyimpan | "Laporan belum tersimpan. Isian Anda tidak hilang, coba simpan lagi." Isian tetap di layar |

---

## 7. Alur 5 - Clock Out

**Tujuan:** menutup hari kerja dan mencatat jam pulang.
**Pemicu:** intern menekan **Clock Out**.

### 7.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Menekan **Clock Out** | Sistem memeriksa apakah Daily Report hari ini sudah terkirim |
| 2a | Jika **belum** terkirim | Dialog: "Daily Report belum dikirim. Isi dulu sebelum clock out." dengan tombol **Isi Daily Report** |
| 2b | Jika sudah terkirim dan sebelum jam pulang | Dialog konfirmasi: "Belum jam pulang (17:00). Tetap clock out?" |
| 2c | Jika sudah terkirim dan sudah jam pulang | Lanjut ke pemeriksaan lokasi (langkah 3) |
| 3 | Setelah langkah 2b dikonfirmasi atau langkah 2c | Sistem memeriksa lokasi terhadap **radius clock out** kantor aktif. Jika di dalam radius, clock out tercatat |
| 4 | - | Tampil ringkasan: clock in, clock out, status **Hadir**. Daily Report terkunci |

### 7.2 Layar dialog

```
+--------------------------------------------------+
| Daily Report belum dikirim                       |
| Isi Daily Report dulu sebelum clock out.         |
|                                                  |
|            [ Nanti ]  [ Isi Daily Report ]       |
+--------------------------------------------------+
```

Pesan validasi lokasi saat clock out sama dengan 5.3, dengan kata "clock out":

| Situasi | Pesan |
|---|---|
| Sedang memeriksa | "Memeriksa lokasi..." |
| Di luar radius clock out semua kantor aktif | "Lokasi Anda belum sesuai. Clock out belum bisa dilakukan." dan tombol **Coba lagi** |
| Akses lokasi ditolak di browser | "Izinkan akses lokasi di browser untuk melakukan clock out." |
| Gagal mengambil lokasi | "Lokasi tidak dapat dibaca. Coba lagi." |
| Belum ada kantor aktif | "Belum ada kantor aktif. Clock out belum bisa dilakukan. Hubungi admin." |

### 7.3 Aturan

- Selain lokasi, clock out **hanya** mensyaratkan Daily Report terkirim. Tidak ada syarat menyelesaikan Task atau pekerjaan harian. **[Keputusan]**
- Clock out sebelum jam pulang diperbolehkan setelah konfirmasi. **[Usulan]**
- Lokasi divalidasi juga saat clock out, memakai **radius clock out** kantor aktif. Radius clock out boleh berbeda dari radius clock in. **[Keputusan]**
- Jika tidak bisa clock out karena lokasi sampai 23:59, status hari itu menjadi **Lupa Clock Out**. Perbaikan lewat koreksi absensi (Alur 7).
- Jika sampai 23:59 ada clock in tanpa clock out, status hari itu menjadi **Lupa Clock Out**. **[Keputusan]**
- Setelah clock out, tidak ada clock in kedua pada hari yang sama. **[Usulan]**

---

## 8. Alur 6 - Riwayat Absensi dan Rekap Bulanan

**Tujuan:** intern melihat catatan kehadirannya sendiri.
**Halaman:** Absensi, tab **Riwayat**.

### 8.1 Layar

```
+------------------------------------------------------------------------+
| Absensi   [Hari Ini] [Riwayat] [Koreksi]                               |
| Bulan: [< Oktober 2026 >]                                              |
|                                                                        |
| Hadir 8 | Izin 1 | Tidak Hadir 0 | Lupa Clock Out 1 | Hari kerja 10    |
|                                                                        |
| Tanggal      Clock In  Clock Out  Status          Daily Report  Aksi   |
| Jum, 9 Okt   08:02     17:00      Hadir           Terkirim     [Koreksi]|
|                                                    Dikoreksi admin     |
| Kam, 8 Okt   08:10     17:05      Hadir           Terkirim     [Koreksi]|
| Rab, 7 Okt   -         -          Izin            -                     |
| Sel, 6 Okt   08:00     -          Lupa Clock Out  Terkirim     [Koreksi]|
| Sen, 5 Okt   -         -          Tidak Hadir     -            [Koreksi]|
| Sab, 3 Okt   Libur                                                     |
+------------------------------------------------------------------------+
```

### 8.2 Aturan

- Status ditentukan otomatis oleh sistem dengan batas 23:59. **[Keputusan]**
- Baris yang sudah dikoreksi admin diberi label "Dikoreksi admin". **[Usulan, sama dengan sisi mentor dan admin]**
- Tombol **Koreksi** muncul pada baris hari kerja yang sudah lewat. Klik membuka formulir koreksi dengan tanggal terisi (Alur 7). **[Usulan]**
- Klik baris membuka detail hari itu: jam clock in dan clock out, status, dan Daily Report (hanya baca).
- Sabtu, Minggu, dan hari libur ditampilkan sebagai Libur dan tidak dihitung hari kerja. **[Keputusan]**
- Intern hanya melihat data miliknya sendiri.

### 8.3 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Belum ada data pada bulan itu | "Belum ada data absensi pada bulan ini." |
| Bulan di luar periode magang | Bulan tidak dapat dipilih |

---

## 9. Alur 7 - Koreksi Absensi

**Tujuan:** meminta perbaikan data absensi yang salah, misalnya lupa clock out.
**Halaman:** Absensi, tab **Koreksi**.
**Aturan:** permintaan koreksi diajukan ke **admin**. Admin menanyakan dan memverifikasi dulu sebelum menyetujui. **[Keputusan]** Mentor tidak terlibat. **[Keputusan]** Pengajuan wajib lewat web. **[Keputusan]**

### 9.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Klik **Koreksi** pada baris riwayat, atau **Ajukan Koreksi** di tab Koreksi | Formulir terbuka |
| 2 | Mengisi tanggal, jam yang benar, dan alasan | - |
| 3 | Klik **Kirim** | Permintaan berstatus **Pending**. Admin menerima notifikasi |
| 4 | (Jika diminta) menjawab pertanyaan admin lewat chat | Admin memverifikasi |
| 5 | Menunggu keputusan | Intern menerima notifikasi **Disetujui** atau **Ditolak** beserta catatan admin |
| 6 | Jika disetujui | Data absensi diperbarui, status dihitung ulang otomatis, baris diberi label "Dikoreksi admin" |

### 9.2 Layar

```
+--------------------------------------------------------------+
| Ajukan Koreksi Absensi                                       |
|                                                              |
| Tanggal absensi *   [09/10/2026]                             |
| Data tercatat       Clock in 08:02 | Clock out -             |
|                                                              |
| Clock in yang benar   [08:02]                                |
| Clock out yang benar  [17:00]                                |
| Alasan *  [_______________________________________]          |
| Bukti (opsional)  [ Pilih file ]                             |
|                                                              |
| Admin dapat menghubungi Anda lewat chat untuk verifikasi.    |
|                                   [ Batal ]  [ Kirim ]       |
+--------------------------------------------------------------+
```

Daftar permintaan:

```
+------------------------------------------------------------------------+
| Koreksi Absensi                                   [ + Ajukan Koreksi ] |
|                                                                        |
| Tanggal absensi  Diajukan        Status      Catatan admin    Aksi     |
| 9 Okt 2026       10 Okt 09:12    Pending     -                [Batalkan]|
| 2 Okt 2026       3 Okt 08:05     Disetujui   "Sesuai bukti."  [Lihat]  |
| 25 Sep 2026      26 Sep 14:30    Ditolak     "Tidak ada bukti." [Lihat]|
+------------------------------------------------------------------------+
```

### 9.3 Validasi dan aturan

| Hal | Aturan |
|---|---|
| Tanggal | Hanya hari kerja yang sudah lewat atau hari ini, dan berada dalam periode magang |
| Satu tanggal | Hanya boleh ada satu permintaan **Pending** untuk satu tanggal. Pesan: "Sudah ada permintaan koreksi untuk tanggal ini." **[Usulan]** |
| Jam | Clock out harus setelah clock in. Pesan: "Jam clock out harus setelah jam clock in." |
| Alasan | Wajib. Pesan: "Alasan wajib diisi." |
| Batas waktu | Sistem tidak membatasi berapa hari ke belakang. Kebijakan diserahkan ke perusahaan. **[Keputusan]** |
| Membatalkan | Intern dapat membatalkan permintaan yang masih **Pending**. **[Usulan, sama dengan aturan izin]** |
| Setelah diproses | Tidak bisa dibuka ulang. Jika masih salah, ajukan permintaan baru. **[Usulan, sama dengan sisi admin]** |
| Catatan admin | Selalu tampil pada status Disetujui maupun Ditolak. **[Keputusan]** soal status dan catatan alasan |
| Bukti | Opsional, maksimal **2 MB**. Pesan: "Ukuran file maksimal 2 MB." Jenis file belum ditentukan (Bagian 20) |

---

## 10. Alur 8 - Task (Daftar, Kanban, Detail)

**Tujuan:** intern melihat pekerjaan yang diberikan mentor dan memajukan statusnya.
**Halaman:** Task.
**Aturan:**
- Task adalah pekerjaan yang diberikan mentor (konsep seperti Jira), **tidak harian**. **[Keputusan]** Intern tidak membuat atau menghapus Task.
- Status: **To Do, In Progress, In Review, Done**. **[Keputusan]**
- Task yang lewat tenggat diberi tanda **Terlambat**, tetapi tetap bisa dikumpulkan dan keputusan akhir ada pada mentor, seperti di LMS. **[Keputusan]**

### 10.1 Tampilan Kanban

```
+------------------------------------------------------------------------+
| Task                [Kanban | Daftar]                                   |
| Status tanda: [Semua v]  Urutkan: [Tenggat terdekat v]                 |
|                                                                        |
| To Do (2)     | In Progress (3) | In Review (1)    | Done (8)          |
| ------------- | --------------- | ---------------- | ----------------- |
| +-----------+ | +-------------+ | +--------------+ | +---------------+ |
| |Uji login  | | |Desain ERD   | | |Laporan API   | | |Dokumen SRS    | |
| |Bu Sari    | | |Bu Sari      | | |Bu Sari       | | |Bu Sari        | |
| |Tenggat 15 | | |Tenggat 14   | | |Tenggat 11    | | |Selesai 8 Okt  | |
| |Okt        | | |Okt   (1)*   | | |Okt [Terlambat]| |               | |
| +-----------+ | +-------------+ | +--------------+ | +---------------+ |
|                                                                        |
| * angka kecil = komentar baru dari mentor                              |
+------------------------------------------------------------------------+
```

Kartu Task menampilkan: judul, mentor, tenggat, tanda **Terlambat** bila berlaku, dan indikator komentar baru. **[Keputusan]** Komentar mentor ditandai indikator pada Task, klik membuka komentarnya.

### 10.2 Drag and drop pada Kanban

Kartu dapat dipindah dengan **drag and drop**. **[Keputusan]** Aturan perpindahan untuk Intern:

| Dari | Ke | Boleh | Efek |
|---|---|---|---|
| To Do | In Progress | Ya | Task mulai dikerjakan. Tidak ada notifikasi ke mentor |
| In Progress | To Do | Ya, hanya jika Task belum pernah dikumpulkan | Task kembali ke antrean |
| In Progress | In Review | Ya | Membuka dialog **Kumpulkan Hasil**. Kartu pindah setelah hasil terkirim. Jika dialog dibatalkan, kartu kembali ke In Progress |
| To Do | In Review | Tidak | Pesan: "Mulai kerjakan Task dulu sebelum mengumpulkan." |
| In Review | kolom mana pun | Tidak | Kartu terkunci karena menunggu mentor. Pesan: "Task sedang diperiksa mentor." Intern masih dapat mengganti hasil lewat tombol **Ganti Hasil** (Alur 9) |
| Done | kolom mana pun | Tidak | Kartu terkunci |
| kolom mana pun | Done | Tidak | Hanya mentor yang bisa menandai Done lewat Accept |

Aturan tambahan:
- Perpindahan yang tidak diizinkan membuat kartu **kembali ke kolom asal** dengan pesan singkat. **[Usulan]**
- Kartu yang terkunci diberi ikon kunci dan penunjuk kursor "tidak boleh". **[Usulan]**
- Semua perpindahan juga dapat dilakukan dengan tombol di detail Task (**Mulai Kerjakan**, **Kumpulkan Hasil**). Ini perlu untuk layar sentuh dan pengguna keyboard. Di layar sentuh, kartu diseret dengan tekan lama. **[Usulan]**
- Jika status Task berubah oleh pihak lain saat kartu diseret (misalnya mentor memberi Revise), kartu kembali dan muncul pesan "Status Task sudah berubah. Muat ulang." **[Usulan]**
- Kolom Done menampilkan 30 hari terakhir secara default, sisanya lewat filter. **[Usulan]**

### 10.3 Tampilan Daftar

```
+------------------------------------------------------------------------+
| Judul          Mentor   Status       Tenggat       Tanda      Aksi     |
| Laporan API    Bu Sari  In Review    11 Okt 17:00  Terlambat  [Buka]    |
| Desain ERD     Bu Sari  In Progress  14 Okt 17:00  (1) baru   [Buka]    |
| Uji login      Bu Sari  To Do        15 Okt 17:00             [Buka]    |
| Dokumen SRS    Bu Sari  Done         8 Okt 17:00              [Lihat]   |
+------------------------------------------------------------------------+
```

Filter dan sort untuk Intern: filter status, filter **Terlambat**, pencarian judul, sort tenggat terdekat (default), terbaru dibuat. **[Usulan]**

### 10.4 Detail Task

```
+--------------------------------------------------------------+
| Task: Desain ERD                           Status: In Progress |
| Mentor: Bu Sari            Tenggat: 14 Okt 2026 17:00        |
|                                                              |
| DESKRIPSI                                                    |
| Rancang ERD untuk modul absensi dan izin.                    |
|                                                              |
| ! Mentor meminta revisi. Lihat komentar di bawah.            |
|                                                              |
| HASIL KUMPULAN                                               |
| Belum ada hasil.                  [ Kumpulkan Hasil ]        |
|                                                              |
| KOMENTAR                                                     |
| Bu Sari (12 Okt 10:00)                                       |
|   Relasi izin ke intern belum ada, tolong tambahkan.         |
| [ Tulis komentar...                              ] [Kirim]   |
+--------------------------------------------------------------+
```

Tombol di detail menyesuaikan status:

| Status | Tombol yang tampil |
|---|---|
| To Do | **Mulai Kerjakan** |
| In Progress | **Kumpulkan Hasil** |
| In Review | **Ganti Hasil** |
| Done | Tidak ada. Layar hanya baca |

### 10.5 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Belum ada Task | "Belum ada Task dari mentor." |
| Task lewat tenggat | Tanda **Terlambat** merah dan keterangan "Lewat 2 hari". Task tetap bisa dikumpulkan |
| Mentor mengubah judul, deskripsi, atau tenggat | Notifikasi masuk. Detail menampilkan nilai terbaru |
| Mentor menghapus Task (hanya jika masih To Do dan tanpa komentar) | Kartu hilang dari Kanban. Notifikasi "Task [judul] dibatalkan mentor." **[Usulan]** |

---

## 11. Alur 9 - Mengumpulkan Hasil dan Menindaklanjuti Revisi

**Tujuan:** menyerahkan hasil Task ke mentor dan memperbaikinya bila diminta.
**Aturan:**
- Pengumpulan lewat **link** dan **unggah file**. **[Keputusan]** Ukuran file maksimal **2 MB**. **[Keputusan]**
- Pengumpulan ulang **menggantikan** hasil sebelumnya. File lama dihapus, **tanpa riwayat versi**. **[Keputusan]**
- Mentor menekan **Accept** (Task menjadi Done) atau **Revise** (Task kembali ke In Progress dengan komentar). Intern mendapat notifikasi pada kedua kasus. **[Keputusan]**
- Pengumpulan wajib lewat web. **[Keputusan]**

### 11.1 Langkah mengumpulkan

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Membuka Task berstatus In Progress | Detail tampil |
| 2 | Klik **Kumpulkan Hasil** (atau menyeret kartu ke In Review) | Dialog pengumpulan terbuka |
| 3 | Mengisi link dan atau memilih file | - |
| 4 | Klik **Kumpulkan** | Sistem memeriksa isian |
| 5 | - | Status menjadi **In Review**. Mentor menerima notifikasi |

### 11.2 Layar dialog

```
+--------------------------------------------------------------+
| Kumpulkan Hasil - Desain ERD                                 |
|                                                              |
| Link hasil   [https://__________________________________]    |
| File hasil   [ Pilih file ]  (belum ada file)                |
|                                                              |
| Isi link, file, atau keduanya.                               |
|                                                              |
| ! Tenggat sudah lewat. Hasil tetap dapat dikumpulkan,        |
|   mentor yang memutuskan.             (hanya jika terlambat) |
|                                                              |
|                       [ Batal ]  [ Kumpulkan ]               |
+--------------------------------------------------------------+
```

### 11.3 Validasi

| Kolom | Aturan | Pesan jika salah |
|---|---|---|
| Link dan file | Minimal salah satu terisi | "Isi link atau pilih file." |
| Link | Harus diawali http:// atau https:// | "Format link tidak valid." |
| File | Maksimal 2 MB, jenis sesuai batas sistem | "Ukuran file maksimal 2 MB." atau "Jenis file tidak diizinkan." (jenis file ditentukan di Bagian 20) |

### 11.4 Mengganti hasil (pengumpulan ulang)

Intern dapat mengganti hasil pada dua kondisi: Task **In Review** (mentor belum memeriksa) dan Task **In Progress** setelah **Revise**. **[Usulan]**

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Klik **Ganti Hasil** (atau **Kumpulkan Hasil** setelah Revise) | Dialog pengumpulan terbuka |
| 2 | Mengisi hasil baru | Peringatan: "Hasil sebelumnya akan diganti dan file lama dihapus permanen." |
| 3 | Klik **Kumpulkan** | Hasil lama dihapus, hasil baru tersimpan |
| 4 | - | Status menjadi **In Review**. Mentor menerima notifikasi |

Tidak ada riwayat versi, sehingga intern tidak dapat mengembalikan hasil lama.

### 11.5 Menindaklanjuti Revise

| No | Kejadian | Tampilan untuk Intern |
|---|---|---|
| 1 | Mentor menekan **Revise** dengan komentar | Task kembali ke **In Progress**. Notifikasi masuk. Kartu menampilkan indikator komentar baru |
| 2 | Intern membuka Task | Banner "Mentor meminta revisi. Lihat komentar di bawah." Komentar revisi disorot |
| 3 | Intern memperbaiki dan mengumpulkan ulang (11.4) | Task kembali ke **In Review** |

### 11.6 Setelah Accept

Task menjadi **Done** dan terkunci. Intern menerima notifikasi. Hasil dan komentar tetap dapat dilihat. **[Keputusan]** soal Accept menjadi Done.

### 11.7 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Koneksi terputus saat mengunggah | "Hasil belum terkumpul. Coba lagi." Status Task tidak berubah |
| Link tidak dapat dibuka mentor | Mentor menekan Revise dengan komentar. Sistem tidak memeriksa tautan otomatis |
| Task sudah Done saat dialog dibuka | "Task ini sudah selesai." Pengumpulan ditolak |
| Mentor memberi Accept saat intern mengganti hasil | Pesan "Task sudah diterima mentor." Penggantian dibatalkan, hasil yang diterima tetap |

---

## 12. Alur 10 - Komentar Task

**Tujuan:** berdiskusi dengan mentor pada Task yang sama.
**Aturan:**
- Komentar berupa **thread dua arah seperti GitHub**: intern dan mentor saling membalas. **[Keputusan]**
- Komentar mentor ditandai **indikator atau popup** pada Task. Klik membuka komentar. **[Keputusan]**

### 12.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Melihat indikator komentar baru pada kartu Task, atau notifikasi di bell | - |
| 2 | Klik kartu atau notifikasi | Detail Task terbuka langsung di bagian komentar |
| 3 | Membaca komentar mentor | Indikator hilang setelah dibaca |
| 4 | Menulis balasan, klik **Kirim** | Balasan muncul di thread. Mentor menerima notifikasi |

### 12.2 Aturan

- Komentar yang sudah terkirim **tidak dapat diedit atau dihapus** oleh siapa pun, agar jejak diskusi utuh. **[Usulan]**
- Pada Task **Done**, thread terkunci (hanya baca). **[Usulan]**
- Komentar hanya ada pada Task. Daily Report tidak punya thread komentar. **[Usulan]**
- Komentar tidak boleh kosong. Pesan: "Tulis komentar dulu."
- Tidak ada penerima lain selain mentor Task tersebut. Admin tidak ikut dalam thread. **[Usulan]**

---

## 13. Alur 11 - Izin

**Tujuan:** mengajukan ketidakhadiran yang sah.
**Halaman:** Izin.
**Aturan:**
- Jenis izin hanya **Izin Sakit** dan **Izin Urgent**. **Intern tidak memiliki cuti.** **[Keputusan]**
- Pengajuan wajib lewat web dan dapat disertai **lampiran bukti** (misalnya surat dokter). **[Keputusan]**
- Izin lebih dari 2 hari dihitung berdasarkan hari kerja sesuai kalender kerja. **[Keputusan]**
- Izin yang disetujui otomatis mengubah status absensi pada hari terkait. **[Keputusan]**
- Intern dapat **membatalkan** pengajuan yang masih Pending. **[Keputusan]**
- Mentor memproses lebih dulu. Izin yang tidak diproses mentor dalam 24 jam muncul sebagai pengingat di dashboard admin, yang dapat memprosesnya hanya bila ada surat resmi atau bukti. **[Keputusan]**

### 13.1 Langkah mengajukan

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Membuka menu Izin, klik **Ajukan Izin** | Formulir terbuka |
| 2 | Memilih jenis, tanggal, mengisi alasan, melampirkan bukti | Sistem menghitung jumlah hari kerja |
| 3 | Klik **Kirim** | Pengajuan berstatus **Pending**. Mentor menerima notifikasi |
| 4 | Menunggu keputusan | Status berubah menjadi **Disetujui** atau **Ditolak** disertai catatan |
| 5 | Jika disetujui | Status absensi pada hari kerja yang tercakup menjadi **Izin** otomatis. Intern menerima notifikasi |

### 13.2 Layar formulir

```
+--------------------------------------------------------------+
| Ajukan Izin                                                  |
|                                                              |
| Jenis izin *        ( ) Izin Sakit    ( ) Izin Urgent        |
| Tanggal mulai *     [__/__/____]                             |
| Tanggal selesai *   [__/__/____]                             |
| Total: 2 hari kerja (Sabtu, Minggu, dan libur tidak dihitung)|
| Alasan *            [_____________________________________] |
| Lampiran bukti      [ Pilih file ]  (misalnya surat dokter)  |
|                                                              |
| Tanpa lampiran, izin hanya dapat diproses mentor. Admin      |
| hanya membantu bila ada surat resmi atau bukti.              |
|                                                              |
|                         [ Batal ]  [ Kirim ]                 |
+--------------------------------------------------------------+
```

### 13.3 Validasi

| Kolom | Aturan | Pesan jika salah |
|---|---|---|
| Jenis | Wajib | "Pilih jenis izin." |
| Tanggal | Selesai tidak boleh sebelum mulai | "Tanggal selesai harus sesudah tanggal mulai." |
| Tanggal | Harus berada dalam periode magang | "Tanggal di luar periode magang." |
| Tanggal | Harus mengandung minimal satu hari kerja | "Tanggal yang dipilih tidak mengandung hari kerja." |
| Tanggal | Tidak tumpang tindih dengan izin lain yang Pending atau Disetujui | "Sudah ada izin pada tanggal ini." |
| Alasan | Wajib | "Alasan wajib diisi." |
| Lampiran | Opsional, maksimal 2 MB. Jenis file belum ditentukan (Bagian 20) | "Ukuran file maksimal 2 MB." |

### 13.4 Aturan tanggal

- Izin dapat diajukan untuk **hari ini, tanggal mendatang, dan tanggal yang sudah lewat**. Sistem tidak membatasi berapa hari ke belakang, karena kebijakan diserahkan ke perusahaan. **[Usulan, sejalan dengan keputusan koreksi absensi]**
- Pengajuan untuk tanggal lampau diberi label "Diajukan setelah tanggal izin" agar mentor dan admin tahu. **[Usulan]**
- Jika izin untuk tanggal lampau disetujui, status absensi tanggal itu yang tadinya **Tidak Hadir** menjadi **Izin** secara otomatis. **[Keputusan]** soal pembaruan otomatis
- Jika intern sudah clock in pada hari itu, hari tersebut dikecualikan dari izin dan tetap **Hadir**. **[Usulan]**
- Izin tidak dapat diubah setelah dikirim. Untuk mengubah, batalkan lalu ajukan ulang (hanya saat Pending). **[Usulan]**

### 13.5 Riwayat izin

```
+------------------------------------------------------------------------+
| Izin                                              [ + Ajukan Izin ]    |
| Status: [Semua v]                                                      |
|                                                                        |
| Jenis   Tanggal       Hari kerja  Status     Diproses oleh  Aksi       |
| Sakit   13-14 Okt     2           Pending    -              [Batalkan] |
| Urgent  5 Okt         1           Disetujui  Bu Sari        [Lihat]    |
| Sakit   28-29 Sep     2           Ditolak    Bu Sari        [Lihat]    |
| Urgent  20 Sep        1           Dibatalkan -              [Lihat]    |
+------------------------------------------------------------------------+
```

Detail izin menampilkan alasan, lampiran, pemroses (mentor atau admin), waktu, dan **catatan** pemroses. Status dan catatan alasan selalu tampil. **[Keputusan]**

### 13.6 Membatalkan izin

```
+--------------------------------------------------+
| Batalkan pengajuan izin?                         |
| Izin Sakit 13-14 Okt akan dibatalkan dan tidak   |
| diproses lagi.                                   |
|                                                  |
|             [ Kembali ]  [ Ya, batalkan ]        |
+--------------------------------------------------+
```

- Pembatalan hanya untuk status **Pending**. Izin yang sudah Disetujui atau Ditolak tidak dapat dibatalkan. **[Keputusan]** soal hanya saat Pending
- Setelah dibatalkan, mentor menerima notifikasi dan izin hilang dari kalender izin mentor. **[Keputusan]** soal kalender izin
- Jika mentor atau admin memproses saat intern menekan batalkan, pesan: "Izin ini sudah diproses oleh [nama]." Pembatalan tidak dilakukan. **[Usulan]**

### 13.7 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Izin diproses admin karena mentor tidak merespons | Detail menampilkan "Diproses oleh admin" dan catatan admin |
| Izin disetujui untuk hari ini | Kartu Dashboard menjadi "Izin hari ini". Tombol Clock In hilang |
| Izin mencakup Sabtu, Minggu, atau libur | Hari itu tidak dihitung dan statusnya tidak berubah menjadi Izin |
| Admin menambah libur di tengah rentang izin | Jumlah hari kerja dihitung ulang otomatis |

---

## 14. Alur 12 - Chat dan Notifikasi

### 14.1 Chat

- Semua pengguna dapat saling chat. **[Keputusan]** Intern bisa chat dengan mentor, intern lain, dan admin.
- Admin **tidak** dapat membaca chat orang lain. **[Keputusan]** Chat intern hanya dilihat pihak di dalam percakapan.
- Ada notifikasi untuk pesan baru. **[Keputusan]**
- Chat dipakai juga ketika admin memverifikasi koreksi absensi (Alur 7).

```
+--------------------------------------------------------------+
| Chat                                                         |
| Cari kontak: [__________]                                    |
|                                                              |
| Admin Sinta        Bisa jelaskan kenapa lupa clock out? (1)  |
| Bu Sari            Silakan dicek komentar di Task ERD.        |
| Doni A.            Ok, nanti saya kirim filenya.              |
+--------------------------------------------------------------+
```

### 14.2 Notifikasi

Cukup **bell icon** di navbar. Tidak ada halaman notifikasi terpisah. **[Keputusan]** Klik item membawa langsung ke layar terkait. Daftar kejadian ada di Bagian 16.

---

## 15. Situasi Khusus

### 15.1 Ganti mentor oleh admin

Task, komentar, dan izin pending ikut pindah ke mentor baru, dan riwayat lama tetap tersimpan. **[Keputusan]** Dari sisi Intern:
- Intern menerima notifikasi "Mentor Anda sekarang Bu Sari."
- Nama mentor pada kartu Task, detail Task, dan Dashboard berubah ke mentor baru.
- Tidak ada Task yang hilang atau berubah status. Thread komentar lama tetap bisa dibaca.
- Izin yang masih Pending diproses mentor baru.

### 15.2 Akhir periode magang

- Admin menampilkan pengingat 7 hari sebelum berakhir, menanyakan perpanjangan ke mentor lewat chat, lalu memperpanjang atau membiarkan akun nonaktif. **[Keputusan]** Intern tidak melakukan apa pun dalam proses ini.
- Intern dapat clock in dan clock out sampai **hari terakhir** magang. Status Nonaktif berlaku mulai hari berikutnya. **[Usulan, sama dengan design-admin.md]**
- Setelah nonaktif: tidak bisa login atau clock in. Datanya tetap tersimpan dan dapat dilihat mentor dan admin. Mentor tetap bisa memeriksa Task yang sudah dikumpulkan. **[Keputusan]**
- Task yang direvisi mentor setelah intern nonaktif tidak bisa ditindaklanjuti karena intern tidak bisa login. Ini sudah disepakati sebagai konsekuensi alur. **[Keputusan]**
- Disarankan intern mengumpulkan semua Task sebelum hari terakhir. Tidak ada fitur khusus. **[Usulan, saran proses]**

### 15.3 Cut-off 23:59

- Status hari berjalan belum final sampai lewat 23:59. Di Riwayat, hari ini tampil sebagai "Berjalan". **[Usulan]**
- Setelah 23:59, Daily Report dan data hari itu terkunci. Perbaikan hanya lewat koreksi absensi. **[Usulan]**

### 15.4 Hari libur ditambahkan admin

Jika admin menambah libur untuk tanggal yang sudah lewat, status absensi tanggal itu dihitung ulang otomatis (misalnya Tidak Hadir menjadi Libur). **[Keputusan]** Intern tidak perlu mengajukan apa pun.

### 15.5 Sesi dan koneksi

| Kondisi | Perilaku |
|---|---|
| Sesi login habis | Diarahkan ke layar Login. Isian formulir yang belum terkirim tidak dijanjikan tersimpan. **[Usulan]** |
| Koneksi terputus | Pesan "Koneksi terputus. Coba lagi." Tidak ada perubahan data tanpa konfirmasi server |

---

## 16. Notifikasi Intern (Bell Icon)

Tidak ada halaman notifikasi terpisah, cukup bell icon di navbar. **[Keputusan]** Klik item membawa langsung ke layar terkait. Deteksi anomali tidak dibuat. **[Keputusan]**

| Kejadian | Isi notifikasi | Tujuan klik |
|---|---|---|
| Mentor membuat Task baru | "Task baru dari Bu Sari: Desain ERD." | Detail Task |
| Mentor mengubah Task | "Task 'Desain ERD' diubah mentor." | Detail Task |
| Mentor membatalkan Task | "Task 'Uji login' dibatalkan mentor." | Daftar Task |
| Mentor membalas komentar | "Bu Sari berkomentar di 'Desain ERD'." | Thread komentar |
| Mentor menekan Accept | "Task 'Laporan API' diterima." | Detail Task |
| Mentor menekan Revise | "Task 'Laporan API' perlu direvisi." | Detail Task, komentar |
| Izin disetujui atau ditolak (mentor atau admin) | "Izin Sakit 13-14 Okt disetujui." | Detail izin |
| Koreksi absensi disetujui atau ditolak | "Koreksi absensi 9 Okt disetujui." | Detail koreksi |
| Pesan chat baru | "Pesan baru dari Admin Sinta." | Chat |
| Pengumuman admin untuk role Intern | Judul pengumuman | Isi pengumuman |
| Pergantian mentor | "Mentor Anda sekarang Bu Sari." | Dashboard |

Aturan:
- Intern **tidak** menerima notifikasi untuk warning (hanya admin) dan tidak menerima pengingat clock in. **[Keputusan]** soal warning, **[Usulan]** soal pengingat clock in
- Intern tidak menerima notifikasi saat dirinya sendiri mengumpulkan atau mengajukan sesuatu. Konfirmasi tampil di layar. **[Usulan]**

---

## 17. Aturan Tampilan

### 17.1 Status dan warna

Warna tidak boleh menjadi satu-satunya penanda. Selalu sertakan teks pada badge. Warna sama dengan Admin dan Mentor.

| Status | Dipakai untuk | Warna (usulan) |
|---|---|---|
| Hadir | Absensi | Hijau (#2E7D32) |
| Izin | Absensi | Biru (#1565C0) |
| Tidak Hadir | Absensi | Merah (#C62828) |
| Lupa Clock Out | Absensi | Oranye (#EF6C00) |
| Libur | Absensi | Abu-abu (#757575) |
| Berjalan | Absensi hari ini | Abu-abu muda |
| Dikoreksi admin | Label kecil pada absensi | Abu-abu gelap |
| To Do | Task | Abu-abu (#757575) |
| In Progress | Task | Biru (#1565C0) |
| In Review | Task | Kuning (#F9A825) |
| Done | Task | Hijau (#2E7D32) |
| Terlambat | Tanda pada Task | Merah (#C62828) |
| Terkirim | Daily Report | Hijau |
| Belum dikirim | Daily Report | Oranye |
| Pending | Izin, koreksi | Kuning (#F9A825) |
| Disetujui | Izin, koreksi | Hijau (#2E7D32) |
| Ditolak | Izin, koreksi | Merah (#C62828) |
| Dibatalkan | Izin, koreksi | Abu-abu (#757575) |

### 17.2 Format

- Tanggal: "Sen, 12 Okt 2026". Waktu: 24 jam, misalnya 17:00. Zona waktu mengikuti perusahaan.
- Keterlambatan Task ditulis dalam hari, misalnya "Lewat 2 hari".
- Tombol utama (Simpan, Kirim, Kumpulkan, Clock In) di kanan bawah. Tombol batal di sebelah kirinya. Tombol Clock In dan Clock Out dibuat besar agar mudah ditekan di ponsel. **[Usulan]**
- Bahasa tombol dan status konsisten dengan role lain (Accept, Revise, Setujui, Tolak). **[Usulan]**

### 17.3 Kondisi layar

| Kondisi | Tampilan |
|---|---|
| Memuat | Kerangka abu-abu atau indikator loading |
| Kosong | Teks penjelas singkat, misalnya "Belum ada pengajuan izin." |
| Gagal | "Terjadi kesalahan. Coba lagi." dengan tombol **Coba lagi** |
| Tidak punya akses | "Anda tidak memiliki akses ke halaman ini." |

### 17.4 Dialog konfirmasi

Dipakai untuk tindakan yang berdampak: clock out sebelum jam pulang, mengganti hasil Task, membatalkan izin, membatalkan koreksi. Isinya menjelaskan **dampaknya** dalam kalimat biasa, dan tombol konfirmasi memakai kata kerja jelas (contoh: "Ya, batalkan", bukan "OK").

### 17.5 Pesan sistem penting

| Situasi | Pesan |
|---|---|
| Berhasil disimpan | "Perubahan tersimpan." |
| Clock in berhasil | "Clock in berhasil pukul 08:02." |
| Clock out berhasil | "Clock out berhasil pukul 17:03. Terima kasih." |
| Daily Report terkirim | "Daily Report terkirim." |
| Hasil Task terkumpul | "Hasil terkumpul. Menunggu pemeriksaan mentor." |
| Izin terkirim | "Izin diajukan. Menunggu mentor." |
| Koreksi terkirim | "Permintaan koreksi terkirim. Menunggu admin." |
| Data sudah diproses pihak lain | "Data ini sudah diproses oleh [nama]." |
| Perpindahan Kanban tidak diizinkan | "Perpindahan ini tidak diizinkan." |

---

## 18. Hak Akses Intern

| Area | Intern bisa | Intern tidak bisa |
|---|---|---|
| Akun | Mengedit profil sendiri | Mengubah email internal, mentor, periode magang, atau role. Mengganti password sendiri (hanya saat login pertama dan lewat reset admin) |
| Absensi | Clock in, clock out, melihat riwayat dan rekap sendiri | Mengubah absensi langsung. Melihat absensi intern lain |
| Daily Report | Menulis dan mengubah sampai clock out, melihat riwayat sendiri | Mengubah setelah clock out. Menulis untuk hari lain |
| Koreksi | Mengajukan, melihat, dan membatalkan yang Pending | Menyetujui koreksi |
| Task | Melihat Task sendiri, menggeser kartu sesuai aturan, mengumpulkan dan mengganti hasil, berkomentar | Membuat, mengubah, atau menghapus Task. Menandai Done. Melihat Task intern lain |
| Izin | Mengajukan dengan bukti, melihat, dan membatalkan yang Pending | Menyetujui izin. Mengubah izin yang sudah dikirim. Mengajukan cuti (tidak ada) |
| Warning | - | Melihat atau membuat (hanya admin) |
| Performa | - | Melihat dashboard performa dan KPI (milik mentor) |
| Pengumuman | Menerima sesuai pilihan admin | Membuat |
| Laporan | - | Export (hanya admin) |
| Chat | Chat dengan semua pengguna | Membaca chat orang lain |

---

## 19. Keputusan Tambahan (Mengikuti Usulan)

Per 10 Oktober 2026, hal berikut dianggap disepakati. Nomor 1 sampai 15 mengikuti usulan, nomor 16 dan 17 adalah keputusan baru dari Draft 2. Hal yang masih terbuka ada di Bagian 20.

| No | Topik | Keputusan |
|---|---|---|
| 1 | Login | Email internal, akun dibuat admin, tanpa Google OAuth |
| 2 | Ganti password | Tidak ada ganti password mandiri. Hanya saat login pertama dan reset oleh admin |
| 3 | Kanban | Drag and drop didukung dengan aturan perpindahan di 10.2. Tombol di detail Task tetap tersedia |
| 4 | Status keterlambatan clock in | Tidak ada. Jam clock in tersimpan apa adanya |
| 5 | Clock out sebelum jam pulang | Boleh, setelah konfirmasi |
| 6 | Validasi lokasi | Pada clock in dan clock out, memakai radius kantor aktif (diubah di Draft 2, lihat nomor 16) |
| 7 | Daily Report | Dua kolom: pekerjaan (wajib) dan kendala (opsional) |
| 8 | Mengganti hasil Task | Boleh saat In Review dan setelah Revise. Hasil lama dihapus, tanpa versi |
| 9 | Komentar | Tidak bisa diedit atau dihapus. Thread terkunci saat Done |
| 10 | Izin tanggal lampau | Boleh, tanpa batas hari dari sistem, diberi label khusus |
| 11 | Izin tanpa lampiran | Boleh dikirim. Lampiran opsional, tetapi dianjurkan karena admin hanya membantu bila ada bukti |
| 12 | Clock in saat izin Pending | Boleh. Hari yang sudah clock in dikecualikan dari izin dan tetap Hadir |
| 13 | Membatalkan koreksi | Boleh saat Pending |
| 14 | Satu koreksi Pending per tanggal | Ya |
| 15 | Nonaktif akun | Berlaku mulai hari setelah tanggal selesai magang |
| 16 | Lokasi kantor | Admin membuat kantor lewat peta dengan radius clock in dan radius clock out. Clock in memakai radius clock in, clock out memakai radius clock out |
| 17 | Batas ukuran file | Maksimal 2 MB untuk hasil Task, lampiran izin, dan bukti koreksi |

---

## 20. Hal yang Masih Terbuka

Batas ukuran file (2 MB) dan validasi lokasi (radius kantor aktif) sudah diputuskan di Draft 2. Hal berikut masih terbuka.

| No | Topik | Keterangan |
|---|---|---|
| 1 | Jenis file yang diizinkan | Untuk hasil Task, lampiran izin, dan bukti koreksi. Usulan awal: PDF, DOCX, XLSX, PPTX, JPG, PNG untuk Task, dan PDF, JPG, PNG untuk lampiran izin dan koreksi |
| 2 | Intern dan kantor | Intern terikat satu kantor, atau boleh memakai kantor aktif mana pun (usulan: mana pun) |
| 3 | Batas radius | Usulan 10 sampai 1000 meter, belum diputuskan (sama dengan `design-admin.md` 17.2) |
| 4 | Kasus khusus lokasi | Penanganan GPS kurang akurat dan VPN, ditentukan tim teknis |
| 5 | Penyimpanan dan penghapusan file lama | Saat hasil diganti, file lama dihapus permanen. Cara dan waktu penghapusan ditentukan tim teknis |

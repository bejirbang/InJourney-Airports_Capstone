# design-mentor.md - Desain Role Mentor (Lengkap, Berdasarkan Alur)

Sistem: Web Intern Management dan Attendance System
Versi: Draft 1 | Tanggal: 10 Oktober 2026 | Acuan: PRD tanggal 7 Oktober 2026 dan design-admin.md

Tanda yang dipakai di dokumen ini:
- **[Keputusan]** = sudah disepakati di PRD.
- **[Usulan]** = pilihan desain dari saya. Per 10 Oktober 2026 semua usulan di dokumen ini **diikuti**, kecuali hal yang menyentuh sistem backend (batas ukuran file, jenis file, rincian validasi lokasi). Hal itu tetap terbuka di Bagian 17.

---

## 1. Cara Membaca Dokumen Ini

Dokumen disusun menurut **alur kerja Mentor**, bukan menurut daftar menu. Tiap alur berisi: tujuan, langkah demi langkah, sketsa layar, kondisi khusus, dan dampaknya (notifikasi dan status). Cara penulisannya sama dengan `design-admin.md` agar tim membaca ketiga role dengan pola yang sama.

Isi:
1. Cara membaca
2. Gambaran Mentor dan navigasi
3. Alur 1 - Login pertama dan profil
4. Alur 2 - Pantauan harian lewat Dashboard
5. Alur 3 - Melihat intern bimbingan (absensi dan Daily Report)
6. Alur 4 - Membuat Task
7. Alur 5 - Mengelola Task (Kanban, daftar, filter, sort, overdue)
8. Alur 6 - Memeriksa hasil Task (Accept atau Revise) dan komentar
9. Alur 7 - Memproses izin
10. Alur 8 - Kalender izin
11. Alur 9 - Performa Intern (rekap kehadiran dan KPI)
12. Alur 10 - Chat dan notifikasi
13. Situasi khusus (ganti mentor, intern nonaktif, magang berakhir)
14. Notifikasi Mentor (bell icon)
15. Aturan tampilan (status, warna, pesan)
16. Hak akses Mentor (bisa dan tidak bisa)
17. Keputusan tambahan dan hal yang masih terbuka

---

## 2. Gambaran Mentor dan Navigasi

**Peran:** Mentor membimbing intern: memberi dan memeriksa Task, memproses izin, serta memantau kehadiran dan performa. **[Keputusan]** Satu mentor dapat membimbing banyak intern, dan satu intern memiliki tepat satu mentor.

**Cakupan data:** Mentor hanya melihat dan mengelola data **intern bimbingannya sendiri**. Data intern mentor lain tidak tampil. **[Usulan berdasar relasi 1 intern = 1 mentor]**

**Fokus peran:** pengelolaan intern standar. **Tidak ada fitur penilaian (grading) intern.** **[Keputusan]**

**Platform:** web, utamanya desktop. Di tablet sidebar bisa dilipat. Di layar kecil tabel bisa digeser ke samping, dan Kanban menjadi satu kolom per layar. **[Usulan]**

### 2.1 Kerangka halaman

```
+------------------------------------------------------------------------+
| [Logo]  Nama Sistem                         [Chat] [Bell 4] [Mentor v] |
+--------------+---------------------------------------------------------+
| Dashboard    |                                                         |
| Intern Saya  |                                                         |
| Task         |                AREA KONTEN HALAMAN                      |
| Izin (2)     |                                                         |
| Kalender Izin|                                                         |
| Performa     |                                                         |
| Intern       |                                                         |
+--------------+---------------------------------------------------------+
```

Angka kecil di sebelah Izin adalah jumlah izin berstatus Pending yang menunggu mentor.

### 2.2 Menu sidebar

| Menu | Isi | Alamat halaman (usulan) |
|---|---|---|
| Dashboard | Ringkasan hari ini dan hal yang perlu ditindak | /mentor/dashboard |
| Intern Saya | Daftar intern, detail absensi dan Daily Report (hanya baca) | /mentor/interns |
| Task | Kanban dan daftar Task, buat Task, periksa hasil | /mentor/tasks |
| Izin | Pengajuan izin intern, proses yang Pending | /mentor/leaves |
| Kalender Izin | Kalender izin intern bimbingan | /mentor/leave-calendar |
| Performa Intern | Dashboard rekap kehadiran dan KPI | /mentor/performance |

Chat dan notifikasi (bell icon) ada di navbar atas, bukan di sidebar. **[Keputusan]** Tidak ada halaman notifikasi terpisah.

Menu yang **tidak ada** untuk Mentor: Laporan atau Export (hanya admin) **[Keputusan]**, Warning **[Keputusan]**, Koreksi Absensi, Pengaturan, Log Aktivitas, dan Pengumuman (mentor hanya menerima pengumuman, tidak membuatnya).

---

## 3. Alur 1 - Login Pertama dan Profil

**Tujuan:** mentor masuk ke sistem untuk pertama kali dengan aman.
**Latar:** akun mentor dibuat oleh admin dengan **email internal** dan password sementara. **[Keputusan]** Tidak ada login Google OAuth. **[Keputusan]** Semua pembuatan akun bergantung pada admin. **[Keputusan]**

### 3.1 Langkah

| No | Langkah Mentor | Respons sistem | Layar |
|---|---|---|---|
| 1 | Menerima email internal dan password sementara dari admin | - | - |
| 2 | Login | Sistem meminta ganti password | Login, lalu Ganti Password |
| 3 | Mengisi password baru dan konfirmasinya | Password tersimpan, masuk ke Dashboard | Ganti Password |
| 4 | (Opsional) membuka menu profil di navbar dan melengkapi nama, foto, kontak | Profil tersimpan | Profil |

Layar Ganti Password sama dengan yang dipakai Admin (lihat `design-admin.md`, Alur 1). Halaman lain tidak bisa dibuka sebelum password diganti. **[Keputusan]**

### 3.2 Lupa password

Mentor tidak memulihkan password sendiri. Ia menghubungi admin, admin menekan reset, lalu menyampaikan password sementara yang baru. **[Keputusan]** Layar login cukup menampilkan teks: "Lupa password? Hubungi admin."

### 3.3 Profil

- Mentor dapat mengedit profil sendiri (nama, foto, kontak). **[Keputusan]**
- Tidak ada ganti password mandiri. Password hanya diganti saat login pertama dan lewat reset oleh admin. **[Usulan, diikuti]**

---

## 4. Alur 2 - Pantauan Harian Lewat Dashboard

**Tujuan:** mentor melihat apa yang perlu ditindak hari ini dalam satu layar.
**Halaman:** Dashboard.

### 4.1 Layout

```
+------------------------------------------------------------------------+
| Dashboard                                      Senin, 12 Okt 2026      |
|                                                                        |
| INTERN SAYA HARI INI (6 intern)                                        |
| [Sudah Clock In] [Izin]   [Belum Clock In]                             |
|       4            1            1                                      |
| Status final ditetapkan sistem setelah 23:59.                          |
|                                                                        |
| PERLU TINDAKAN                                                         |
| +--------------------------------+ +---------------------------------+ |
| | Task menunggu review (3)       | | Izin pending (2)                | |
| | Andi P.  Desain ERD     [Buka] | | Andi P.  Sakit  14 jam  [Buka]  | |
| | Rina W.  Laporan API    [Buka] | | Dewi S.  Urgent 26 jam  [Buka]  | |
| |                [Lihat semua]   | |                  [Lihat semua]  | |
| +--------------------------------+ +---------------------------------+ |
| +--------------------------------+ +---------------------------------+ |
| | Komentar baru dari intern (2)  | | Task terlambat (1)              | |
| | Doni A.  Task "Uji login"[Buka]| | Budi K.  Task "Dokumen"  [Buka] | |
| |                [Lihat semua]   | |  lewat 2 hari                   | |
| +--------------------------------+ +---------------------------------+ |
+------------------------------------------------------------------------+
```

### 4.2 Penjelasan tiap bagian

| Bagian | Isi | Aturan |
|---|---|---|
| Kartu hari ini | Jumlah intern bimbingan yang Sudah Clock In, Izin, Belum Clock In | Pada hari berjalan yang belum clock in disebut "Belum Clock In", bukan "Tidak Hadir", karena status final baru ditetapkan setelah 23:59. **[Usulan berdasar aturan cut-off, sama dengan Dashboard Admin]** |
| Task menunggu review | Task berstatus **In Review** | Diurutkan dari yang paling lama menunggu. Tombol **Buka** menuju Alur 6 |
| Izin pending | Izin intern bimbingan yang masih Pending | Menampilkan jenis izin dan lama pending. Tombol **Buka** menuju Alur 7. Izin yang lewat 24 jam diberi tanda "!" karena sudah muncul sebagai pengingat di dashboard admin. **[Keputusan]** soal pengingat admin, **[Usulan]** soal tanda di sisi mentor |
| Komentar baru | Balasan intern pada thread komentar Task yang belum dibaca | Tombol **Buka** membuka Task langsung di thread komentar |
| Task terlambat | Task yang lewat tenggat dan belum Done | **[Keputusan]** Pelacakan Task overdue termasuk fitur mentor. Menampilkan lama keterlambatan |

Tiap daftar menampilkan maksimal 5 baris, sisanya lewat **Lihat semua**.

### 4.3 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Hari ini Sabtu, Minggu, atau libur | Banner "Hari ini hari libur: [nama libur]". Kartu hari ini disembunyikan |
| Tidak ada yang perlu ditindak | "Tidak ada yang perlu ditindak hari ini." di tiap kotak |
| Mentor belum punya intern | "Belum ada intern bimbingan. Hubungi admin untuk penugasan." |
| Data gagal dimuat | "Data gagal dimuat." dan tombol **Coba lagi** |

---

## 5. Alur 3 - Melihat Intern Bimbingan (Absensi dan Daily Report)

**Tujuan:** mentor memantau kehadiran dan laporan harian intern.
**Halaman:** Intern Saya.
**Aturan:** mentor punya akses **baca saja (read-only)** ke Daily Report dan rekap absensi. **[Keputusan]** Mentor tidak mengubah data absensi dan tidak memproses koreksi absensi (itu hak admin). **[Keputusan]**

### 5.1 Daftar intern

```
+------------------------------------------------------------------------+
| Intern Saya                                                            |
| Cari: [______________]  Status: [Aktif v]                              |
|                                                                        |
| Nama          Hari ini        Periode Magang        Status   Aksi      |
| -------------------------------------------------------------------    |
| Andi Pratama  Sudah Clock In  1 Sep - 31 Des 2026   Aktif    [Buka]    |
| Rina Wulandari Izin           1 Mar - 17 Okt 2026   Aktif    [Buka]    |
|                               ! berakhir 7 hari lagi                   |
| Doni A.       Belum Clock In  1 Sep - 31 Des 2026   Aktif    [Buka]    |
+------------------------------------------------------------------------+
```

- Default filter Status = Aktif. Intern **Nonaktif** bisa dilihat lewat filter. **[Keputusan]** Data intern nonaktif tetap bisa dilihat mentor.
- Tanda "berakhir 7 hari lagi" hanya informasi. Perpanjangan atau penonaktifan dikelola admin, yang akan menanyakannya lewat chat. **[Keputusan]**
- Mentor tidak bisa menambah, mengubah, atau menonaktifkan intern. **[Usulan berdasar hak akses]**

### 5.2 Detail intern

```
+------------------------------------------------------------------------+
| < Intern Saya      Andi Pratama                      [Chat dengan intern]|
| Status: Aktif    Periode: 1 Sep - 31 Des 2026                          |
|                                                                        |
| [Rekap Absensi] [Daily Report] [Task] [Izin]                           |
| ---------------------------------------------------------------------- |
| (isi tab yang dipilih)                                                 |
+------------------------------------------------------------------------+
```

| Tab | Isi | Sifat |
|---|---|---|
| Rekap Absensi | Rekap bulanan dan riwayat harian | Hanya baca |
| Daily Report | Daftar laporan harian per tanggal | Hanya baca |
| Task | Task milik intern ini (menuju Alur 5 dan 6) | Sesuai hak mentor |
| Izin | Riwayat izin intern ini (menuju Alur 7) | Sesuai hak mentor |

Tidak ada tab **Warning** untuk mentor. **[Keputusan]**

### 5.3 Tab Rekap Absensi

```
+------------------------------------------------------------------------+
| Rekap Absensi         Bulan: [< Oktober 2026 >]                        |
|                                                                        |
| Hadir 14 | Izin 2 | Tidak Hadir 1 | Lupa Clock Out 1 | Hari kerja 18   |
|                                                                        |
| Tanggal        Clock In  Clock Out  Status           Catatan           |
| Jum, 9 Okt     08:02     17:00      Hadir            Dikoreksi admin   |
| Kam, 8 Okt     08:10     17:05      Hadir                              |
| Rab, 7 Okt     -         -          Izin             Izin sakit        |
| Sel, 6 Okt     08:00     -          Lupa Clock Out                     |
+------------------------------------------------------------------------+
```

- Status memakai aturan otomatis sistem (batas 23:59). **[Keputusan]**
- Baris yang dikoreksi admin diberi label "Dikoreksi admin". **[Usulan, sama dengan sisi admin]**
- Sabtu, Minggu, dan hari libur tidak dihitung hari kerja. **[Keputusan]**

### 5.4 Tab Daily Report

```
+------------------------------------------------------------------------+
| Daily Report                      Bulan: [< Oktober 2026 >]            |
|                                                                        |
| Tanggal        Ringkasan                                   Status      |
| Jum, 9 Okt     "Menyelesaikan rancangan ERD tahap 1..."    Terkirim    |
| Kam, 8 Okt     "Rapat dengan tim, revisi kebutuhan..."     Terkirim    |
| Rab, 7 Okt     -                                           Izin        |
|                                                                        |
| [Klik baris untuk membaca laporan lengkap]                             |
+------------------------------------------------------------------------+
```

- Daily Report dan Task adalah dua hal terpisah. Daily Report adalah laporan intern tentang apa yang ia kerjakan hari itu, bukan hasil Task. **[Keputusan]**
- Daily Report wajib terkirim sebelum clock out. **[Keputusan]** Karena itu, hari Hadir normalnya memiliki laporan. Hari tanpa laporan akan terlihat jelas. **[Usulan pada tampilan]**
- Mentor tidak bisa mengedit atau mengomentari Daily Report. Komentar hanya tersedia pada Task. **[Usulan berdasar keputusan hanya baca]**

### 5.5 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Belum ada data di bulan itu | "Belum ada data absensi pada bulan ini." |
| Hari tanpa Daily Report | Tertulis "Belum ada laporan" dengan teks abu-abu |
| Intern nonaktif | Banner "Intern ini sudah nonaktif. Data hanya dapat dilihat." |

---

## 6. Alur 4 - Membuat Task

**Tujuan:** memberi pekerjaan kepada intern.
**Halaman:** Task, tombol **Buat Task**.
**Aturan:**
- Task adalah pekerjaan yang diberikan mentor (konsep seperti Jira), **tidak harian**. **[Keputusan]**
- Setiap Task diberikan ke **satu intern**. Tidak ada assign ke banyak intern sekaligus, karena tiap intern memiliki Task berbeda. **[Keputusan]**

### 6.1 Langkah

| No | Langkah Mentor | Respons sistem |
|---|---|---|
| 1 | Klik **Buat Task** (di halaman Task, atau tab Task pada detail intern) | Formulir terbuka |
| 2 | Memilih intern | Hanya intern bimbingan yang berstatus Aktif yang tampil |
| 3 | Mengisi judul, deskripsi, dan tenggat | - |
| 4 | Klik **Simpan** | Sistem memeriksa isian |
| 5 | - | Task dibuat dengan status **To Do**. Intern menerima notifikasi di bell icon |

### 6.2 Layar

```
+--------------------------------------------------------------+
| Buat Task                                                    |
|                                                              |
| Intern *      [Pilih intern                            v]    |
| Judul *       [___________________________________________] |
| Deskripsi *   [___________________________________________] |
|               [___________________________________________] |
| Tenggat *     [__/__/____]   [__:__]                         |
|                                                              |
|                        [ Batal ]  [ Simpan ]                 |
+--------------------------------------------------------------+
```

### 6.3 Validasi

| Kolom | Aturan | Pesan jika salah |
|---|---|---|
| Intern | Wajib, hanya intern aktif bimbingan sendiri | "Pilih intern untuk Task ini." |
| Judul | Wajib | "Judul wajib diisi." |
| Deskripsi | Wajib | "Deskripsi wajib diisi." |
| Tenggat | Wajib, tidak boleh sebelum waktu sekarang | "Tenggat harus setelah waktu sekarang." |
| Tenggat | Disarankan pada hari kerja | Peringatan (tetap bisa disimpan): "Tenggat jatuh pada hari libur." **[Usulan]** |

### 6.4 Mengubah Task

- Mentor dapat mengubah judul, deskripsi, dan tenggat selama Task **belum Done**. **[Usulan]** Perubahan memberi notifikasi ke intern.
- Task yang sudah Done terkunci. **[Usulan]**
- Mentor dapat **menghapus** Task hanya jika statusnya masih **To Do** dan belum ada komentar. Intern menerima notifikasi pembatalan. Task yang sudah dikerjakan tidak dapat dihapus, hanya diselesaikan. **[Usulan, diikuti]**

### 6.5 Hal yang tidak ada

- Tidak ada pemberian satu Task ke banyak intern sekaligus. **[Keputusan]**
- Lampiran referensi dari mentor, prioritas, dan label **tidak termasuk** cakupan versi ini. Dapat ditambahkan sebagai pengembangan berikutnya. **[Usulan, diikuti]**

---

## 7. Alur 5 - Mengelola Task (Kanban, Daftar, Filter, Sort, Overdue)

**Tujuan:** mentor melihat seluruh pekerjaan intern bimbingan dan memantau yang terlambat.
**Halaman:** Task.
**Aturan:** tampilan Kanban board dan fitur filter serta sort Task dibutuhkan. **[Keputusan]**

### 7.1 Status Task

| Status | Arti | Siapa yang memindahkan |
|---|---|---|
| To Do | Task baru, belum dikerjakan | Dibuat mentor |
| In Progress | Sedang dikerjakan | Intern mulai mengerjakan, atau mentor menekan **Revise** |
| In Review | Sudah dikumpulkan, menunggu pemeriksaan mentor | Intern mengumpulkan hasil |
| Done | Diterima mentor | Mentor menekan **Accept** |

Empat status ini **[Keputusan]**. Aturan siapa yang memindahkan adalah **[Usulan berdasar alur Accept dan Revise]**.

Tanda tambahan **Terlambat**: diberikan pada Task yang lewat tenggat. Task terlambat **tetap bisa dikumpulkan** dan keputusan akhir ada pada mentor, seperti pada LMS. **[Keputusan]**

### 7.2 Tampilan Kanban

```
+------------------------------------------------------------------------+
| Task                [Kanban | Daftar]            [ + Buat Task ]       |
| Intern: [Semua v]  Status tanda: [Semua v]  Urutkan: [Tenggat terdekat v]|
|                                                                        |
| To Do (2)     | In Progress (3) | In Review (3)    | Done (8)          |
| ------------- | --------------- | ---------------- | ----------------- |
| +-----------+ | +-------------+ | +--------------+ | +---------------+ |
| |Uji login  | | |Desain ERD   | | |Laporan API   | | |Dokumen SRS    | |
| |Doni A.    | | |Andi P.      | | |Rina W.       | | |Dewi S.        | |
| |Tenggat 15 | | |Tenggat 14   | | |Tenggat 11    | | |Selesai 8 Okt  | |
| |Okt        | | |Okt     (2)* | | |Okt  [!Terlambat]| |             | |
| +-----------+ | +-------------+ | +--------------+ | +---------------+ |
|                                                                        |
| * angka kecil = jumlah komentar belum dibaca                           |
+------------------------------------------------------------------------+
```

Kartu Task menampilkan: judul, nama intern, tenggat, tanda **Terlambat** bila berlaku, dan indikator komentar baru. **[Keputusan]** Komentar mentor atau intern ditandai indikator pada Task. Klik membuka Task dan komentarnya.

**Drag and drop:** kartu dapat dipindah dengan **drag and drop**. **[Keputusan]** Agar status tidak bergeser tanpa jejak dan notifikasi, perpindahan untuk Mentor mengikuti aturan berikut. **[Usulan, diikuti]**

| Dari | Ke | Boleh | Efek |
|---|---|---|---|
| In Review | Done | Ya | Sama dengan **Accept**. Dialog konfirmasi singkat, lalu Task menjadi Done. Intern menerima notifikasi |
| In Review | In Progress | Ya | Sama dengan **Revise**. Dialog komentar revisi terbuka. Kartu pindah setelah komentar dikirim. Jika dialog dibatalkan, kartu kembali ke In Review |
| To Do | kolom mana pun | Tidak | Status To Do dan In Progress diubah oleh intern. Tooltip: "Status ini diubah oleh intern." |
| In Progress | kolom mana pun | Tidak | Sama seperti di atas |
| Done | kolom mana pun | Tidak | Task selesai terkunci. Tooltip: "Task sudah selesai." |
| kolom mana pun | To Do | Tidak | Mentor tidak mengembalikan Task ke To Do |

Aturan tambahan:
- Hanya kartu di kolom **In Review** yang bisa diseret oleh mentor. Kartu lain diberi ikon kunci dan penunjuk kursor "tidak boleh". **[Usulan]**
- Perpindahan yang tidak diizinkan membuat kartu **kembali ke kolom asal** dengan pesan "Perpindahan ini tidak diizinkan." **[Usulan]**
- Tombol **Accept** dan **Revise** di detail Task tetap tersedia. Ini perlu untuk layar sentuh dan pengguna keyboard. Di layar sentuh, kartu diseret dengan tekan lama. **[Usulan]**
- Jika status Task berubah oleh pihak lain saat kartu diseret (misalnya intern mengganti hasil), kartu kembali dan muncul pesan "Status Task sudah berubah. Muat ulang." **[Usulan]**
- Jika intern sudah nonaktif, menyeret kartu ke In Progress menampilkan peringatan yang sama dengan Revise (lihat 8.6). **[Usulan]**
- Intern juga memiliki Kanban dengan aturan perpindahannya sendiri (lihat `design-intern.md`, 10.2).
- Kolom Done menampilkan 30 hari terakhir secara default, sisanya lewat filter. **[Usulan]**

### 7.3 Tampilan Daftar

```
+------------------------------------------------------------------------+
| Judul          Intern   Status       Tenggat      Tanda      Aksi      |
| Laporan API    Rina W.  In Review    11 Okt 17:00 Terlambat  [Periksa] |
| Desain ERD     Andi P.  In Progress  14 Okt 17:00            [Buka]    |
| Uji login      Doni A.  To Do        15 Okt 17:00            [Buka]    |
| Dokumen SRS    Dewi S.  Done         8 Okt 17:00             [Lihat]   |
+------------------------------------------------------------------------+
```

### 7.4 Filter dan sort

| Fitur | Pilihan |
|---|---|
| Filter intern | Semua atau pilih satu intern |
| Filter status | To Do, In Progress, In Review, Done |
| Filter tanda | Hanya yang **Terlambat** |
| Filter tenggat | Rentang tanggal |
| Pencarian | Cari berdasarkan judul |
| Sort | Tenggat terdekat (default), terbaru dibuat, nama intern |

Pilihan filter di atas adalah **[Usulan]**. Kebutuhan filter dan sort sudah **[Keputusan]**.

### 7.5 Pelacakan Task terlambat (overdue)

- Task yang lewat tenggat dan belum Done diberi tanda **Terlambat** dan muncul pada kotak "Task terlambat" di Dashboard. **[Keputusan]**
- Jika Task dikumpulkan setelah tenggat, kartu tetap memiliki tanda **Terlambat**, ditambah keterangan "Dikumpulkan terlambat" pada detail, agar mentor tahu saat memeriksa. **[Usulan]**
- Tanda Terlambat **tidak menghalangi** pengumpulan dan tidak otomatis menolak hasil. **[Keputusan]**

### 7.6 Pengingat tenggat

Notifikasi pengingat tenggat hanya dibuat jika benar-benar berdampak besar. **[Keputusan]** Karena itu mentor **tidak** menerima pengingat tenggat harian. Satu-satunya pengingat yang dikirim: Task yang **lewat tenggat lebih dari 2 hari kerja tanpa dikumpulkan**. Pengingat dikirim sekali per Task, tidak berulang. **[Usulan, diikuti]**

---

## 8. Alur 6 - Memeriksa Hasil Task (Accept atau Revise) dan Komentar

**Tujuan:** menilai hasil kerja intern dan memberi umpan balik.
**Pemicu:** intern mengumpulkan hasil, Task berstatus **In Review**, mentor menerima notifikasi.
**Aturan:**
- Mentor menekan **Accept** atau **Revise**. Accept membuat Task **Done**. Revise membuat Task **kembali ke In Progress** disertai komentar. **[Keputusan]**
- Intern menerima notifikasi pada kedua kasus. **[Keputusan]**
- Tidak ada nilai atau skor. **[Keputusan]**

### 8.1 Langkah

| No | Langkah Mentor | Respons sistem |
|---|---|---|
| 1 | Menerima notifikasi di bell, atau melihat kotak "Task menunggu review" di Dashboard | Task berstatus **In Review** tampil |
| 2 | Membuka Task | Panel detail terbuka dengan hasil kumpulan dan thread komentar |
| 3 | Membuka hasil (link atau file) | Link terbuka di tab baru, file dapat dipratinjau atau diunduh |
| 4 | (Opsional) menulis komentar atau pertanyaan di thread | Komentar terkirim, intern mendapat notifikasi |
| 5a | Klik **Accept** | Status menjadi **Done**. Intern menerima notifikasi |
| 5b | Klik **Revise**, isi komentar revisi | Status kembali ke **In Progress**. Intern menerima notifikasi berisi komentar |

Accept dan Revise juga dapat dilakukan dari Kanban dengan menyeret kartu dari kolom In Review (lihat 7.2).

### 8.2 Layar detail Task

```
+--------------------------------------------------------------+
| Task: Laporan API                              Status: In Review |
| Intern: Rina Wulandari       Tenggat: 11 Okt 17:00 [Terlambat] |
| Dikumpulkan: 12 Okt 08:30 (terlambat 15 jam)                 |
|                                                              |
| DESKRIPSI                                                    |
| Susun laporan pengujian endpoint API login dan absensi.      |
|                                                              |
| HASIL KUMPULAN                                               |
| Link : https://drive.example.com/laporan-api   [Buka]        |
| File : laporan_api.pdf (1,2 MB)    [Pratinjau] [Unduh]       |
|                                                              |
| KOMENTAR                                                     |
| Bu Sari (10 Okt 09:00)                                       |
|   Tolong sertakan contoh respons error.                      |
|   Rina W. (12 Okt 08:31)                                     |
|     Sudah ditambahkan di bagian 3, Bu.                       |
| [ Tulis komentar...                              ] [Kirim]   |
|                                                              |
|                     [ Revise ]        [ Accept ]             |
+--------------------------------------------------------------+
```

### 8.3 Dialog Revise

```
+--------------------------------------------------+
| Revise Task - Laporan API                        |
| Task akan kembali ke In Progress dan intern      |
| diberi tahu.                                     |
|                                                  |
| Komentar revisi *                                |
| [____________________________________________]   |
|                                                  |
|                  [ Batal ]  [ Kirim Revisi ]     |
+--------------------------------------------------+
```

- Komentar revisi **wajib diisi**, supaya intern tahu apa yang diperbaiki. **[Usulan]**
- Dialog Accept hanya konfirmasi singkat. Komentar pada Accept bersifat opsional. **[Usulan]**

### 8.4 Aturan komentar

- Komentar berupa **thread dua arah seperti GitHub**: mentor dan intern saling membalas. **[Keputusan]**
- Komentar yang belum dibaca menampilkan indikator pada kartu Task dan notifikasi di bell. **[Keputusan]**
- Komentar yang sudah terkirim tidak dapat diedit atau dihapus oleh siapa pun, agar jejak diskusi tetap utuh. **[Usulan]**

### 8.5 Aturan pengumpulan ulang

- Pengumpulan ulang oleh intern **menggantikan** hasil sebelumnya. File lama dihapus, **tanpa riwayat versi**. **[Keputusan]** Mentor hanya melihat hasil terbaru.
- Karena tidak ada riwayat versi, komentar revisi menjadi satu-satunya jejak tentang apa yang pernah diminta. Itu alasan komentar revisi diwajibkan. **[Usulan berdasar keputusan di atas]**
- Pengumpulan menerima **link dan unggah file**. **[Keputusan]** Batas ukuran file belum diputuskan (2 MB atau 10 MB), dibahas dengan tim.

### 8.6 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Task terlambat dikumpulkan | Tetap tampil di In Review dengan tanda Terlambat. Mentor memutuskan Accept atau Revise. **[Keputusan]** |
| Intern mengumpulkan ulang saat mentor sedang membuka detail | Pesan "Hasil baru dikumpulkan. Muat ulang." Hasil lama sudah digantikan |
| Intern sudah **Nonaktif** | Mentor tetap bisa membuka dan menekan **Accept**. Saat menekan **Revise**, sistem memperingatkan: "Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi." Tombol tetap bisa dipakai untuk mencatat komentar, tetapi tidak ada tindak lanjut dari intern. **[Keputusan]** soal mentor masih bisa memeriksa, **[Usulan]** soal peringatannya |
| Link hasil tidak dapat dibuka | Mentor menulis komentar dan menekan **Revise**. Sistem tidak memeriksa tautan otomatis. **[Usulan]** |
| Task berstatus Done | Layar hanya baca, tombol Accept dan Revise hilang. Komentar tambahan tidak dibuka lagi. **[Usulan]** |

---

## 9. Alur 7 - Memproses Izin

**Tujuan:** menyetujui atau menolak pengajuan izin intern bimbingan.
**Halaman:** Izin.
**Aturan:**
- Jenis izin hanya **Izin Sakit** dan **Izin Urgent**. Intern tidak memiliki cuti. **[Keputusan]**
- Pengajuan wajib lewat web dan dapat disertai lampiran bukti (misalnya surat dokter). **[Keputusan]**
- Izin lebih dari 2 hari dihitung berdasarkan hari kerja sesuai kalender kerja. **[Keputusan]**
- Izin yang disetujui otomatis mengubah status absensi pada hari terkait. **[Keputusan]**
- Mentor memproses lebih dulu. Jika izin Pending lebih dari 24 jam, muncul pengingat di dashboard admin. Admin dapat memprosesnya hanya bila ada surat resmi atau bukti. **[Keputusan]**

### 9.1 Langkah

| No | Langkah Mentor | Respons sistem |
|---|---|---|
| 1 | Menerima notifikasi di bell, atau melihat kotak "Izin pending" di Dashboard | Daftar izin tampil, yang Pending diberi penanda |
| 2 | Membuka satu pengajuan | Detail dan lampiran tampil |
| 3 | Memeriksa alasan dan lampiran | - |
| 4 | Mengisi catatan, klik **Setujui** atau **Tolak** | Status berubah |
| 5 | - | Jika disetujui: status absensi pada hari kerja yang tercakup berubah menjadi **Izin**, kalender izin diperbarui. Intern menerima notifikasi berisi hasil dan catatan |

### 9.2 Layar daftar

```
+------------------------------------------------------------------------+
| Izin                                                                   |
| Tab: [Pending (2)] [Semua]       Jenis: [Semua v]  Intern: [Semua v]   |
|                                                                        |
| Intern    Jenis   Tanggal       Hari kerja Bukti  Status   Aksi        |
| Andi P.   Sakit   13-14 Okt     2          Ada    Pending  [Buka]      |
|                                       diajukan 14 jam lalu             |
| Dewi S.   Urgent  13 Okt        1          Tidak  Pending  [Buka]      |
|                                       ! pending 26 jam                 |
| Doni A.   Sakit   5 Okt         1          Ada    Disetujui [Lihat]    |
| Rina W.   Urgent  2 Okt         1          Tidak  Dibatalkan [Lihat]   |
+------------------------------------------------------------------------+
```

Pengajuan diurutkan dari yang paling lama pending. **[Usulan]**

### 9.3 Layar detail dan keputusan

```
+--------------------------------------------------------------+
| Izin - Andi Pratama                              Status: Pending |
| Jenis: Sakit                                                 |
| Tanggal: 13-14 Okt 2026 (2 hari kerja)                       |
| Alasan: "Demam, disarankan istirahat dokter."                |
|                                                              |
| Lampiran: surat_dokter.pdf     [Pratinjau] [Unduh]           |
|                                                              |
| Catatan *  [_______________________________________]         |
|                                                              |
|                       [ Tolak ]        [ Setujui ]           |
+--------------------------------------------------------------+
```

### 9.4 Aturan dan kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Pengajuan tanpa lampiran | Mentor tetap boleh menyetujui atau menolak. Detail menampilkan label "Tanpa bukti" agar mentor menimbang sendiri. Syarat bukti resmi hanya berlaku bagi admin saat memproses izin yang menggantung. **[Usulan berdasar keputusan syarat bukti untuk admin]** |
| Catatan kosong | Tombol Setujui dan Tolak tidak aktif. Pesan: "Catatan wajib diisi." **[Usulan, sama dengan sisi admin]** |
| Intern membatalkan saat mentor membuka detail | Status menjadi **Dibatalkan**, tombol keputusan hilang. Pesan: "Pengajuan ini sudah dibatalkan intern." **[Keputusan]** soal intern boleh membatalkan, **[Usulan]** soal pesan |
| Admin memproses saat mentor membuka detail | Layar menjadi hanya baca. Pesan: "Izin ini sudah diproses oleh admin." |
| Izin yang sudah diputuskan | Layar hanya baca. Mentor tidak bisa mengubah keputusan sendiri. Jika salah, intern mengajukan izin baru atau menghubungi admin untuk kasus khusus. **[Usulan]** |
| Izin mencakup hari non-kerja | Sabtu, Minggu, dan libur tidak dihitung dalam jumlah hari kerja dan tidak berubah status absensinya. **[Keputusan]** |
| Izin tumpang tindih dengan izin lain dari intern yang sama | Sistem menolak pengajuan baru di sisi intern. Mentor tidak perlu menangani ini. **[Usulan]** |

Mentor tidak dapat membuka riwayat Warning intern. **[Keputusan]**

---

## 10. Alur 8 - Kalender Izin

**Tujuan:** mentor melihat siapa saja yang izin pada tanggal berapa, untuk menyusun pembagian Task dan jadwal.
**Halaman:** Kalender Izin.
**Aturan:** izin **terdeteksi otomatis** di kalender, dengan **status tambahan setelah izin disetujui**. **[Keputusan]** Kalender mengikuti jam dan kalender kerja (Sabtu, Minggu, dan libur ditandai). **[Keputusan]**

### 10.1 Layar

```
+------------------------------------------------------------------------+
| Kalender Izin          < Oktober 2026 >         Intern: [Semua v]      |
|                                                                        |
|  Sen     Sel     Rab     Kam     Jum     Sab     Min                   |
|  5       6       7       8       9       10      11                    |
|  Doni(S)                                 libur   libur                 |
|  12      13      14      15      16      17      18                    |
|          Andi(S) Andi(S)                                               |
|          Dewi(U)                                                       |
|                                                                        |
|  Keterangan:                                                           |
|   [Penuh]  Izin Disetujui    [Garis tepi]  Izin Pending                |
|   (S) = Sakit   (U) = Urgent                                           |
+------------------------------------------------------------------------+
```

### 10.2 Perilaku

| Hal | Perilaku |
|---|---|
| Izin yang baru diajukan | Langsung muncul di kalender dengan tampilan **Pending** (garis tepi). Tidak perlu diinput manual |
| Izin yang disetujui | Tampilan berubah menjadi **Disetujui** (warna penuh) dan bertambah status tambahan "Izin" pada tanggal itu |
| Izin yang ditolak atau dibatalkan | Hilang dari kalender |
| Klik pada entri | Muncul ringkasan (intern, jenis, tanggal) dan tautan **Buka izin** |
| Hari libur dan akhir pekan | Diberi warna abu-abu dan tidak berisi entri izin |

Izin **Pending ikut tampil** di kalender (garis tepi) dan berubah menjadi warna penuh setelah disetujui. **[Usulan, diikuti]**

### 10.3 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Tidak ada izin pada bulan itu | "Tidak ada izin pada bulan ini." |
| Beberapa intern izin di tanggal yang sama | Entri ditumpuk, bila lebih dari 3 ditampilkan "+N lagi" yang dapat diklik |

---

## 11. Alur 9 - Performa Intern (Rekap Kehadiran dan KPI)

**Tujuan:** memberi mentor gambaran kinerja intern bimbingan, tanpa penilaian atau skor.
**Halaman:** Performa Intern.
**Aturan:** mentor memiliki menu **"Performa Intern"** dengan dashboard sendiri berisi **rekap kehadiran dan KPI**. **[Keputusan]** Tidak ada fitur penilaian (grading) intern. **[Keputusan]** Tidak ada export untuk mentor. **[Keputusan]**

### 11.1 Layout

```
+------------------------------------------------------------------------+
| Performa Intern                                                        |
| Periode: [Oktober 2026 v]       Intern: [Semua intern saya v]          |
|                                                                        |
| RINGKASAN                                                              |
| [Kehadiran]      [Task tepat waktu]   [Daily Report]                   |
|   92%                78%                 95%                           |
|                                                                        |
| REKAP KEHADIRAN                                                        |
| Intern        Hadir  Izin  Tidak Hadir  Lupa Clock Out  Hari kerja     |
| Andi P.       18     2     0            1               21             |
| Rina W.       17     1     2            1               21             |
| Doni A.       20     0     0            1               21             |
|                                                                        |
| KPI PER INTERN                                                         |
| Intern    Kehadiran   Task tepat waktu   Daily Report   Task Revise    |
| Andi P.   90%         80% (8/10)         95%            2              |
| Rina W.   85%         70% (7/10)         90%            4              |
+------------------------------------------------------------------------+
```

### 11.2 Isi tiap bagian

| Bagian | Isi | Status keputusan |
|---|---|---|
| Rekap kehadiran | Jumlah Hadir, Izin, Tidak Hadir, Lupa Clock Out, dan hari kerja per intern pada periode terpilih | **[Keputusan]** |
| KPI | Indikator kinerja per intern | Dasar KPI mengikuti 11.3. **[Usulan, diikuti]** |
| Filter | Periode (bulan) dan intern | **[Usulan]** |

### 11.3 Dasar KPI (mengikuti usulan)

Dasar KPI yang dipakai adalah empat indikator berikut. Rumus dapat disesuaikan bila kebijakan perusahaan berbeda.

| Indikator | Cara menghitung (usulan) | Catatan |
|---|---|---|
| Kehadiran | Hari Hadir dibagi hari kerja dalam periode. Hari Izin yang disetujui tidak dihitung sebagai ketidakhadiran | Memakai status otomatis sistem |
| Task tepat waktu | Task Done yang dikumpulkan sebelum tenggat dibagi seluruh Task yang tenggatnya jatuh pada periode | Task terlambat tetap dihitung, hanya tidak "tepat waktu" |
| Kelengkapan Daily Report | Hari Hadir dengan Daily Report terkirim dibagi hari Hadir | Daily Report wajib sebelum clock out, jadi angka rendah menandakan data tidak lengkap |
| Jumlah Revise | Berapa kali Task dikembalikan | Informasi saja, bukan nilai |

Aturan umum:
- Angka KPI bersifat **informasi pemantauan**, bukan nilai akhir dan bukan penilaian intern. **[Keputusan]** soal tidak ada grading, **[Usulan]** soal penegasan ini pada layar.
- Intern dengan data kurang dari satu minggu menampilkan "Data belum cukup" alih-alih persentase. **[Usulan]**
- Sabtu, Minggu, dan hari libur tidak dihitung. **[Keputusan]**
- Pada layar ditampilkan catatan kecil: "KPI hanya untuk pemantauan dan bukan nilai intern."

### 11.4 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Mentor belum punya intern | "Belum ada data. Hubungi admin untuk penugasan intern." |
| Periode belum ada data | "Belum ada data pada periode ini." |
| Intern nonaktif | Tetap tampil pada periode yang ia ikuti, diberi label "Nonaktif" |

---

## 12. Alur 10 - Chat dan Notifikasi

### 12.1 Chat

- Semua pengguna dapat saling chat. **[Keputusan]** Mentor bisa chat dengan intern bimbingan, intern lain, mentor lain, dan admin.
- Admin tidak bisa membaca chat orang lain. **[Keputusan]**
- Ada notifikasi untuk pesan baru. **[Keputusan]**
- Chat dipakai juga ketika admin menanyakan perpanjangan magang. **[Keputusan]**

```
+--------------------------------------------------------------+
| Chat                                                         |
| Cari kontak: [__________]                                    |
|                                                              |
| Admin Sinta        Halo Bu Sari, masa magang Rina...  (1)    |
| Andi Pratama       Baik Bu, sudah saya kerjakan.              |
| Rina Wulandari     ...                                       |
+--------------------------------------------------------------+
```

### 12.2 Notifikasi (bell icon)

Tidak ada halaman notifikasi terpisah, cukup bell icon di navbar. **[Keputusan]** Klik item membawa langsung ke layar terkait. Daftar kejadian ada pada Bagian 14.

---

## 13. Situasi Khusus

### 13.1 Ganti mentor oleh admin

Admin dapat mengganti mentor seorang intern. Task, komentar, dan izin pending intern itu ikut pindah ke mentor baru, dan riwayat lama tetap tersimpan. **[Keputusan]**

| Sisi | Yang dialami |
|---|---|
| **Mentor baru** | Intern muncul di Intern Saya. Task aktif, komentar, dan izin pending muncul di Task dan Izin. Menerima notifikasi "Intern [nama] kini menjadi bimbingan Anda." |
| **Mentor lama** | Intern hilang dari daftar aktif. Task aktif dan izin pending berpindah ke mentor baru. Riwayat lama (Task Done dan izin yang sudah diproses) tetap tersimpan di sistem. **[Keputusan]** Menerima notifikasi "Intern [nama] tidak lagi menjadi bimbingan Anda." |
| **Intern** | Menerima notifikasi pergantian mentor. Tidak ada perubahan pada data Task |

Tampilan untuk mentor lama: intern masih dapat dilihat **hanya baca** lewat filter "Pernah dibimbing" di Intern Saya, untuk riwayat yang pernah ia tangani. **[Usulan, diikuti]**

Jika mentor lama sedang memeriksa Task saat pergantian terjadi, tombol keputusannya nonaktif dan muncul pesan "Intern ini sudah dipindahkan ke mentor lain."

### 13.2 Intern nonaktif

- Intern nonaktif tidak bisa login atau clock in. Datanya tetap dapat dilihat mentor dan admin. **[Keputusan]**
- Mentor tetap bisa memeriksa Task yang sudah dikumpulkan sebelum nonaktif. **[Keputusan]**
- Revise tidak dapat ditindaklanjuti intern karena tidak bisa login. Hal ini sudah disepakati sebagai konsekuensi alur. **[Keputusan]** Sistem memberi peringatan saat mentor menekan Revise (lihat 8.6).
- Task baru tidak bisa dibuat untuk intern nonaktif. **[Usulan]**
- Izin dari intern nonaktif tidak dapat diajukan lagi. **[Usulan]**

### 13.3 Magang segera berakhir

- Admin menampilkan pengingat 7 hari sebelum magang berakhir, lalu bertanya ke mentor lewat chat apakah intern diperpanjang. **[Keputusan]**
- Mentor menjawab di chat. Mentor **tidak** mengubah tanggal selesai, itu dilakukan admin. **[Keputusan]**
- Jika tidak diperpanjang, akun intern otomatis nonaktif pada tanggal tersebut. **[Keputusan]**
- Saran: sebelum tanggal berakhir, mentor sebaiknya memeriksa semua Task berstatus In Review agar tidak ada yang menggantung. **[Usulan, bukan fitur sistem]** Dashboard sudah menampilkan daftarnya.

### 13.4 Admin memproses izin yang menggantung

Jika mentor tidak merespons izin Pending selama lebih dari 24 jam, admin dapat memprosesnya, hanya bila ada surat resmi atau bukti. **[Keputusan]** Dari sisi mentor: izin tersebut hilang dari daftar Pending dan masuk daftar **Semua** dengan keterangan "Diproses oleh admin". Mentor menerima notifikasi.

---

## 14. Notifikasi Mentor (Bell Icon)

Tidak ada halaman notifikasi terpisah, cukup bell icon di navbar. **[Keputusan]** Klik item membawa langsung ke layar terkait. Deteksi anomali tidak dibuat. **[Keputusan]**

| Kejadian | Isi notifikasi | Tujuan klik |
|---|---|---|
| Intern mengumpulkan hasil Task | "Rina W. mengumpulkan Task 'Laporan API'." | Detail Task |
| Intern membalas komentar Task | "Rina W. membalas komentar di 'Laporan API'." | Thread komentar |
| Intern mengajukan izin | "Andi P. mengajukan Izin Sakit 13-14 Okt." | Detail izin |
| Intern membatalkan izin Pending | "Andi P. membatalkan pengajuan izin 13-14 Okt." | Daftar izin |
| Task lewat tenggat lebih dari 2 hari kerja tanpa dikumpulkan | "Task 'Dokumen' milik Budi K. lewat tenggat lebih dari 2 hari kerja." | Detail Task |
| Intern mengganti hasil Task yang sedang In Review | "Rina W. mengganti hasil Task 'Laporan API'." | Detail Task |
| Admin memproses izin yang menggantung | "Izin Dewi S. diproses oleh admin." | Detail izin |
| Pergantian mentor (masuk atau keluar) | "Intern [nama] kini menjadi bimbingan Anda." atau "tidak lagi menjadi bimbingan Anda." | Intern Saya |
| Pesan chat baru | "Pesan baru dari Admin Sinta." | Chat |
| Pengumuman dari admin untuk role Mentor | Judul pengumuman | Isi pengumuman |

Aturan:
- Mentor **tidak** menerima notifikasi untuk koreksi absensi (diurus admin) dan warning (hanya admin). **[Keputusan]**
- Pengingat tenggat Task hanya dikirim jika benar-benar berdampak besar. **[Keputusan]** Satu-satunya pengingat adalah Task lewat tenggat lebih dari 2 hari kerja tanpa dikumpulkan (lihat 7.6).
- Pengumuman muncul bila admin memilih role Mentor sebagai penerima. **[Keputusan]**

---

## 15. Aturan Tampilan

### 15.1 Status dan warna

Warna tidak boleh menjadi satu-satunya penanda. Selalu sertakan teks pada badge. Warna yang sama dipakai di seluruh role.

| Status | Dipakai untuk | Warna (usulan) |
|---|---|---|
| Hadir | Absensi | Hijau (#2E7D32) |
| Izin | Absensi | Biru (#1565C0) |
| Tidak Hadir | Absensi | Merah (#C62828) |
| Lupa Clock Out | Absensi | Oranye (#EF6C00) |
| Libur | Absensi, kalender | Abu-abu (#757575) |
| Dikoreksi admin | Label kecil pada absensi | Abu-abu gelap |
| To Do | Task | Abu-abu (#757575) |
| In Progress | Task | Biru (#1565C0) |
| In Review | Task | Kuning (#F9A825) |
| Done | Task | Hijau (#2E7D32) |
| Terlambat | Tanda pada Task | Merah (#C62828) |
| Pending | Izin | Kuning (#F9A825) |
| Disetujui | Izin | Hijau (#2E7D32) |
| Ditolak | Izin | Merah (#C62828) |
| Dibatalkan | Izin | Abu-abu (#757575) |
| Aktif | Akun intern | Hijau |
| Nonaktif | Akun intern | Abu-abu |

### 15.2 Format

- Tanggal: "Sen, 12 Okt 2026". Waktu: 24 jam, misalnya 17:00. Zona waktu mengikuti perusahaan.
- Lama pending izin dan keterlambatan Task ditulis dalam jam atau hari, misalnya "26 jam" atau "lewat 2 hari".
- Tombol utama (Simpan, Setujui, Accept, Kirim) di kanan bawah. Tombol batal atau tolak di sebelah kirinya.
- Istilah status dan nama tombol memakai bahasa yang sama di seluruh sistem (Accept, Revise, Setujui, Tolak). **[Usulan]**

### 15.3 Kondisi layar

| Kondisi | Tampilan |
|---|---|
| Memuat | Kerangka abu-abu atau indikator loading |
| Kosong | Teks penjelas singkat, misalnya "Belum ada Task untuk intern ini." |
| Gagal | "Terjadi kesalahan. Coba lagi." dengan tombol **Coba lagi** |
| Tidak punya akses | "Anda tidak memiliki akses ke halaman ini." |

### 15.4 Dialog konfirmasi

Dipakai untuk tindakan yang berdampak: Accept Task, Revise Task, Setujui izin, Tolak izin. Isinya menjelaskan **dampaknya** dalam kalimat biasa, dan tombol konfirmasi memakai kata kerja jelas (contoh: "Kirim Revisi", bukan "OK").

### 15.5 Pesan sistem penting

| Situasi | Pesan |
|---|---|
| Berhasil disimpan | "Perubahan tersimpan." |
| Task dibuat | "Task dibuat. Intern sudah diberi tahu." |
| Accept | "Task diterima dan ditandai Done." |
| Revise | "Task dikembalikan ke intern untuk diperbaiki." |
| Data sudah diproses pihak lain | "Data ini sudah diproses oleh [nama]." |
| Intern nonaktif saat Revise | "Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi." |
| Catatan wajib kosong | "Catatan wajib diisi." |

---

## 16. Hak Akses Mentor

| Area | Mentor bisa | Mentor tidak bisa |
|---|---|---|
| Intern | Melihat intern bimbingan sendiri, termasuk yang nonaktif | Menambah, mengubah, menonaktifkan, atau mengganti mentor intern. Melihat intern mentor lain |
| Absensi | Melihat rekap dan riwayat absensi (hanya baca) | Mengubah absensi, memproses koreksi absensi |
| Daily Report | Membaca (hanya baca) | Mengedit atau mengomentari |
| Task | Membuat Task untuk satu intern, mengubah Task yang belum Done, menghapus Task To Do tanpa komentar, Accept, Revise, berkomentar, memfilter dan mengurutkan, melihat Kanban, menyeret kartu **In Review** ke Done atau In Progress | Memberi satu Task ke banyak intern sekaligus. Memberi nilai atau skor. Menyeret kartu selain dari In Review. Memindahkan kartu ke To Do |
| Izin | Menyetujui atau menolak izin intern bimbingan, melihat kalender izin | Mengubah izin yang sudah diputuskan, mengajukan izin atas nama intern |
| Performa | Melihat rekap kehadiran dan KPI intern bimbingan | Export, menjadikannya nilai intern |
| Warning | - | Melihat atau membuat (hanya admin) |
| Pengumuman | Menerima sesuai pilihan admin | Membuat, mengubah, menghapus |
| Kalender dan jam kerja | Melihat kalender izin | Mengubah jam kerja atau hari libur |
| Laporan | - | Export (hanya admin) |
| Chat | Chat dengan semua pengguna | - |
| Profil | Edit profil sendiri | Mengganti role |
| Log aktivitas | - | Melihat |

---

## 17. Keputusan Tambahan dan Hal yang Masih Terbuka

### 17.1 Keputusan tambahan (mengikuti usulan)

Per 10 Oktober 2026, usulan berikut dianggap disepakati.

| No | Topik | Keputusan |
|---|---|---|
| 1 | Login | Email internal, akun dibuat admin, tanpa Google OAuth |
| 2 | Ganti password | Tidak ada ganti password mandiri. Hanya saat login pertama dan reset oleh admin |
| 3 | Kanban | Drag and drop didukung. Mentor hanya dapat menyeret kartu In Review ke Done (Accept) atau In Progress (Revise). Tombol di detail Task tetap tersedia |
| 4 | Dasar KPI | Kehadiran, Task tepat waktu, kelengkapan Daily Report, dan jumlah Revise (informasi saja). Rumus di 11.3 |
| 5 | Menghapus Task | Hanya jika masih To Do dan belum ada komentar |
| 6 | Lampiran referensi, prioritas, label pada Task | Tidak termasuk cakupan versi ini |
| 7 | Pengingat tenggat | Hanya untuk Task lewat tenggat lebih dari 2 hari kerja tanpa dikumpulkan, sekali per Task |
| 8 | Izin Pending di Kalender Izin | Tampil dengan garis tepi, penuh setelah disetujui |
| 9 | Izin tanpa lampiran | Mentor boleh memproses dengan label "Tanpa bukti". Syarat bukti hanya untuk admin |
| 10 | Catatan pada keputusan | Komentar revisi wajib. Catatan wajib pada keputusan izin |
| 11 | Mentor lama setelah pergantian | Intern dapat dilihat hanya baca lewat filter "Pernah dibimbing" |
| 12 | Komentar | Tidak bisa diedit atau dihapus. Thread terkunci saat Task Done |

### 17.2 Hal yang masih terbuka (menyentuh backend)

| No | Topik | Keterangan |
|---|---|---|
| 1 | Batas ukuran file hasil Task | 2 MB atau 10 MB, dibahas dengan tim. Berdampak pada pratinjau dan unduh di layar periksa Task |
| 2 | Jenis file yang diizinkan | Untuk hasil Task. Usulan awal: PDF, DOCX, XLSX, PPTX, JPG, PNG |
| 3 | Rincian validasi lokasi clock in | Metode sudah diputuskan, rincian pada tahap teknis. Memengaruhi label "Dikoreksi admin" di rekap absensi |

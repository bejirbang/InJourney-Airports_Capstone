# design-intern.md - Desain Role Intern (Lengkap, Berdasarkan Alur)

Sistem: Web Intern Management dan Attendance System
Versi: Draft 3 | Tanggal: 24 Oktober 2026 | Acuan: PRD, design-mentor.md (Draft 2), design-admin.md (Draft 3), Arsitektur Backend & Desain Data (Versi 2)

Perubahan Draft 3 (hasil wawancara mitra 22 Oktober 2026):
- Istilah **Absensi diganti Presensi** di seluruh sistem.
- **Task, Kanban, dan komentar Task dihapus.** Daily Report menjadi **Logbook** yang direview mentor (Disetujui atau Revisi).
- Status presensi baru: **Terlambat** (toleransi 15 menit) dan **Lupa Clock In**. Lupa Clock Out menjadi tanda terpisah.
- Jam kerja mengikuti **jadwal lokasi magang** (per hari dan jadwal khusus).
- **Koreksi presensi dua tahap**: mentor memvalidasi, admin mengeksekusi. Tanpa bukti.
- **Upload file dihapus.** Bukti izin dan presentasi memakai link Google Drive/Docs.
- **Kuota izin 3 kali** per masa magang, pengajuan ke-4 diblokir.
- Fitur baru: **Presentasi Akhir** (H-7) dan melihat **Catatan Warning**.
- Dashboard lebih ringkas, kartu bisa diklik, minim klik ("one touch point"), dan nyaman di ponsel.

Tanda:
- **[Keputusan]** = sudah disepakati (PRD, percakapan, atau wawancara mitra).
- **[Usulan]** = pilihan desain dari saya, diikuti kecuali tercantum di Bagian 20.

---

## 1. Cara Membaca Dokumen Ini

Dokumen disusun menurut **alur kerja Intern**. Tiap alur berisi tujuan, langkah, sketsa layar, aturan, dan kondisi khusus.

Isi:
1. Cara membaca
2. Gambaran Intern dan navigasi
3. Alur 1 - Login pertama dan profil
4. Alur 2 - Dashboard
5. Alur 3 - Clock in
6. Alur 4 - Mengisi logbook harian
7. Alur 5 - Clock out
8. Alur 6 - Riwayat presensi dan rekap bulanan
9. Alur 7 - Koreksi presensi
10. Alur 8 - Logbook: riwayat dan revisi
11. Alur 9 - Izin
12. Alur 10 - Presentasi akhir
13. Alur 11 - Catatan warning dan nilai akhir
14. Alur 12 - Chat dan notifikasi
15. Situasi khusus
16. Notifikasi Intern
17. Aturan tampilan
18. Hak akses Intern
19. Ringkasan keputusan
20. Hal yang masih terbuka

---

## 2. Gambaran Intern dan Navigasi

**Peran:** Intern melakukan presensi, mengisi logbook harian, mengajukan izin dan koreksi presensi, serta mengirim bukti presentasi akhir. **[Keputusan]**

**Relasi:** satu intern tepat satu mentor, dan punya satu **lokasi magang** yang menentukan jadwal kerjanya. **[Keputusan]** Intern hanya melihat data miliknya sendiri.

**Platform:** web responsif. Presensi paling sering dilakukan dari ponsel, jadi semua halaman Intern dirancang **mobile first**. Di ponsel sidebar menjadi **menu bawah**. **[Keputusan]**

**Prinsip "one touch point":** aksi harian (clock in, isi logbook, clock out) bisa diselesaikan langsung dari Dashboard tanpa pindah halaman. **[Keputusan]**

### 2.1 Kerangka halaman

Desktop:

```
+------------------------------------------------------------------------+
| [Logo]  Nama Sistem                         [Chat] [Bell 2] [Intern v] |
+------------------+-----------------------------------------------------+
| Dashboard        |                                                     |
| Presensi         |                                                     |
| Logbook (1)      |              AREA KONTEN HALAMAN                    |
| Izin             |                                                     |
| Presentasi Akhir |                                                     |
| Catatan          |                                                     |
+------------------+-----------------------------------------------------+
```

Ponsel:

```
+------------------------------+
| [Logo]       [Chat] [Bell 2] |
|                              |
|      AREA KONTEN HALAMAN     |
|                              |
+------------------------------+
| Beranda Presensi Logbook Izin Lainnya |
+------------------------------+
```

Menu **Lainnya** berisi Presentasi Akhir, Catatan, Profil, dan Keluar. **[Usulan]**

### 2.2 Menu

| Menu | Isi | Alamat (usulan) |
|---|---|---|
| Dashboard | Kartu hari ini, rekap bulan ini, hal yang perlu ditindak | /intern/dashboard |
| Presensi | Tab Hari Ini, Riwayat, Koreksi | /intern/attendance |
| Logbook | Daftar logbook, revisi, logbook belum diisi | /intern/logbooks |
| Izin | Ajukan izin, sisa kuota, riwayat | /intern/leaves |
| Presentasi Akhir | Kirim link bukti presentasi | /intern/presentation |
| Catatan | Catatan warning dari admin (hanya baca) dan nilai akhir | /intern/notes |

Angka di sebelah Logbook adalah jumlah logbook yang perlu ditindak (Revisi atau belum diisi).

Menu yang **tidak ada**: Task (dihapus), Laporan, Pengaturan, Log Aktivitas, Pengumuman (hanya menerima), Performa.

---

## 3. Alur 1 - Login Pertama dan Profil

**Latar:** akun dibuat admin dengan **email internal** dan password sementara. Tidak ada Google OAuth. **[Keputusan]**

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Menerima email dan password sementara dari admin | - |
| 2 | Login | Sistem meminta ganti password |
| 3 | Mengisi password baru | Masuk ke Dashboard |
| 4 | (Opsional) membuka Profil | Melihat data diri, mengubah nomor telepon |

### 3.1 Layar Login

```
+----------------------------------------------+
|  Masuk                                       |
|  Email internal  [____________________]      |
|  Password        [____________________] (mata)|
|                          [ Masuk ]           |
|  Lupa password? Hubungi admin.               |
+----------------------------------------------+
```

| Situasi | Pesan |
|---|---|
| Email atau password salah | "Email atau password salah." |
| Terlalu banyak percobaan | "Terlalu banyak percobaan. Coba lagi dalam 1 menit." **[Usulan, keamanan]** |
| Akun nonaktif | "Akun Anda tidak aktif. Hubungi admin." |
| Masa magang belum dimulai | "Masa magang Anda belum dimulai." |

### 3.2 Profil

```
+--------------------------------------------------+
| Profil                                           |
|  (AP)  Andi Pratama                              |
|        andi@injourney.id                         |
|                                                  |
| Unit            : Divisi IT                      |
| Lokasi magang   : Soekarno-Hatta Terminal 3      |
| Universitas     : Telkom University              |
| Jurusan         : Sistem Informasi               |
| Mentor          : Bu Sari                        |
| Periode magang  : 1 Sep - 31 Des 2026            |
| No. telepon     [0812xxxxxxx]        [Simpan]    |
+--------------------------------------------------+
```

- Avatar memakai **inisial nama**, tidak ada unggah foto karena sistem tidak menyimpan file. **[Keputusan: upload file dihapus]**
- Intern hanya mengubah nomor telepon. Data lain diubah admin. **[Usulan]**
- Tidak ada ganti password mandiri. Lupa password: hubungi admin. **[Keputusan]**

---

## 4. Alur 2 - Dashboard

**Tujuan:** semua yang perlu dilakukan hari ini ada di satu layar.

### 4.1 Layout (ponsel)

```
+--------------------------------------+
| Halo, Andi           Sen, 12 Okt 2026|
|                                      |
| ! Presentasi akhir: kirim bukti      |
|   sebelum 31 Des.        [Kirim]     |
|                                      |
| +----------------------------------+ |
| | HARI INI   Jadwal 08:00 - 17:00  | |
| | Status: Belum Clock In           | |
| |        [   CLOCK IN   ]          | |
| +----------------------------------+ |
|                                      |
| PERLU DITINDAK                       |
| > 1 logbook perlu direvisi           |
| > 1 logbook belum diisi (9 Okt)      |
| > Warning baru dari admin            |
|                                      |
| REKAP OKTOBER 2026                   |
| [Hadir 8] [Terlambat 1] [Izin 1]     |
| [Lupa Clock In 0] [Tidak Hadir 0]    |
| Sisa kuota izin: 2 dari 3            |
|                                      |
| PENGUMUMAN                           |
| Besok WFA, presensi tetap wajib.     |
+--------------------------------------+
```

Di desktop, isi yang sama disusun dua kolom.

### 4.2 Aturan tiap bagian

| Bagian | Isi | Aturan |
|---|---|---|
| Banner presentasi | Muncul mulai H-7 sebelum magang berakhir sampai presentasi disetujui | **[Keputusan]** Klik membuka Presentasi Akhir |
| Kartu Hari Ini | Jadwal hari itu, status, dan **satu tombol aksi** | Isi tombol berubah sesuai kondisi (4.3). Logbook bisa diisi dari kartu ini tanpa pindah halaman. **[Keputusan: one touch point]** |
| Perlu ditindak | Logbook revisi, logbook belum diisi, warning baru, hasil koreksi/izin baru | Tiap baris bisa diklik langsung ke itemnya. Disembunyikan jika kosong |
| Rekap bulan ini | Hadir, Terlambat, Lupa Clock In, Izin, Tidak Hadir, dan jumlah Lupa Clock Out | **Setiap kotak bisa diklik** dan membuka Riwayat yang sudah difilter status itu. **[Keputusan]** |
| Sisa kuota izin | "Sisa kuota izin: X dari 3" | **[Keputusan]** |
| Pengumuman | Pengumuman terbaru untuk Intern | **[Keputusan]** |

### 4.3 Kondisi kartu Hari Ini

| Kondisi | Tampilan |
|---|---|
| Hari kerja, sebelum jam pulang, belum clock in | "Belum Clock In" + tombol **Clock In** |
| Sudah clock in, logbook belum diisi | "Hadir sejak 08:02" + kotak logbook singkat + tombol **Simpan Logbook** |
| Sudah clock in, logbook terisi, belum jam pulang | "Hadir sejak 08:02. Clock out mulai 17:00." Tombol Clock Out nonaktif |
| Sudah jam pulang, sudah clock in | Tombol **Clock Out** |
| Sudah jam pulang, **belum clock in** | "Anda belum clock in hari ini." + tombol **Clock Out**. Hari ini akan tercatat **Lupa Clock In** |
| Sudah clock out | "Selesai. Clock out 17:03. Logbook menunggu review mentor." |
| Libur (hari libur, jadwal non-kerja kantor) | "Hari ini libur: [nama]". Tanpa tombol |
| Izin disetujui | "Izin hari ini (Sakit)". Tanpa tombol |
| Di luar periode magang | "Di luar periode magang." Tanpa tombol |

---

## 5. Alur 3 - Clock In

**Aturan:**
- Jadwal (jam masuk dan pulang) diambil dari **lokasi magang** intern: jadwal khusus jika ada, selain itu jadwal mingguan hari itu. **[Keputusan]**
- Lokasi divalidasi terhadap **radius clock in** kantor aktif mana pun. Intern boleh clock in di kantor aktif mana pun. **[Keputusan]**
- Clock in hanya pada hari kerja, dalam periode magang, dan **sebelum jam pulang**. Setelah jam pulang, yang tersedia hanya Clock Out. **[Keputusan]**

### 5.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Menekan **Clock In** di Dashboard atau Presensi | Browser meminta izin lokasi |
| 2 | - | Backend memeriksa radius |
| 3 | - | Jika sesuai: clock in tercatat. Jika lewat jam masuk + 15 menit: status **Terlambat** |
| 4 | - | Kartu berubah, kotak logbook muncul |

### 5.2 Pesan

| Situasi | Pesan |
|---|---|
| Memeriksa | "Memeriksa lokasi..." |
| Berhasil tepat waktu | "Clock in berhasil pukul 08:05." |
| Berhasil, terlambat | "Clock in berhasil pukul 08:20. Anda tercatat Terlambat 20 menit." |
| Di luar radius | "Lokasi Anda belum sesuai. Clock in belum bisa dilakukan." + **Coba lagi** |
| Belum ada kantor aktif | "Belum ada kantor aktif. Hubungi admin." |
| Akses lokasi ditolak | "Izinkan akses lokasi di browser untuk melakukan clock in." |
| Gagal membaca lokasi | "Lokasi tidak dapat dibaca. Coba lagi." |
| Koneksi terputus | "Clock in belum tercatat. Periksa koneksi lalu coba lagi." |

### 5.3 Aturan Terlambat

- Terlambat jika clock in **lewat jam masuk + toleransi 15 menit**. Contoh jadwal 08:00: clock in 08:15 masih Hadir, 08:16 Terlambat. **[Keputusan, toleransi menunggu konfirmasi mitra]**
- Lama terlambat dihitung dari jam masuk (08:16 = terlambat 16 menit). **[Usulan]**
- Terlambat adalah **status presensi** dan terlihat oleh intern, mentor, dan admin. Di rekap, Terlambat **tetap dihitung hadir**. **[Keputusan]**
- Jadwal Jumat atau jadwal khusus yang berbeda otomatis dipakai. Intern melihat jam jadwal di kartu Hari Ini.

### 5.4 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Izin hari ini masih Pending | Clock in tetap bisa. Hari itu dikeluarkan dari izin saat diproses **[Usulan]** |
| Admin menambah libur hari ini | Tombol hilang saat halaman dimuat ulang |
| Satu hari hanya satu kali clock in | Setelah berhasil, tombol Clock In hilang |

---

## 6. Alur 4 - Mengisi Logbook Harian

**Tujuan:** mencatat apa yang dikerjakan hari ini. Logbook menggantikan Daily Report dan Task. **[Keputusan]**

**Aturan:**
- Satu hari kerja = satu logbook. **[Keputusan]**
- Bisa diisi dan diubah setelah clock in, sampai clock out. **[Keputusan]**
- **Wajib terisi sebelum clock out.** Saat clock out, logbook otomatis terkirim ke mentor. **[Keputusan]**

### 6.1 Layar (di kartu Hari Ini atau tab Hari Ini)

```
+--------------------------------------------------+
| Logbook - Sen, 12 Okt 2026         Status: Draft |
|                                                  |
| Yang saya kerjakan hari ini *                    |
| [______________________________________________] |
| [______________________________________________] |
| Kendala atau catatan (opsional)                  |
| [______________________________________________] |
|                                                  |
| Terkirim otomatis ke mentor saat clock out.      |
|                               [ Simpan Logbook ] |
+--------------------------------------------------+
```

| Kolom | Aturan | Pesan |
|---|---|---|
| Yang saya kerjakan | Wajib, tidak boleh kosong atau hanya spasi | "Isi apa yang Anda kerjakan hari ini." |

| Kondisi | Perilaku |
|---|---|
| Belum clock in | Kotak logbook tidak tampil |
| Sudah clock out | Hanya baca, status Menunggu Review |
| Koneksi terputus saat simpan | "Logbook belum tersimpan. Isian Anda tidak hilang, coba lagi." |
| Hari Lupa Clock In | Logbook diisi saat menekan Clock Out (dialog muncul bila belum ada) |

---

## 7. Alur 5 - Clock Out

### 7.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Menekan **Clock Out** | Sistem memeriksa jam pulang |
| 2a | Sebelum jam pulang | Ditolak: "Belum saatnya clock out, tunggu 45 menit lagi." **[Keputusan]** |
| 2b | Logbook belum diisi | Dialog logbook terbuka. Setelah disimpan, proses clock out berlanjut **[Usulan: one touch point]** |
| 3 | - | Lokasi diperiksa terhadap **radius clock out** kantor aktif mana pun |
| 4 | - | Clock out tercatat. Logbook berubah menjadi **Menunggu Review** dan mentor diberi tahu |

### 7.2 Clock out tanpa clock in (Lupa Clock In)

- Jika intern belum clock in dan sudah lewat jam pulang, tombol Clock Out tetap tersedia. **[Keputusan]**
- Sebelum menekan, tampil peringatan: "Anda belum clock in hari ini. Hari ini akan tercatat Lupa Clock In. Ajukan koreksi presensi jika perlu."
- Hari itu berstatus **Lupa Clock In** dan **tetap dihitung hadir**. **[Keputusan]**
- Logbook tetap wajib diisi.

### 7.3 Aturan lain

- Pulang lebih awal tidak bisa clock out. Hari itu menjadi Lupa Clock Out dan diperbaiki lewat koreksi presensi. **[Keputusan]**
- Jika sampai 23:59 tidak clock out, muncul tanda **Lupa Clock Out**. Logbook hari itu tetap **Draft** dan tidak terkirim. Intern mengajukan koreksi presensi, lalu setelah disetujui logbook bisa dikirim (Alur 8). **[Usulan]**
- Setelah clock out, tidak ada clock in kedua pada hari yang sama.

| Situasi | Pesan |
|---|---|
| Di luar radius clock out | "Lokasi Anda belum sesuai. Clock out belum bisa dilakukan." |
| Berhasil | "Clock out berhasil pukul 17:03. Logbook terkirim ke mentor." |

---

## 8. Alur 6 - Riwayat Presensi dan Rekap Bulanan

**Halaman:** Presensi, tab **Riwayat**.

```
+------------------------------------------------------------------------+
| Presensi   [Hari Ini] [Riwayat] [Koreksi]                              |
| Bulan: [< Oktober 2026 >]   Status: [Semua v]                          |
|                                                                        |
| Hadir 8 | Terlambat 1 | Lupa Clock In 0 | Izin 1 | Tidak Hadir 1       |
| Lupa Clock Out: 1 kali | Hari kerja: 12                                |
|                                                                        |
| Tanggal      Masuk  Pulang  Status        Catatan          Aksi       |
| Jum, 9 Okt   08:02  17:00   Hadir         Dikoreksi                   |
| Kam, 8 Okt   08:20  17:05   Terlambat     20 menit         [Koreksi]  |
| Rab, 7 Okt   -      -       Izin          Izin Sakit                  |
| Sel, 6 Okt   08:00  -       Hadir         Lupa Clock Out   [Koreksi]  |
| Sen, 5 Okt   -      -       Tidak Hadir                    [Koreksi]  |
| Sab, 3 Okt   Libur                                                     |
+------------------------------------------------------------------------+
```

- Status dihitung otomatis dengan batas 23:59. **[Keputusan]**
- Kolom Catatan menampilkan tanda **Lupa Clock Out**, lama Terlambat, jenis izin, dan label **Dikoreksi**. **[Keputusan]**
- Tombol **Koreksi** muncul pada hari kerja yang sudah lewat dengan status Terlambat, Lupa Clock In, Tidak Hadir, atau tanda Lupa Clock Out. **[Keputusan: semua kasus bisa dikoreksi]**
- Filter Status dipakai juga saat intern mengklik kotak rekap di Dashboard.
- Hari libur menurut jadwal lokasi magang tampil sebagai Libur dan tidak dihitung hari kerja.

---

## 9. Alur 7 - Koreksi Presensi

**Tujuan:** memperbaiki presensi yang salah. **[Keputusan]**

**Alur dua tahap:**
1. Intern mengajukan: tanggal + alasan. **Tanpa bukti.**
2. **Mentor** memvalidasi: ACC atau tolak. ACC mentor menjadi buktinya.
3. Jika di-ACC, pengajuan masuk ke **admin**, yang mengeksekusi perubahan.
4. Hasil disetujui: status hari itu menjadi **Hadir**, jam yang kosong diisi jam jadwal, ditandai **Dikoreksi**.

Admin menunggu mentor, tidak ada eskalasi otomatis. **[Keputusan]**

### 9.1 Langkah

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Klik **Koreksi** di baris Riwayat, atau **Ajukan Koreksi** | Formulir terbuka dengan tanggal dan kondisi terisi |
| 2 | Mengisi alasan, klik **Kirim** | Status **Menunggu Mentor**. Mentor diberi tahu |
| 3 | Mentor menolak | Status **Ditolak Mentor** + catatan. Selesai |
| 4 | Mentor ACC | Status **Menunggu Admin**. Admin diberi tahu |
| 5 | Admin menyetujui | Status **Disetujui**. Presensi menjadi Hadir (Dikoreksi). Jika hari itu belum punya logbook, muncul di daftar "Logbook belum diisi" |
| 6 | Admin menolak | Status **Ditolak Admin** + catatan |

### 9.2 Layar

```
+--------------------------------------------------+
| Ajukan Koreksi Presensi                          |
|                                                  |
| Tanggal *     [Sel, 6 Okt 2026 v]                |
| Kondisi       Hadir, Lupa Clock Out              |
|               Clock in 08:00 | Clock out -       |
| Alasan *      [________________________________] |
|                                                  |
| Pengajuan diperiksa mentor lebih dulu, lalu      |
| diproses admin. Jika disetujui, status hari itu  |
| menjadi Hadir.                                   |
|                              [ Batal ] [ Kirim ] |
+--------------------------------------------------+
```

### 9.3 Aturan

| Hal | Aturan |
|---|---|
| Kasus yang bisa dikoreksi | Terlambat, Lupa Clock In, Lupa Clock Out, Tidak Hadir **[Keputusan]** |
| Tanggal | Hari kerja yang sudah lewat, dalam periode magang |
| Satu tanggal | Hanya satu pengajuan aktif per tanggal. Pesan: "Sudah ada pengajuan koreksi untuk tanggal ini." |
| Alasan | Wajib. Pesan: "Alasan wajib diisi." |
| Batas waktu | Tidak dibatasi sistem, kebijakan perusahaan **[Keputusan]** |
| Membatalkan | Boleh selama Menunggu Mentor atau Menunggu Admin **[Usulan]** |
| Hasil | Status Hadir, jam kosong diisi jam jadwal, jam asli tetap, label **Dikoreksi** **[Keputusan]** |
| Setelah diputuskan | Tidak bisa dibuka ulang. Jika perlu, ajukan baru |

---

## 10. Alur 8 - Logbook: Riwayat dan Revisi

**Halaman:** Logbook.

**Status logbook:** **[Keputusan]**

| Status | Arti |
|---|---|
| Draft | Sedang diisi, belum clock out |
| Menunggu Review | Terkirim ke mentor |
| Revisi | Mentor meminta perbaikan, ada komentar |
| Disetujui | Final, terkunci |

Tidak ada status Ditolak, supaya setiap logbook tetap bisa disetujui. **[Keputusan]**

### 10.1 Layar daftar

```
+------------------------------------------------------------------------+
| Logbook                         Tampilan: [Daftar | Minggu]            |
| Status: [Semua v]    Bulan: [< Oktober 2026 >]                         |
|                                                                        |
| PERLU DITINDAK                                                         |
| Kam, 8 Okt   Revisi          "Tambahkan hasil rapat..."   [Perbaiki]   |
| Sel, 6 Okt   Belum diisi     Koreksi disetujui            [Isi]        |
|                                                                        |
| Tanggal      Ringkasan                          Status                 |
| Jum, 9 Okt   "Menyusun ERD tahap 1..."          Menunggu Review        |
| Rab, 7 Okt   Izin                               -                      |
| Sen, 5 Okt   "Rapat kebutuhan dengan unit..."   Disetujui              |
+------------------------------------------------------------------------+
```

- Tampilan **Minggu** menampilkan Senin-Minggu dalam satu layar untuk melihat pola mingguan. **[Usulan berdasar masukan mitra]**
- Bagian "Perlu ditindak" selalu di atas.

### 10.2 Memperbaiki logbook (Revisi)

| No | Langkah Intern | Respons sistem |
|---|---|---|
| 1 | Membuka logbook berstatus Revisi | Komentar mentor tampil di atas isian |
| 2 | Memperbaiki isian, klik **Kirim Ulang** | Status kembali **Menunggu Review**. Mentor diberi tahu |

```
+--------------------------------------------------+
| Logbook - Kam, 8 Okt 2026          Status: Revisi|
|                                                  |
| Komentar mentor (Bu Sari, 9 Okt 10:00):          |
| "Tambahkan hasil rapat dengan unit keuangan."    |
|                                                  |
| Yang saya kerjakan *                             |
| [______________________________________________] |
| Kendala (opsional) [___________________________] |
|                                                  |
| Riwayat review: 1 kali revisi        [Lihat]     |
|                                    [ Kirim Ulang ] |
+--------------------------------------------------+
```

Riwayat komentar revisi tetap tersimpan dan bisa dilihat. **[Usulan]**

### 10.3 Logbook untuk hari yang dikoreksi

Jika koreksi presensi disetujui dan hari itu belum punya logbook terkirim (misalnya Tidak Hadir atau Lupa Clock Out), hari itu muncul sebagai **Belum diisi**. Intern mengisi dan menekan **Kirim**, logbook langsung Menunggu Review. **[Keputusan]**

### 10.4 Kaitan dengan penilaian

Penilaian akhir oleh mentor hanya bisa dilakukan jika **semua logbook Disetujui**. Karena itu intern perlu segera menindaklanjuti revisi. Dashboard menampilkan pengingat jika masih ada logbook Revisi atau Belum diisi menjelang akhir magang. **[Keputusan, tampilan usulan]**

---

## 11. Alur 9 - Izin

**Aturan:**
- Jenis hanya **Izin Sakit** dan **Izin Urgent**. Tidak ada cuti. **[Keputusan]**
- **Kuota maksimal 3 kali per masa magang.** 1 pengajuan = 1 kali, berapa pun jumlah harinya. Yang dihitung: Menunggu dan Disetujui. **[Keputusan]**
- Setelah kuota habis, **tombol Ajukan Izin nonaktif**. Kuota direset saat magang diperpanjang. **[Keputusan]**
- Bukti berupa **link Google Drive atau Google Docs**, opsional. Admin hanya menyetujui jika ada bukti. **[Keputusan]**
- Mentor memproses. Jika tidak diproses dalam 24 jam, **admin memberi keputusan final**. **[Keputusan]**
- Izin disetujui otomatis mengubah status hari kerja terkait menjadi Izin. **[Keputusan]**

### 11.1 Layar formulir

```
+--------------------------------------------------+
| Ajukan Izin                  Sisa kuota: 2 dari 3|
|                                                  |
| Jenis izin *      ( ) Sakit   ( ) Urgent         |
| Tanggal mulai *   [__/__/____]                   |
| Tanggal selesai * [__/__/____]                   |
| Total: 2 hari kerja                              |
| Alasan *          [______________________________]|
| Link bukti        [https://drive.google.com/...] |
|  Hanya link Google Drive atau Google Docs.       |
|  Pastikan akses link "Siapa saja yang memiliki   |
|  link dapat melihat".                            |
|                                                  |
| Satu pengajuan dihitung 1 kali dari kuota.       |
|                              [ Batal ] [ Kirim ] |
+--------------------------------------------------+
```

Kuota habis:

```
+--------------------------------------------------+
| Izin                         Sisa kuota: 0 dari 3|
| Kuota izin Anda sudah habis (3 kali).            |
| Silakan hubungi mentor.      [ Ajukan Izin ] (nonaktif) |
+--------------------------------------------------+
```

### 11.2 Validasi

| Kolom | Aturan | Pesan |
|---|---|---|
| Jenis | Wajib | "Pilih jenis izin." |
| Tanggal | Selesai tidak sebelum mulai, dalam periode magang, minimal satu hari kerja, tidak tumpang tindih izin lain | Pesan sesuai kasus |
| Alasan | Wajib | "Alasan wajib diisi." |
| Link bukti | Jika diisi: harus `https://drive.google.com/...` atau `https://docs.google.com/...` | "Link harus berupa link Google Drive atau Google Docs, contoh: https://drive.google.com/..." |
| Kuota | Belum mencapai 3 | "Kuota izin Anda (3 kali) sudah habis. Silakan hubungi mentor." |

### 11.3 Riwayat dan pembatalan

```
+------------------------------------------------------------------------+
| Izin                                             [ + Ajukan Izin ]     |
| Sisa kuota: 2 dari 3                                                   |
|                                                                        |
| Jenis   Tanggal     Hari  Status      Diproses oleh   Aksi             |
| Sakit   13-14 Okt   2     Menunggu    -               [Batalkan]       |
| Urgent  5 Okt       1     Disetujui   Bu Sari         [Lihat]          |
| Sakit   28 Sep      1     Ditolak     Admin Sinta     [Lihat]          |
+------------------------------------------------------------------------+
```

- Intern dapat membatalkan izin yang masih **Menunggu**. Izin dibatalkan **mengembalikan kuota**. **[Keputusan: dibatalkan tidak dihitung]**
- Izin ditolak juga tidak dihitung dari kuota.
- Detail izin menampilkan alasan, link bukti, pemroses (mentor atau admin), dan catatan.

### 11.4 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Mentor atau admin meminta perbaikan link | Ditolak dengan catatan, misalnya "Link tidak bisa dibuka." Intern mengajukan ulang (kuota tidak terpakai karena ditolak) |
| Izin tanggal lampau | Boleh, diberi label "Diajukan setelah tanggal izin" |
| Izin mencakup hari libur | Hari libur tidak dihitung |

---

## 12. Alur 10 - Presentasi Akhir

**Tujuan:** membuktikan intern sudah presentasi (paparan) di unit sebelum magang selesai. **[Keputusan]**

**Aturan:**
- Mulai **H-7** sebelum tanggal selesai, intern menerima notifikasi dan banner di Dashboard. **[Keputusan]**
- Intern mengirim **link Google Drive/Docs** berisi bukti, misalnya foto bersama mentor saat presentasi. **[Keputusan]**
- **Admin** yang memverifikasi: Disetujui atau Revisi (misalnya link tidak bisa dibuka). **[Keputusan]**
- Presentasi disetujui adalah salah satu syarat mentor bisa memberi penilaian. **[Keputusan]**

### 12.1 Layar

```
+--------------------------------------------------+
| Presentasi Akhir               Status: Belum dikirim |
| Magang berakhir: Kam, 31 Des 2026 (7 hari lagi)  |
|                                                  |
| Lakukan presentasi di unit Anda, lalu kirim link |
| bukti (foto bersama mentor, materi, dll).        |
|                                                  |
| Link bukti *  [https://drive.google.com/...]     |
|  Pastikan akses link dapat dilihat admin.        |
|                                     [ Kirim ]    |
+--------------------------------------------------+
```

| Status | Tampilan |
|---|---|
| Belum dibuka (sebelum H-7) | "Presentasi akhir dapat dikirim mulai [tanggal]." Formulir nonaktif |
| Belum dikirim | Formulir aktif |
| Menunggu | Link tampil, "Menunggu verifikasi admin." Intern masih bisa mengganti link **[Usulan]** |
| Revisi | Catatan admin tampil, formulir aktif untuk mengganti link |
| Disetujui | "Presentasi akhir sudah disetujui." Terkunci |

Validasi link sama dengan link izin (Bagian 11.2).

---

## 13. Alur 11 - Catatan Warning dan Nilai Akhir

**Halaman:** Catatan.

### 13.1 Catatan warning

- Warning dibuat admin berdasarkan diskusi admin dan mentor. **[Keputusan]**
- Intern **hanya membaca**, tidak bisa membalas. Intern menerima notifikasi saat ada warning baru. **[Keputusan]**

```
+--------------------------------------------------+
| Catatan dari Admin                               |
|                                                  |
| 10 Okt 2026 - Admin Sinta                        |
|   Terlambat 3 kali dalam seminggu. Mohon         |
|   diperhatikan.                                  |
| -------------------------------------------------|
| 2 Okt 2026 - Admin Sinta                         |
|   Logbook dua hari belum diisi.                  |
+--------------------------------------------------+
```

Kondisi kosong: "Tidak ada catatan untuk Anda."

### 13.2 Nilai akhir

- Setelah mentor menyubmit penilaian, intern dapat melihat nilai per indikator dan nilai akhir di halaman ini. **[Usulan, lihat Bagian 20]**
- Sebelum dinilai: "Penilaian akan tersedia setelah presentasi disetujui, semua logbook disetujui, dan mentor menyelesaikan penilaian."

---

## 14. Alur 12 - Chat dan Notifikasi

- Semua pengguna dapat saling chat, termasuk intern dengan mentor dan admin. **[Keputusan]**
- Admin tidak dapat membaca chat orang lain. **[Keputusan]**
- Notifikasi cukup lewat bell icon di navbar, tanpa halaman terpisah. **[Keputusan]**

---

## 15. Situasi Khusus

### 15.1 Ganti mentor

Logbook yang Menunggu Review, izin Menunggu, dan koreksi Menunggu Mentor pindah ke mentor baru. Intern menerima notifikasi "Mentor Anda sekarang [nama]." **[Keputusan]**

### 15.2 Perpanjangan magang

- Tanggal selesai berubah, kuota izin **direset** menjadi 3 (dihitung sejak tanggal mulai perpanjangan). **[Keputusan]**
- Pengingat presentasi H-7 dihitung ulang dari tanggal selesai baru.
- Riwayat izin lama tetap tampil, hanya tidak dihitung ke kuota baru.

### 15.3 Akhir magang

- Intern bisa presensi sampai hari terakhir. Akun nonaktif mulai hari berikutnya. **[Keputusan]**
- Setelah nonaktif intern tidak bisa login. Logbook yang masih Revisi tidak bisa diperbaiki, jadi perbaiki sebelum hari terakhir. **[Usulan, saran proses]**

### 15.4 Cut-off 23:59

Status hari berjalan belum final sampai lewat 23:59. Setelah itu data hari tersebut hanya bisa diubah lewat koreksi presensi.

---

## 16. Notifikasi Intern

| Kejadian | Isi notifikasi | Tujuan klik |
|---|---|---|
| Mentor meminta revisi logbook | "Logbook 8 Okt perlu direvisi." | Logbook |
| Mentor menyetujui logbook | Tidak dikirim satu per satu, cukup status di Logbook **[Usulan, mengurangi notifikasi]** | - |
| Koreksi ditolak mentor | "Koreksi presensi 6 Okt ditolak mentor." | Koreksi |
| Koreksi diteruskan ke admin | "Koreksi presensi 6 Okt disetujui mentor, menunggu admin." | Koreksi |
| Koreksi disetujui/ditolak admin | "Koreksi presensi 6 Okt disetujui." | Koreksi |
| Izin disetujui/ditolak | "Izin Sakit 13-14 Okt disetujui." | Detail izin |
| Pengingat presentasi H-7 | "Magang Anda berakhir 7 hari lagi. Lakukan presentasi dan kirim buktinya." | Presentasi Akhir |
| Presentasi disetujui/revisi | "Bukti presentasi perlu diperbaiki." | Presentasi Akhir |
| Warning baru | "Ada catatan baru dari admin." | Catatan |
| Penilaian selesai | "Penilaian akhir Anda sudah tersedia." | Catatan |
| Pengumuman | Judul pengumuman | Isi |
| Pesan chat | "Pesan baru dari [nama]." | Chat |
| Ganti mentor | "Mentor Anda sekarang [nama]." | Dashboard |

Tidak ada pengingat clock in. **[Usulan]**

---

## 17. Aturan Tampilan

### 17.1 Status dan warna

Warna tidak boleh menjadi satu-satunya penanda, badge selalu berisi teks. Sama di semua role.

| Status | Dipakai untuk | Warna |
|---|---|---|
| Hadir | Presensi | Hijau #2E7D32 |
| Terlambat | Presensi | Merah gelap #AD1457 |
| Lupa Clock In | Presensi | Oranye tua #E65100 |
| Izin | Presensi | Biru #1565C0 |
| Tidak Hadir | Presensi | Merah #C62828 |
| Libur | Presensi | Abu-abu #757575 |
| Lupa Clock Out | Label kecil presensi | Oranye #EF6C00 |
| Dikoreksi | Label kecil presensi | Abu-abu gelap |
| Draft | Logbook | Abu-abu |
| Menunggu Review | Logbook | Kuning #F9A825 |
| Revisi | Logbook, presentasi | Oranye #EF6C00 |
| Disetujui | Logbook, izin, koreksi, presentasi | Hijau |
| Menunggu / Menunggu Mentor / Menunggu Admin | Izin, koreksi, presentasi | Kuning |
| Ditolak / Ditolak Mentor / Ditolak Admin | Izin, koreksi | Merah |
| Dibatalkan | Izin, koreksi | Abu-abu |

### 17.2 Format dan tata letak

- Tanggal "Sen, 12 Okt 2026", waktu 24 jam.
- Tombol Clock In dan Clock Out besar, mudah ditekan di ponsel.
- Tombol utama di kanan bawah (desktop) atau penuh lebar (ponsel).
- Kondisi memuat, kosong, dan gagal selalu disediakan.
- Link bukti dibuka di tab baru.

### 17.3 Pesan penting

| Situasi | Pesan |
|---|---|
| Clock in terlambat | "Clock in berhasil pukul 08:20. Anda tercatat Terlambat 20 menit." |
| Clock out sebelum jam pulang | "Belum saatnya clock out, tunggu 45 menit lagi." |
| Clock out tanpa clock in | "Anda belum clock in hari ini. Hari ini akan tercatat Lupa Clock In." |
| Logbook kosong saat clock out | "Isi logbook dulu sebelum clock out." |
| Kuota izin habis | "Kuota izin Anda (3 kali) sudah habis. Silakan hubungi mentor." |
| Link bukan Google Drive/Docs | "Link harus berupa link Google Drive atau Google Docs, contoh: https://drive.google.com/..." |
| Data sudah diproses pihak lain | "Data ini sudah diproses oleh [nama]." |

---

## 18. Hak Akses Intern

| Area | Intern bisa | Intern tidak bisa |
|---|---|---|
| Akun | Melihat profil, mengubah nomor telepon | Mengubah email, unit, lokasi, kampus, mentor, periode. Ganti password sendiri |
| Presensi | Clock in, clock out, melihat riwayat sendiri | Mengubah presensi langsung, melihat intern lain |
| Logbook | Mengisi sampai clock out, memperbaiki saat Revisi, mengisi hari yang dikoreksi | Mengubah logbook Disetujui atau Menunggu Review |
| Koreksi | Mengajukan dan membatalkan saat menunggu | Menyetujui |
| Izin | Mengajukan selama kuota ada, membatalkan saat Menunggu | Mengajukan setelah kuota habis, menyetujui |
| Presentasi | Mengirim dan mengganti link sampai disetujui | Menyetujui |
| Warning | Membaca catatan tentang dirinya | Membalas, membuat |
| Penilaian | Melihat nilai setelah disubmit (usulan) | Mengubah nilai |
| Laporan, Pengaturan | - | Semua |
| Chat | Chat dengan semua pengguna | Membaca chat orang lain |

---

## 19. Ringkasan Keputusan

| No | Topik | Keputusan |
|---|---|---|
| 1 | Istilah | Absensi menjadi Presensi |
| 2 | Status presensi | Hadir, Terlambat, Lupa Clock In, Izin, Tidak Hadir, Libur + tanda Lupa Clock Out |
| 3 | Terlambat | Lewat jam masuk + toleransi 15 menit. Terlihat semua role. Dihitung hadir |
| 4 | Lupa Clock In | Clock out tanpa clock in. Dihitung hadir |
| 5 | Jadwal | Mengikuti lokasi magang: jadwal mingguan per hari + jadwal khusus |
| 6 | Clock in | Hanya sebelum jam pulang |
| 7 | Clock out | Tidak sebelum jam pulang, logbook wajib terisi |
| 8 | Logbook | Pengganti Daily Report dan Task. 1 per hari. Disetujui atau Revisi (tanpa Ditolak) |
| 9 | Task dan Kanban | Dihapus |
| 10 | Koreksi presensi | Tanpa bukti. Mentor ACC, admin mengeksekusi. Hasil Hadir + Dikoreksi |
| 11 | Logbook hari dikoreksi | Bisa diisi setelah koreksi disetujui |
| 12 | Upload file | Dihapus. Bukti lewat link Google Drive/Docs |
| 13 | Kuota izin | 3 kali per masa magang, diblokir setelah habis, reset saat perpanjangan |
| 14 | Presentasi akhir | Mulai H-7, link bukti, diverifikasi admin |
| 15 | Warning | Terlihat intern (baca saja) dengan notifikasi |
| 16 | Dashboard | Kartu bisa diklik, aksi harian dari satu layar |
| 17 | Profil | Tanpa foto, avatar inisial |

---

## 20. Hal yang Masih Terbuka

| No | Topik | Keterangan |
|---|---|---|
| 1 | Toleransi terlambat | 15 menit, menunggu konfirmasi mitra. Disimpan sebagai pengaturan sehingga mudah diubah |
| 2 | Intern melihat nilai akhir | Usulan saya intern bisa melihat. Perlu konfirmasi |
| 3 | Kasus khusus lokasi | GPS kurang akurat dan lokasi palsu, ditangani tim teknis |
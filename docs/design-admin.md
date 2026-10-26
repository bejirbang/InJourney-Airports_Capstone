# design-admin.md - Desain Role Admin (Lengkap, Berdasarkan Alur)

Sistem: Web Intern Management dan Attendance System
Versi: Draft 3 | Tanggal: 24 Oktober 2026 | Acuan: PRD, design-intern.md (Draft 3), design-mentor.md (Draft 2), Arsitektur Backend & Desain Data (Versi 2)

Perubahan Draft 3 (hasil wawancara mitra 22 Oktober 2026):
- Istilah **Absensi diganti Presensi**.
- Status presensi baru: **Terlambat** (toleransi 15 menit) dan **Lupa Clock In**, Lupa Clock Out menjadi tanda.
- **Jam kerja per lokasi kantor**: jadwal mingguan per hari (diatur sekaligus atau satu per satu) dan jadwal khusus per rentang tanggal. Menggantikan jam kerja global.
- **Koreksi presensi dua tahap**: admin hanya mengeksekusi pengajuan yang sudah di-ACC mentor. Tanpa bukti, hasil selalu Hadir + Dikoreksi.
- Izin pending lebih dari 24 jam: **admin memberi keputusan final**. **Kuota izin 3 kali** per masa magang.
- Fitur baru: **verifikasi Presentasi Akhir**, **rekap Penilaian**, **Pengaturan Umum** (toleransi, kuota).
- Data intern ditambah **unit, lokasi magang, universitas, jurusan**.
- **Warning kini terlihat intern** (hanya baca, ada notifikasi) dan mentor.
- **Dashboard**: filter global per lokasi kantor, semua kartu bisa diklik.
- **Laporan Excel** berbentuk laporan siap pakai: rekap presensi, izin, logbook, penilaian. Filter tanggal, lokasi, dan satu/banyak intern.
- **Task dihapus**, upload file dihapus (bukti berupa link Google Drive/Docs).

Tanda:
- **[Keputusan]** = sudah disepakati.
- **[Usulan]** = pilihan desain dari saya, diikuti kecuali tercantum di Bagian 20.

---

## 1. Cara Membaca Dokumen Ini

Dokumen disusun menurut **alur kerja Admin**.

Isi:
1. Cara membaca
2. Gambaran Admin dan navigasi
3. Alur 1 - Setup awal
4. Alur 2 - Kelola akun pengguna
5. Alur 3 - Dashboard
6. Alur 4 - Mengeksekusi koreksi presensi
7. Alur 5 - Izin lewat 24 jam
8. Alur 6 - Akhir periode magang
9. Alur 7 - Verifikasi presentasi akhir
10. Alur 8 - Rekap penilaian
11. Alur 9 - Kalender libur dan pengaturan umum
12. Alur 10 - Lokasi kantor dan jadwal kerja
13. Alur 11 - Catatan warning
14. Alur 12 - Pengumuman
15. Alur 13 - Laporan Excel
16. Alur 14 - Log aktivitas, chat, profil
17. Notifikasi Admin
18. Aturan tampilan
19. Hak akses Admin
20. Ringkasan keputusan dan hal terbuka

---

## 2. Gambaran Admin dan Navigasi

**Peran:** Admin adalah PIC magang. Semua admin berhak sama. **[Keputusan]**

**Platform:** web responsif. Utamanya desktop, tetapi admin juga bisa memakai ponsel. **[Keputusan]**

### 2.1 Kerangka halaman

```
+------------------------------------------------------------------------+
| [Logo]  Nama Sistem      Lokasi: [Semua kantor v]  [Chat] [Bell 3] [Admin v] |
+------------------+-----------------------------------------------------+
| Dashboard        |                                                     |
| Pengguna         |                                                     |
| Presensi         |                                                     |
| Koreksi (2)      |              AREA KONTEN HALAMAN                    |
| Izin (1)         |                                                     |
| Presentasi (1)   |                                                     |
| Penilaian        |                                                     |
| Warning          |                                                     |
| Pengumuman       |                                                     |
| Laporan          |                                                     |
| Lokasi & Jadwal  |                                                     |
| Pengaturan       |                                                     |
| Log Aktivitas    |                                                     |
+------------------+-----------------------------------------------------+
```

**Filter lokasi global** di navbar: memilih satu kantor (atau Semua) memengaruhi Dashboard, Presensi, Izin, Koreksi, Presentasi, Penilaian, dan Laporan sekaligus. Pilihan diingat per admin di browser. **[Keputusan, penyimpanan Usulan]**

### 2.2 Menu

| Menu | Isi | Alamat (usulan) |
|---|---|---|
| Dashboard | Ringkasan hari ini dan antrean tindakan | /admin/dashboard |
| Pengguna | Akun, tambah, ubah, nonaktif, reset password, ganti mentor, perpanjang | /admin/users |
| Presensi | Data presensi dan rekap bulanan semua intern | /admin/attendance |
| Koreksi | Koreksi presensi yang sudah di-ACC mentor | /admin/corrections |
| Izin | Semua izin, proses yang lewat 24 jam | /admin/leaves |
| Presentasi | Verifikasi bukti presentasi akhir | /admin/presentations |
| Penilaian | Rekap nilai akhir intern | /admin/assessments |
| Warning | Catatan per intern | /admin/warnings |
| Pengumuman | Pengumuman per role | /admin/announcements |
| Laporan | Export Excel Presensi, PDF Daftar Kehadiran, PDF Penilaian | /admin/reports |
| Lokasi & Jadwal | Kantor, radius, jadwal mingguan, jadwal khusus | /admin/offices |
| Pengaturan | Kalender libur dan pengaturan umum | /admin/settings |
| Log Aktivitas | Jejak tindakan admin | /admin/audit-log |

Ponsel: menu bawah **Beranda, Koreksi, Izin, Presensi, Lainnya**. **[Usulan]**

---

## 3. Alur 1 - Setup Awal

Akun admin pertama disiapkan tim teknis saat instalasi. **[Usulan]**

| No | Langkah | Alasan urutan |
|---|---|---|
| 1 | Login, ganti password sementara | Wajib di login pertama |
| 2 | **Lokasi & Jadwal**: tambah kantor lewat peta, isi radius, lalu jadwal mingguan | Jadwal menentukan status Terlambat dan hari kerja. Tanpa kantor aktif, intern tidak bisa clock in |
| 3 | **Pengaturan**: periksa toleransi terlambat dan kuota izin, isi kalender libur tahun berjalan | Libur nasional diinput manual |
| 4 | **Pengguna**: tambah akun Mentor | Intern membutuhkan mentor |
| 5 | Tambah akun Intern (mentor, lokasi magang, unit, kampus, periode) | - |
| 6 | Sampaikan email dan password sementara ke tiap pengguna | - |

Layar ganti password: minimal 8 karakter dengan huruf dan angka, tidak boleh sama dengan password sementara. Halaman lain terkunci sebelum diganti. **[Keputusan]**

---

## 4. Alur 2 - Kelola Akun Pengguna

### 4.1 Daftar

```
+------------------------------------------------------------------------+
| Pengguna                                          [ + Tambah Akun ]    |
| Cari nama/email: [________]  Role: [Semua v]  Status: [Aktif v]        |
|                                                                        |
| Nama     Role    Unit       Lokasi     Mentor    Periode       Status  |
| Rizki    Intern  Divisi IT  Soetta T3  Bu Sari   1 Sep-31 Des  Aktif [...] |
| Bu Sari  Mentor  Divisi IT  -          -         -             Aktif [...] |
+------------------------------------------------------------------------+
```

Aksi [...]: Lihat detail, Ubah, Ganti mentor (intern), Perpanjang magang (intern), Reset password, Nonaktifkan/Aktifkan. Tidak ada Hapus. **[Keputusan]**

### 4.2 Tambah akun

```
+--------------------------------------------------+
| Tambah Akun                                      |
| Nama lengkap *      [_________________________]  |
| Email internal *    [_________________________]  |
| Role *              ( ) Intern ( ) Mentor ( ) Admin |
| Unit *              [_________________________]  |
|  (wajib untuk Intern dan Mentor)                 |
| -- Tampil jika role = Intern --                  |
| Mentor *            [Pilih mentor            v]  |
| Lokasi magang *     [Pilih kantor            v]  |
| Jenis institusi *   ( ) Universitas ( ) Sekolah  |
| Universitas/Sekolah*[_________________________]  |
| Jurusan *           [_________________________]  |
| NIM/NIS *           [_________________________]  |
| Tanggal mulai *     [__/__/____]                 |
| Tanggal selesai *   [__/__/____]                 |
|                                                  |
| Password sementara dibuat otomatis.              |
|                        [ Batal ]  [ Simpan ]     |
+--------------------------------------------------+
```

| Kolom | Aturan | Pesan |
|---|---|---|
| Nama | Wajib | "Nama wajib diisi." |
| Email | Wajib, format benar, belum dipakai | "Email sudah terdaftar." |
| Unit | Wajib untuk Intern dan Mentor | "Unit wajib diisi." |
| Mentor | Wajib untuk Intern, mentor aktif | "Pilih mentor untuk intern ini." |
| Lokasi magang | Wajib untuk Intern, kantor aktif | "Pilih lokasi magang." |
| Jenis institusi | Wajib untuk Intern: universitas atau sekolah (26 Okt 2026) | "Pilih jenis institusi: universitas atau sekolah." |
| Universitas, Jurusan | Wajib untuk Intern | "Universitas wajib diisi." / "Jurusan wajib diisi." |
| NIM/NIS | Wajib untuk Intern, maksimal 30 karakter (26 Okt 2026) | "NIM/NIS wajib diisi." |
| Tanggal selesai | Setelah tanggal mulai | "Tanggal selesai harus sesudah tanggal mulai." |

Password sementara tampil **sekali** dengan tombol Salin. Pengguna wajib mengganti di login pertama. Role tidak bisa diubah setelah akun dibuat. **[Keputusan dan Usulan sebelumnya]**

Universitas dan jurusan disimpan agar dashboard dan laporan bisa menunjukkan asal kampus intern. **[Keputusan]**

### 4.3 Detail intern

```
+------------------------------------------------------------------------+
| < Pengguna   Rizki Pratama                          [Ubah] [Aksi v]    |
| Unit: Divisi IT | Lokasi: Soetta T3 | Telkom Univ - Sistem Informasi   |
| Mentor: Bu Sari | Periode: 1 Sep - 31 Des 2026 | Kuota izin: 2 dari 3  |
|                                                                        |
| [Presensi] [Logbook] [Izin] [Koreksi] [Warning] [Akhir Magang]         |
+------------------------------------------------------------------------+
```

Tab Logbook hanya baca (review adalah hak mentor). Tab Akhir Magang menampilkan status presentasi dan nilai.

### 4.4 Ganti mentor

Dialog menampilkan dampak, lalu **Pindahkan**:

```
| Yang akan dipindahkan ke mentor baru:            |
|  - 3 logbook Menunggu Review                     |
|  - 1 koreksi Menunggu Mentor                     |
|  - 1 izin Menunggu                               |
| Riwayat keputusan lama tetap tersimpan.          |
```

Satu intern tepat satu mentor. Mentor baru dan intern diberi tahu. **[Keputusan]**

### 4.5 Reset password dan nonaktif

- Reset: sistem membuat password sementara baru, tampil sekali. **[Keputusan]**
- Nonaktif: intern tidak bisa login. Data tetap bisa dilihat. **[Keputusan]**
- Admin tidak bisa menonaktifkan diri sendiri, minimal satu admin aktif. Mentor dengan intern aktif tidak bisa dinonaktifkan. **[Keputusan sebelumnya]**

Semua tindakan di alur ini masuk Log Aktivitas.

---

## 5. Alur 3 - Dashboard

### 5.1 Layout

```
+------------------------------------------------------------------------+
| Dashboard                Lokasi: [Soetta T3 v]       Senin, 12 Okt 2026 |
|                                                                        |
| HARI INI (24 intern aktif)        (klik kotak untuk melihat nama)      |
| [Sudah Presensi 18] [Terlambat 3] [Izin 2] [Belum Clock In 4]          |
| Kemarin: Hadir 19 | Terlambat 2 | Lupa Clock In 1 | Izin 2 | Tidak Hadir 1 | Lupa Clock Out 1 |
|                                                                        |
| PERLU TINDAKAN                                                         |
| +--------------------------------+ +---------------------------------+ |
| | Koreksi menunggu admin (2)     | | Izin lewat 24 jam (1)           | |
| | Nabila 6 Okt Lupa CO [Setujui] | | Putri Sakit 30 jam    [Buka]    | |
| +--------------------------------+ +---------------------------------+ |
| +--------------------------------+ +---------------------------------+ |
| | Presentasi menunggu (1)        | | Magang berakhir 7 hari (2)      | |
| | Rizki  [Buka link][Setujui]    | | Nabila 17 Okt [Tanya][Perpanjang]| |
| +--------------------------------+ +---------------------------------+ |
| +--------------------------------+ +---------------------------------+ |
| | Kuota izin habis (1)           | | Penilaian baru masuk (1)        | |
| | Dimas  3 dari 3  [Warning]     | | Putri  87,5      [Lihat]        | |
| +--------------------------------+ +---------------------------------+ |
|                                                                        |
| ASAL KAMPUS INTERN AKTIF                                               |
| Telkom University 8 | UI 5 | ITB 3 | lainnya 8                         |
+------------------------------------------------------------------------+
```

### 5.2 Aturan

| Bagian | Aturan |
|---|---|
| Filter lokasi | Mengubah seluruh isi Dashboard. Default "Semua kantor" **[Keputusan]** |
| Kartu hari ini | **Setiap kotak bisa diklik** dan membuka daftar nama langsung di Dashboard (panel samping), tanpa pindah halaman **[Keputusan: one touch point]** |
| Ringkasan kemarin | Status final. Setiap angka bisa diklik |
| Koreksi menunggu admin | Tombol **Setujui** langsung di baris jika tidak perlu membaca detail. **Buka** untuk detail |
| Izin lewat 24 jam | Izin yang mentornya belum memproses. Admin memberi keputusan final **[Keputusan]** |
| Presentasi menunggu | Buka link lalu Setujui atau Revisi dari baris yang sama |
| Magang berakhir 7 hari | Tanya mentor (chat) dan Perpanjang **[Keputusan]** |
| Kuota izin habis | Intern yang sudah memakai 3 dari 3. Tombol **Warning** membuka form catatan **[Keputusan: filter izin + warning]** |
| Penilaian baru masuk | Penilaian yang baru disubmit mentor |
| Asal kampus | Jumlah intern aktif per universitas **[Keputusan, bentuk Usulan]** |

| Kondisi | Tampilan |
|---|---|
| Hari libur di lokasi terpilih | Banner "Hari ini hari libur: [nama]". Kartu hari ini disembunyikan |
| Belum ada kantor aktif | Banner dengan tautan ke Lokasi & Jadwal |
| Kosong | Kotak tindakan yang kosong disembunyikan |

---

## 6. Alur 4 - Mengeksekusi Koreksi Presensi

**Aturan:** **[Keputusan]**
- Admin hanya menerima pengajuan yang sudah **di-ACC mentor**. Admin menunggu mentor, tanpa eskalasi otomatis.
- Tidak ada bukti dari intern. ACC mentor adalah buktinya.
- Hasil jika disetujui: status hari itu **Hadir**, jam yang kosong diisi **jam jadwal** hari itu, jam asli tidak ditimpa, diberi label **Dikoreksi**, tercatat di Log Aktivitas.
- Catatan admin wajib saat Setujui maupun Tolak. **[Usulan sebelumnya]**

### 6.1 Daftar

```
+------------------------------------------------------------------------+
| Koreksi Presensi                                                       |
| Tab: [Menunggu Admin (2)] [Menunggu Mentor (3)] [Semua]                |
|                                                                        |
| Intern   Tanggal     Kondisi          Mentor     ACC mentor   Aksi     |
| Nabila   Sel, 6 Okt  Lupa Clock Out   Bu Sari    7 Okt 09:00  [Buka]   |
| Dimas    Kam, 1 Okt  Terlambat        Pak Budi   2 Okt 10:12  [Buka]   |
+------------------------------------------------------------------------+
```

Tab **Menunggu Mentor** hanya untuk dilihat, admin tidak bisa memproses dari sini.

### 6.2 Detail

```
+--------------------------------------------------------------+
| Koreksi - Nabila, Sel 6 Okt 2026            Status: Menunggu Admin |
|                                                              |
| DATA TERCATAT                                                |
| Clock in 08:00 | Clock out - | Status: Hadir, Lupa Clock Out  |
|                                                              |
| Alasan intern: "Baterai HP habis saat akan clock out."       |
| ACC mentor: Bu Sari, 7 Okt 09:00                             |
| Catatan mentor: "Benar, intern hadir sampai sore."           |
|                                                              |
| HASIL JIKA DISETUJUI                                         |
| Clock in 08:00 (tetap) | Clock out 17:00 (jam jadwal)        |
| Status: Hadir, label Dikoreksi                               |
|                                                              |
| Catatan admin *  [_______________________________________]   |
|                          [ Tolak ]        [ Setujui ]        |
+--------------------------------------------------------------+
```

| Kasus | Hasil jika disetujui |
|---|---|
| Terlambat | Jam asli tetap, status menjadi Hadir |
| Lupa Clock In | Clock in diisi jam masuk jadwal, status Hadir |
| Lupa Clock Out | Clock out diisi jam pulang jadwal, status Hadir |
| Tidak Hadir | Clock in dan clock out diisi jam jadwal, status Hadir |

Setelah disetujui, jika hari itu belum punya logbook terkirim, intern bisa mengisinya. **[Keputusan]**

| Kondisi | Perilaku |
|---|---|
| Catatan kosong | Tombol nonaktif, "Catatan wajib diisi." |
| Dua admin memproses bersamaan | "Data ini sudah diproses oleh [nama]." |
| Intern membatalkan | "Pengajuan ini sudah dibatalkan intern." |

---

## 7. Alur 5 - Izin Lewat 24 Jam

**Aturan:** **[Keputusan]**
- Admin memproses izin yang **masih Menunggu lebih dari 24 jam**. Keputusan admin **final**.
- Admin hanya boleh **Setujui** jika ada **link bukti**. Tanpa bukti, admin hanya bisa Tolak dengan catatan.
- Izin yang sudah diproses mentor tidak bisa diubah admin.
- Kuota 3 kali dijaga sistem. Admin melihat kuota terpakai sebagai informasi.

```
+--------------------------------------------------------------+
| Izin - Putri                                Status: Menunggu |
| Mentor: Bu Sari (belum merespons 30 jam)                     |
| Jenis: Sakit | 12-13 Okt (2 hari kerja) | Kuota: 2 dari 3     |
| Alasan: "Demam, disarankan istirahat dokter."                |
| Bukti: https://drive.google.com/...           [Buka link]    |
|                                                              |
| [x] Saya sudah membuka dan memeriksa bukti                   |
| Catatan *  [_______________________________________]         |
|                       [ Tolak ]        [ Setujui ]           |
+--------------------------------------------------------------+
```

Halaman Izin juga punya filter **"Kuota habis"** untuk melihat intern yang sudah memakai 3 dari 3. **[Keputusan]**

---

## 8. Alur 6 - Akhir Periode Magang

| No | Langkah | Respons sistem |
|---|---|---|
| 1 | Melihat "Magang berakhir 7 hari" di Dashboard | Pada saat yang sama intern menerima pengingat presentasi |
| 2 | **Tanya mentor** | Chat dengan draf pesan terbuka |
| 3a | Diperpanjang: **Perpanjang**, isi tanggal baru | Tanggal berubah, **kuota izin direset**, pengingat presentasi dihitung ulang |
| 3b | Tidak diperpanjang | Akun otomatis nonaktif mulai hari setelah tanggal selesai |

Dialog perpanjang menampilkan: "Kuota izin akan kembali menjadi 3 sejak tanggal mulai perpanjangan. Riwayat izin lama tetap tersimpan." **[Keputusan]**

---

## 9. Alur 7 - Verifikasi Presentasi Akhir

**Tujuan:** memastikan intern benar-benar presentasi di unit, karena admin tidak bisa memantau semua unit. **[Keputusan]**

**Aturan:**
- Intern mengirim link Google Drive/Docs mulai H-7. **[Keputusan]**
- Admin membuka link, lalu **Setujui** atau **Revisi** (catatan wajib, misalnya link tidak bisa dibuka atau bukti tidak jelas). **[Keputusan]**
- Presentasi disetujui adalah syarat penilaian oleh mentor. **[Keputusan]**

```
+------------------------------------------------------------------------+
| Presentasi Akhir                                                       |
| Tab: [Menunggu (1)] [Revisi] [Disetujui] [Belum kirim]                 |
|                                                                        |
| Intern   Mentor    Selesai magang  Dikirim       Link           Aksi   |
| Rizki    Bu Sari   31 Des 2026     24 Des 10:00  [Buka link]  [Revisi][Setujui] |
+------------------------------------------------------------------------+
```

Tab **Belum kirim** menampilkan intern yang sudah H-7 tetapi belum mengirim, agar admin bisa mengingatkan lewat chat. **[Usulan]**

---

## 10. Alur 8 - Rekap Penilaian

**Aturan:**
- Mentor mengisi dan menyubmit penilaian. Admin **melihat** hasilnya dan memakainya untuk sertifikat. **[Keputusan]**
- Indikator dari mitra, **masih ditunggu**. **[Keputusan]**
- E-sertifikat otomatis belum termasuk cakupan. Nilai tersedia di halaman ini dan di laporan Excel. **[Keputusan: minimal ada rekap nilai]**

```
+------------------------------------------------------------------------+
| Penilaian                       Status: [Semua v]                      |
|                                                                        |
| Intern  Mentor   Selesai    Presentasi  Logbook     Status     Nilai   |
| Putri   Bu Sari  30 Sep     Disetujui   Semua ok    Selesai    87,5 [Lihat] |
| Rizki   Bu Sari  31 Des     Disetujui   Semua ok    Siap dinilai -     |
| Nabila  Pak Budi 17 Okt     Menunggu    2 belum ok  Belum bisa   -     |
+------------------------------------------------------------------------+
```

Detail menampilkan nilai per indikator (dikelompokkan per kategori), nilai akhir, predikat, catatan mentor, mentor, dan waktu submit. Admin tidak bisa mengubah nilai, tetapi bisa mencetak **PDF Penilaian** (lihat Bagian 15.3). **[Keputusan 26 Okt 2026]**

---

## 11. Alur 9 - Kalender Libur dan Pengaturan Umum

**Halaman:** Pengaturan, dua tab.

### 11.1 Tab Kalender Libur

- Berisi libur nasional dan libur lain. Berlaku untuk **semua kantor**. **[Keputusan]**
- Diinput **manual** oleh admin, tanpa API pihak ketiga, karena cuti bersama sering berubah dan kebijakan perusahaan bisa berbeda. **[Keputusan]**
- Hari non-kerja rutin (Sabtu, Minggu) **tidak** diatur di sini, tetapi di jadwal mingguan tiap kantor (Alur 10). **[Keputusan]**
- Menambah libur tanggal lampau menghitung ulang status presensi tanggal itu (dialog dampak). **[Keputusan sebelumnya]**

```
+------------------------------------------------------------------------+
| Pengaturan   [Kalender Libur] [Pengaturan Umum]                        |
|                                       Tahun: [2026 v] [ + Tambah Libur ]|
| Tanggal        Nama libur                                Aksi          |
| 17 Agu 2026    Hari Kemerdekaan RI                       [Ubah][Hapus] |
| 25 Des 2026    Hari Natal                                [Ubah][Hapus] |
+------------------------------------------------------------------------+
```

### 11.2 Tab Pengaturan Umum

```
+--------------------------------------------------+
| Pengaturan Umum                                  |
| Toleransi terlambat     [ 15 ] menit             |
| Kuota izin per magang   [  3 ] kali              |
| Pengingat akhir magang  [  7 ] hari sebelum      |
| Batas izin ke admin     [ 24 ] jam               |
|                                     [ Simpan ]   |
+--------------------------------------------------+
```

- Angka awal sesuai keputusan. Disediakan sebagai pengaturan karena toleransi 15 menit masih menunggu konfirmasi mitra. **[Usulan]**
- Perubahan berlaku untuk perhitungan berikutnya dan tercatat di Log Aktivitas.

---

## 12. Alur 10 - Lokasi Kantor dan Jadwal Kerja

**Halaman:** Lokasi & Jadwal.

**Aturan:**
- Admin membuat kantor lewat peta, dengan nama, radius clock in, dan radius clock out. **[Keputusan]**
- **Setiap kantor punya jadwal sendiri.** Intern mengikuti jadwal **lokasi magangnya**. **[Keputusan]**
- Jadwal terdiri dari **jadwal mingguan** dan **jadwal khusus**. **[Keputusan]**
- Urutan prioritas: **Libur di kalender → Jadwal khusus → Jadwal mingguan**. **[Keputusan]**

### 12.1 Daftar kantor

```
+------------------------------------------------------------------------+
| Lokasi & Jadwal                                  [ + Tambah Kantor ]   |
| Nama              Radius CI  Radius CO  Intern  Status   Aksi          |
| Soetta T3         100 m      300 m      18      Aktif    [Buka]        |
| Halim             150 m      150 m      6       Aktif    [Buka]        |
+------------------------------------------------------------------------+
```

Detail kantor punya tiga tab: **Lokasi**, **Jadwal Mingguan**, **Jadwal Khusus**.

### 12.2 Tab Lokasi

Sama dengan sebelumnya: peta Leaflet + OpenStreetMap, cari alamat (Nominatim), pin bisa digeser, dua lingkaran radius sebagai pratinjau. Radius bilangan bulat lebih dari 0 meter, ditentukan admin tanpa batas atas. Kantor tidak dihapus, hanya dinonaktifkan. Kantor yang masih menjadi lokasi magang intern aktif tidak bisa dinonaktifkan. **[Keputusan dan Usulan]**

### 12.3 Tab Jadwal Mingguan

```
+--------------------------------------------------------------+
| Jadwal Mingguan - Soetta T3       Berlaku mulai [01/11/2026] |
|                                                              |
| Pilih  Hari     Hari kerja   Jam masuk   Jam pulang          |
| [x]    Senin    [x]          [08:00]     [17:00]             |
| [x]    Selasa   [x]          [08:00]     [17:00]             |
| [x]    Rabu     [x]          [08:00]     [17:00]             |
| [x]    Kamis    [x]          [08:00]     [17:00]             |
| [ ]    Jumat    [x]          [08:30]     [16:00]             |
| [ ]    Sabtu    [ ]          -           -                   |
| [ ]    Minggu   [ ]          -           -                   |
|                                                              |
| Atur hari terpilih: masuk [08:00] pulang [17:00] [Terapkan]  |
|                                                              |
| Perubahan berlaku mulai tanggal di atas dan tidak mengubah   |
| presensi sebelumnya.                                         |
|                                              [ Simpan ]      |
+--------------------------------------------------------------+
```

- **Atur sekaligus:** centang beberapa hari (misalnya Senin-Kamis), isi jam, tekan **Terapkan**. **Atur satu per satu:** ubah langsung di baris hari itu (misalnya Jumat). **[Keputusan]**
- Hari kerja wajib punya jam masuk dan jam pulang, jam pulang setelah jam masuk.
- Tanggal berlaku tidak boleh di masa lalu. **[Usulan]**
- Riwayat jadwal sebelumnya bisa dilihat lewat tombol **Riwayat**.

### 12.4 Tab Jadwal Khusus

```
+------------------------------------------------------------------------+
| Jadwal Khusus - Soetta T3                       [ + Tambah Jadwal ]   |
| Nama                 Rentang                 Jam            Aksi       |
| Jam kerja Ramadan    18 Feb - 19 Mar 2026    08:00 - 15:00  [Ubah][Hapus] |
+------------------------------------------------------------------------+

+--------------------------------------------------+
| Tambah Jadwal Khusus                             |
| Nama *            [_____________________]        |
| Tanggal mulai *   [__/__/____]                   |
| Tanggal selesai * [__/__/____]                   |
| Jam masuk *       [__:__]   Jam pulang * [__:__] |
| Berlaku pada hari kerja menurut jadwal mingguan. |
|                          [ Batal ]  [ Simpan ]   |
+--------------------------------------------------+
```

| Validasi | Pesan |
|---|---|
| Rentang tumpang tindih dengan jadwal khusus lain di kantor yang sama | "Rentang tanggal bertabrakan dengan jadwal khusus lain." |
| Jam pulang sebelum jam masuk | "Jam pulang harus setelah jam masuk." |
| Mengubah atau menghapus jadwal khusus yang sudah berjalan | Hanya untuk tanggal yang belum lewat **[Usulan]** |

---

## 13. Alur 11 - Catatan Warning

**Aturan:** **[Keputusan]**
- Catatan tanpa level, dibuat admin berdasarkan diskusi admin dan mentor.
- **Terlihat oleh intern (hanya baca, tanpa balasan)** dan **mentor intern tersebut**.
- **Intern menerima notifikasi** saat warning dibuat. Mentor juga diberi tahu. **[Usulan untuk mentor]**
- Penulis boleh mengubah dalam 24 jam, setelah itu terkunci. **[Keputusan sebelumnya]**

```
+--------------------------------------------------------------+
| Warning - Dimas                                              |
| Terlihat oleh: intern dan mentor (Pak Budi)                  |
| Ringkasan: Terlambat 3 kali bulan ini | Kuota izin 3 dari 3  |
|                                         [ + Tambah Catatan ] |
| 10 Okt 2026 - Admin Sinta                                    |
|   Terlambat 3 kali dalam seminggu. Mohon diperhatikan.       |
+--------------------------------------------------------------+
```

Dialog simpan menegaskan: "Catatan ini akan terlihat dan dikirim sebagai notifikasi ke intern." Karena itu tulis dengan bahasa yang sopan dan jelas.

---

## 14. Alur 12 - Pengumuman

Tetap: admin membuat judul dan isi, memilih penerima (Intern, Mentor, atau keduanya). Muncul di Dashboard dan bell icon penerima. Bisa diubah dan dihapus. **[Keputusan]** Contoh pemakaian dari mitra: WFA, ketentuan pakaian batik, acara kantor.

---

## 15. Alur 13 - Laporan Excel

**Aturan:** **[Keputusan]**
- Hanya admin, format Excel (.xlsx).
- File **sudah berbentuk laporan** per intern, sehingga admin tidak perlu mengolah lagi.
- Filter: periode, lokasi, mentor, dan **pencarian satu atau banyak intern** (nama atau email).

### 15.1 Layar

```
+--------------------------------------------------------------+
| Laporan (Export Excel)                                       |
|                                                              |
| Periode *    [01/10/2026] s/d [31/10/2026]  [Bulan ini v]    |
| Lokasi       [Mengikuti filter global: Soetta T3]            |
| Mentor       [Semua v]                                       |
| Intern       [Cari nama/email...]                            |
|              (Rizki x) (Dimas x)    kosong = semua intern    |
| Isi laporan  [x] Rekap Presensi  [x] Rekap Izin              |
|              [x] Rekap Logbook   [x] Rekap Penilaian         |
| Hanya intern dengan: [ ] kuota izin habis                    |
|                                                              |
| Pratinjau: 24 intern                       [ Buat Excel ]    |
+--------------------------------------------------------------+
```

### 15.2 Isi file

Satu file, satu sheet per jenis rekap. Setiap baris = satu intern.

| Sheet | Kolom |
|---|---|
| Rekap Presensi | Identitas, hari kerja, Hadir, Terlambat, Lupa Clock In, Lupa Clock Out, Izin, Tidak Hadir, Dikoreksi, persentase kehadiran |
| Rekap Izin | Identitas, kuota terpakai (dari 3), total hari izin, Sakit, Urgent, ditandai jika kuota habis |
| Rekap Logbook | Identitas, Disetujui, Menunggu Review, Revisi, Belum diisi |
| Rekap Penilaian | Identitas, nilai per indikator, nilai akhir, predikat, mentor penilai, tanggal submit |

Identitas: nama, email, unit, lokasi magang, universitas, jurusan, mentor, periode magang.

Baris judul berisi periode dan filter yang dipakai. Kolom angka sudah berformat angka (bukan teks) agar bisa difilter dan diurutkan langsung di Excel. **[Usulan]**

| Kondisi | Pesan |
|---|---|
| Tidak ada data | "Tidak ada data pada periode dan filter ini." |
| Periode lebih dari 12 bulan | "Pilih periode maksimal 12 bulan." **[Usulan, menjaga beban server]** |

Setiap export tercatat di Log Aktivitas.

### 15.3 Dokumen PDF (26 Okt 2026)

Selain Excel, admin bisa menarik dua dokumen PDF per intern untuk ditandatangani basah. **[Keputusan]**

| Dokumen | Pilihan | Isi |
|---|---|---|
| PDF Daftar Kehadiran | Intern, bulan | Kop (InJourney Airports, nama kantor regional dari pengaturan), identitas (Nama, Asal Universitas/Sekolah, Jurusan, Unit Penempatan, Periode Magang, Bulan/Tahun). Satu baris per hari kerja: Tanggal, Jam Masuk, Jam Keluar, Kegiatan (logbook), Keterangan (status presensi). Izin tetap tampil dengan Keterangan "Izin"; akhir pekan dan libur tidak tampil. Penutup: "[kota], [tanggal]", kolom tanda tangan Pembimbing dan Peserta Magang |
| PDF Penilaian | Intern | Hanya jika penilaian sudah disubmit. Identitas termasuk NIM/NIS, 9 indikator per kategori, nilai rata-rata, predikat, catatan mentor. Penutup: "[kota], [tanggal submit]", tanda tangan Pembimbing |

Kota diambil dari kota bandara (diisi di Lokasi & Jadwal). Logbook yang masih draft tidak dicetak.

| Kondisi | Pesan |
|---|---|
| Bulan di luar periode magang | "Bulan yang dipilih di luar periode magang intern ini." |
| Belum ada hari kerja | "Belum ada hari kerja yang bisa dicetak pada bulan ini." |
| Penilaian belum disubmit | "Penilaian intern ini belum disubmit mentor." |

Setiap export PDF tercatat di Log Aktivitas kategori Laporan.

---

## 16. Alur 14 - Log Aktivitas, Chat, Profil

**Log Aktivitas:** hanya baca, tidak bisa diubah. Kategori aksi: Akun, Presensi, Koreksi Presensi, Izin, Presentasi, Penilaian (dicatat atas nama mentor, 26 Okt 2026), Lokasi & Jadwal, Kalender Libur, Pengaturan Umum, Warning, Pengumuman, Laporan. **[Keputusan, kategori diperbarui]**

**Chat:** admin bisa chat dengan semua pengguna, tidak bisa membaca chat orang lain. **[Keputusan]**

**Profil:** avatar inisial nama, admin mengubah nomor telepon. Tidak ada ganti password mandiri. **[Keputusan]**

---

## 17. Notifikasi Admin

| Kejadian | Isi | Tujuan klik |
|---|---|---|
| Mentor meng-ACC koreksi presensi | "Koreksi Nabila 6 Okt menunggu keputusan admin." | Detail koreksi |
| Izin pending lebih dari 24 jam | "Izin Putri belum diproses mentor lebih dari 24 jam." | Detail izin |
| Magang berakhir H-7 | "Magang Nabila berakhir dalam 7 hari." | Dashboard |
| Intern mengirim bukti presentasi | "Rizki mengirim bukti presentasi akhir." | Presentasi |
| Mentor menyubmit penilaian | "Penilaian Putri sudah disubmit." | Penilaian |
| Pesan chat | "Pesan baru dari [nama]." | Chat |

Admin tidak menerima notifikasi untuk setiap izin baru dan setiap keterlambatan. **[Keputusan]**

---

## 18. Aturan Tampilan

Warna status sama dengan `design-intern.md` Bagian 17.1 dan `design-mentor.md` Bagian 15.

| Status tambahan | Dipakai untuk | Warna |
|---|---|---|
| Menunggu Mentor | Koreksi | Kuning muda |
| Menunggu Admin | Koreksi | Kuning #F9A825 |
| Kuota habis | Izin | Merah #C62828 |
| Aktif / Nonaktif | Akun, kantor | Hijau / Abu-abu |

Aturan umum: badge selalu bertekst, dialog konfirmasi menjelaskan dampak dengan tombol berkata kerja jelas, tombol utama di kanan bawah, kondisi memuat/kosong/gagal tersedia, link bukti dibuka di tab baru.

Dialog konfirmasi wajib untuk: nonaktifkan akun, ganti mentor, reset password, perpanjang magang, setujui koreksi, tambah libur tanggal lampau, ubah jadwal mingguan, hapus jadwal khusus, nonaktifkan kantor, simpan warning.

---

## 19. Hak Akses Admin

| Area | Admin bisa | Admin tidak bisa |
|---|---|---|
| Akun | Buat, ubah, nonaktifkan, reset password, ganti mentor, perpanjang | Hapus akun, ubah role |
| Presensi | Melihat semua | Mengubah langsung tanpa koreksi |
| Koreksi | Memutuskan pengajuan yang sudah di-ACC mentor | Memproses yang masih Menunggu Mentor |
| Izin | Keputusan final untuk izin lewat 24 jam, Setujui hanya jika ada link bukti | Mengubah izin yang sudah diproses mentor |
| Logbook | Melihat | Mereview (hak mentor) |
| Presentasi | Setujui atau Revisi | - |
| Penilaian | Melihat dan export (Excel, PDF Penilaian) | Mengisi atau mengubah nilai |
| Warning | Membuat, mengubah dalam 24 jam | Menghapus |
| Lokasi & Jadwal | Mengatur kantor, radius, jadwal mingguan, jadwal khusus | Menghapus kantor |
| Pengaturan | Kalender libur dan pengaturan umum | Mengubah batas 23:59 |
| Laporan | Export Excel Presensi, PDF Daftar Kehadiran, PDF Penilaian | Format lain |
| Chat | Chat dengan semua | Membaca chat orang lain |
| Log | Melihat | Mengubah atau menghapus |

---

## 20. Ringkasan Keputusan dan Hal Terbuka

### 20.1 Keputusan baru (24 Oktober 2026)

| No | Topik | Keputusan |
|---|---|---|
| 1 | Istilah | Absensi menjadi Presensi |
| 2 | Status | Hadir, Terlambat, Lupa Clock In, Izin, Tidak Hadir, Libur + tanda Lupa Clock Out |
| 3 | Jadwal | Per lokasi kantor: jadwal mingguan (sekaligus atau per hari) + jadwal khusus per rentang tanggal |
| 4 | Libur | Diinput manual admin, berlaku untuk semua kantor |
| 5 | Koreksi | Mentor ACC, admin mengeksekusi. Tanpa bukti. Hasil Hadir + Dikoreksi, jam kosong diisi jam jadwal |
| 6 | Izin | Admin final jika mentor tidak memproses 24 jam. Kuota 3 kali, diblokir, reset saat perpanjangan |
| 7 | Presentasi | Admin memverifikasi link bukti |
| 8 | Penilaian | Diisi mentor, admin melihat dan export |
| 9 | Warning | Terlihat intern dan mentor, intern mendapat notifikasi |
| 10 | Dashboard | Filter lokasi global, kartu bisa diklik, minim klik |
| 11 | Laporan | Excel siap pakai, 4 rekap, filter periode, lokasi, mentor, intern |
| 12 | Data intern | Unit, lokasi magang, universitas, jurusan |
| 13 | Task dan upload file | Dihapus |

### 20.2 Hal terbuka

| No | Topik | Keterangan |
|---|---|---|
| 1 | Indikator dan rumus penilaian | **Selesai 26 Okt 2026**: 9 indikator, rata-rata, predikat |
| 2 | Toleransi terlambat 15 menit | Menunggu konfirmasi mitra, bisa diubah di Pengaturan Umum |
| 3 | E-sertifikat otomatis | Di luar cakupan versi ini |
| 4 | Membuka kembali penilaian yang sudah disubmit | Usulan: admin bisa membuka kembali agar mentor memperbaiki. Perlu konfirmasi |
| 5 | Unit sebagai teks bebas | Usulan: teks bebas dulu. Jika laporan per unit dibutuhkan, dijadikan daftar pilihan |
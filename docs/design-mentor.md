# design-mentor.md - Desain Role Mentor (Lengkap, Berdasarkan Alur)

Sistem: Web Intern Management dan Attendance System
Versi: Draft 2 | Tanggal: 24 Oktober 2026 | Acuan: PRD, design-intern.md (Draft 3), design-admin.md (Draft 3), Arsitektur Backend & Desain Data (Versi 2)

Perubahan Draft 2 (hasil wawancara mitra 22 Oktober 2026):
- **Task, Kanban, Accept/Revise, dan komentar Task dihapus.** Mentor kini **mereview Logbook** harian intern: Disetujui atau Revisi.
- Mentor **memvalidasi koreksi presensi** (ACC atau tolak) sebelum diteruskan ke admin.
- Mentor kini **melihat status Terlambat** (sebelumnya disembunyikan).
- Fitur baru: **Penilaian Intern** di akhir magang, menjadi dasar e-sertifikat.
- Mentor dapat **membaca catatan warning** intern bimbingannya.
- KPI Performa disesuaikan karena Task dihapus.
- Bukti izin berupa **link Google Drive/Docs**, bukan file.

Tanda:
- **[Keputusan]** = sudah disepakati.
- **[Usulan]** = pilihan desain dari saya, diikuti kecuali tercantum di Bagian 17.

---

## 1. Cara Membaca Dokumen Ini

Dokumen disusun menurut **alur kerja Mentor**.

Isi:
1. Cara membaca
2. Gambaran Mentor dan navigasi
3. Alur 1 - Login pertama dan profil
4. Alur 2 - Dashboard
5. Alur 3 - Melihat intern bimbingan
6. Alur 4 - Mereview logbook
7. Alur 5 - Memvalidasi koreksi presensi
8. Alur 6 - Memproses izin
9. Alur 7 - Kalender izin
10. Alur 8 - Performa intern
11. Alur 9 - Penilaian intern
12. Alur 10 - Chat dan notifikasi
13. Situasi khusus
14. Notifikasi Mentor
15. Aturan tampilan
16. Hak akses Mentor
17. Ringkasan keputusan dan hal terbuka

---

## 2. Gambaran Mentor dan Navigasi

**Peran:** Mentor di unit membimbing intern: mereview logbook harian, memvalidasi koreksi presensi, memproses izin, memantau kehadiran, dan memberi penilaian akhir. **[Keputusan]**

**Cakupan data:** hanya intern bimbingan sendiri. **[Keputusan]**

**Platform:** web responsif, desktop dan ponsel. Di ponsel sidebar menjadi menu bawah. **[Keputusan]**

**Prinsip "one touch point":** review logbook, ACC koreksi, dan proses izin bisa dilakukan langsung dari Dashboard tanpa berpindah banyak halaman. **[Keputusan]**

### 2.1 Kerangka halaman

```
+------------------------------------------------------------------------+
| [Logo]  Nama Sistem                         [Chat] [Bell 4] [Mentor v] |
+------------------+-----------------------------------------------------+
| Dashboard        |                                                     |
| Intern Saya      |                                                     |
| Logbook (5)      |              AREA KONTEN HALAMAN                    |
| Koreksi (1)      |                                                     |
| Izin (2)         |                                                     |
| Kalender Izin    |                                                     |
| Performa Intern  |                                                     |
| Penilaian (1)    |                                                     |
+------------------+-----------------------------------------------------+
```

Angka = jumlah yang menunggu tindakan mentor.

Ponsel: menu bawah **Beranda, Logbook, Koreksi, Izin, Lainnya**. Lainnya berisi Intern Saya, Kalender Izin, Performa, Penilaian, Profil. **[Usulan]**

### 2.2 Menu

| Menu | Isi | Alamat (usulan) |
|---|---|---|
| Dashboard | Ringkasan hari ini dan antrean tindakan | /mentor/dashboard |
| Intern Saya | Daftar dan detail intern bimbingan | /mentor/interns |
| Logbook | Antrean review logbook | /mentor/logbooks |
| Koreksi | Pengajuan koreksi presensi yang perlu divalidasi | /mentor/corrections |
| Izin | Pengajuan izin | /mentor/leaves |
| Kalender Izin | Kalender izin intern bimbingan | /mentor/leave-calendar |
| Performa Intern | Rekap kehadiran dan KPI | /mentor/performance |
| Input Nilai | Penilaian akhir intern berdasarkan 9 indikator | /mentor/assessments |

Menu yang **tidak ada**: Task (dihapus), Laporan/Export, Pengaturan, Log Aktivitas, Pengumuman (hanya menerima).

---

## 3. Alur 1 - Login Pertama dan Profil

Sama dengan Intern (lihat `design-intern.md`, Alur 1):
- Akun dibuat admin dengan email internal dan password sementara. Ganti password wajib di login pertama. **[Keputusan]**
- Tidak ada Google OAuth dan tidak ada ganti password mandiri. Lupa password: hubungi admin. **[Keputusan]**
- Profil menampilkan nama, email, unit. Mentor hanya mengubah nomor telepon. Avatar memakai inisial nama. **[Usulan]**

---

## 4. Alur 2 - Dashboard

### 4.1 Layout

```
+------------------------------------------------------------------------+
| Dashboard                                      Senin, 12 Okt 2026      |
|                                                                        |
| INTERN SAYA HARI INI (4 intern)   (klik kotak untuk melihat nama)      |
| [Sudah Presensi 2] [Terlambat 1] [Izin 1] [Belum Clock In 1]           |
|                                                                        |
|  Rizki   08:02  Hadir                                                  |
|  Dimas   08:25  Terlambat                                              |
|  Putri   -      Izin Sakit                                             |
|  Nabila  -      Belum Clock In                                         |
|                                                                        |
| PERLU TINDAKAN                                                         |
| +--------------------------------+ +---------------------------------+ |
| | Logbook menunggu review (5)    | | Koreksi presensi (1)            | |
| | Rizki   9 Okt   [Setujui][Buka]| | Nabila  6 Okt  Lupa Clock Out   | |
| | Dimas   9 Okt   [Setujui][Buka]| |            [Tolak] [ACC]        | |
| |            [Review semua]      | |                                 | |
| +--------------------------------+ +---------------------------------+ |
| +--------------------------------+ +---------------------------------+ |
| | Izin menunggu (2)              | | Siap dinilai (1)                | |
| | Putri  Sakit 12-13 Okt  [Buka] | | Rizki  presentasi & logbook ok  | |
| |  ! 26 jam, akan diambil admin  | |                     [Nilai]     | |
| +--------------------------------+ +---------------------------------+ |
|                                                                        |
| PENGUMUMAN                                                             |
+------------------------------------------------------------------------+
```

### 4.2 Aturan

| Bagian | Aturan |
|---|---|
| Kartu hari ini | Jumlah per status hari ini. **Setiap kotak bisa diklik** dan menampilkan nama intern. Daftar nama dengan jam masuk tampil di bawahnya. **[Keputusan]** Hari berjalan memakai "Belum Clock In", status final setelah 23:59 |
| Logbook menunggu review | Tombol **Setujui** langsung di baris untuk logbook yang sudah jelas. **Buka** untuk membaca lengkap atau meminta revisi. **[Keputusan: one touch point]** |
| Koreksi presensi | Tombol **ACC** dan **Tolak** langsung di baris. Tolak membuka kotak catatan. |
| Izin menunggu | Izin lebih dari 24 jam diberi tanda "akan diambil admin". **[Keputusan]** |
| Siap dinilai | Intern yang presentasinya disetujui dan semua logbook sudah disetujui. |

Tiap kotak menampilkan maksimal 5 baris, sisanya lewat tombol "semua". Kotak kosong disembunyikan.

### 4.3 Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| Hari libur | Banner "Hari ini hari libur: [nama]". Kartu hari ini disembunyikan |
| Belum punya intern | "Belum ada intern bimbingan. Hubungi admin." |
| Data gagal dimuat | "Data gagal dimuat." + **Coba lagi** |

---

## 5. Alur 3 - Melihat Intern Bimbingan

### 5.1 Daftar intern

```
+------------------------------------------------------------------------+
| Intern Saya                                                            |
| Cari: [________]  Status: [Aktif v]                                    |
|                                                                        |
| Nama     Universitas   Lokasi      Hari ini    Periode         Aksi    |
| Rizki    Telkom Univ   Soetta T3   Hadir       1 Sep-31 Des    [Buka]  |
| Nabila   UI            Soetta T3   Belum CI    1 Sep-17 Okt    [Buka]  |
|                                     ! berakhir 7 hari lagi            |
+------------------------------------------------------------------------+
```

Intern nonaktif tetap bisa dilihat lewat filter. Mentor tidak bisa menambah atau mengubah data intern. **[Keputusan]**

### 5.2 Detail intern

```
+------------------------------------------------------------------------+
| < Intern Saya    Rizki Pratama                    [Chat dengan intern] |
| Unit: Divisi IT | Lokasi: Soetta T3 | Telkom Univ - Sistem Informasi   |
| Periode: 1 Sep - 31 Des 2026 | Sisa kuota izin: 2 dari 3               |
|                                                                        |
| [Presensi] [Logbook] [Izin] [Koreksi] [Catatan] [Akhir Magang]         |
+------------------------------------------------------------------------+
```

| Tab | Isi | Sifat |
|---|---|---|
| Presensi | Rekap bulanan dan riwayat harian | Hanya baca |
| Logbook | Semua logbook intern ini | Review (Alur 4) |
| Izin | Riwayat izin | Proses yang Menunggu (Alur 6) |
| Koreksi | Riwayat koreksi | Validasi yang Menunggu Mentor (Alur 5) |
| Catatan | Catatan warning dari admin | **Hanya baca** **[Keputusan]** |
| Akhir Magang | Status presentasi dan penilaian | Penilaian (Alur 9) |

### 5.3 Tab Presensi

```
+------------------------------------------------------------------------+
| Presensi           Bulan: [< Oktober 2026 >]                           |
| Hadir 14 | Terlambat 2 | Lupa Clock In 0 | Izin 1 | Tidak Hadir 1      |
| Lupa Clock Out: 1 kali | Hari kerja 18                                 |
|                                                                        |
| Tanggal      Masuk  Pulang  Status       Catatan                       |
| Jum, 9 Okt   08:02  17:00   Hadir        Dikoreksi                     |
| Kam, 8 Okt   08:25  17:05   Terlambat    25 menit                      |
| Sel, 6 Okt   08:00  -       Hadir        Lupa Clock Out                |
+------------------------------------------------------------------------+
```

- Mentor **melihat status Terlambat**. **[Keputusan, mengganti keputusan 17 Okt 2026]**
- Mentor tidak mengubah presensi. Perbaikan hanya lewat koreksi presensi. **[Keputusan]**

---

## 6. Alur 4 - Mereview Logbook

**Tujuan:** memastikan catatan harian intern benar, sebagai pengganti logbook yang dulu di-ACC manual. **[Keputusan]**

**Aturan:**
- Logbook masuk ke mentor saat intern clock out (status **Menunggu Review**). **[Keputusan]**
- Mentor memilih **Setujui** atau **Revisi + komentar**. Tidak ada Tolak. **[Keputusan]**
- Logbook Disetujui terkunci. Logbook Revisi kembali ke intern, lalu dikirim ulang. **[Keputusan]**
- Tidak ada eskalasi ke admin. Mentor **wajib menyetujui semua logbook** agar penilaian bisa dilakukan. **[Keputusan]**

### 6.1 Layar antrean

```
+------------------------------------------------------------------------+
| Logbook                                                                |
| Tab: [Menunggu Review (5)] [Revisi (1)] [Semua]   Intern: [Semua v]    |
|                                                                        |
| [ ] Intern  Tanggal     Ringkasan                          Aksi        |
| [ ] Rizki   Jum, 9 Okt  "Menyusun ERD modul presensi..."   [Buka]      |
| [ ] Dimas   Jum, 9 Okt  "Rapat dengan unit keuangan..."    [Buka]      |
| [ ] Rizki   Kam, 8 Okt  "Revisi dokumen kebutuhan..."      [Buka]      |
|                                                                        |
|                              [ Setujui yang dipilih (0) ]              |
+------------------------------------------------------------------------+
```

- **Setujui yang dipilih** untuk menyetujui banyak logbook sekaligus. Mengurangi klik karena logbook datang setiap hari. **[Usulan berdasar masukan "minim klik"]**
- Diurutkan dari tanggal paling lama.

### 6.2 Layar detail

```
+--------------------------------------------------+
| Logbook - Rizki, Kam 8 Okt 2026                  |
| Status: Menunggu Review   Presensi: Hadir 08:02-17:00 |
|                                                  |
| Yang dikerjakan:                                 |
| Revisi dokumen kebutuhan bersama tim IT...       |
| Kendala:                                         |
| Akses server belum diberikan.                    |
|                                                  |
| Riwayat review: belum ada                        |
|                                                  |
| Komentar revisi                                  |
| [______________________________________________] |
|                       [ Minta Revisi ] [ Setujui ] |
|              [< Sebelumnya]  [Berikutnya >]      |
+--------------------------------------------------+
```

- **Minta Revisi** wajib berisi komentar. Pesan: "Tulis komentar revisi." **[Keputusan]**
- **Setujui** tidak wajib komentar.
- Tombol Sebelumnya/Berikutnya untuk lanjut ke logbook berikutnya tanpa kembali ke daftar. **[Usulan]**
- Riwayat komentar revisi sebelumnya tetap tampil.

### 6.3 Kondisi khusus

| Kondisi | Perilaku |
|---|---|
| Intern sedang memperbaiki (Revisi) | Mentor hanya bisa membaca, menunggu dikirim ulang |
| Logbook hari yang dikoreksi | Label "Diisi setelah koreksi presensi" |
| Intern sudah nonaktif dan logbook masih Revisi | Peringatan: "Intern sudah nonaktif dan tidak dapat memperbaiki logbook." Mentor tetap bisa langsung Setujui agar penilaian terbuka **[Usulan]** |

---

## 7. Alur 5 - Memvalidasi Koreksi Presensi

**Tujuan:** mentor memastikan kebenaran pengajuan koreksi, karena mentor yang tahu intern benar-benar masuk. **[Keputusan]**

**Aturan:**
- Pengajuan berisi tanggal, kondisi, dan alasan. **Tanpa bukti**; ACC mentor menjadi buktinya. **[Keputusan]**
- Mentor memilih **ACC** (diteruskan ke admin) atau **Tolak** (selesai). **[Keputusan]**
- Admin menunggu mentor, tidak ada eskalasi otomatis. **[Keputusan]**
- Mentor tidak mengubah data presensi. Admin yang mengeksekusi. **[Keputusan]**

### 7.1 Layar

```
+------------------------------------------------------------------------+
| Koreksi Presensi                                                       |
| Tab: [Menunggu Saya (1)] [Semua]                                       |
|                                                                        |
| Intern   Tanggal     Kondisi          Alasan                  Aksi     |
| Nabila   Sel, 6 Okt  Lupa Clock Out   "Baterai HP habis..."    [Tolak][ACC] |
| Dimas    Kam, 1 Okt  Terlambat        "Gangguan KRL..."   Menunggu Admin |
| Putri    Rab, 30 Sep Tidak Hadir      "..."               Ditolak Mentor |
+------------------------------------------------------------------------+
```

Dialog Tolak:

```
+--------------------------------------------------+
| Tolak koreksi - Nabila, 6 Okt 2026               |
| Catatan *  [___________________________________] |
|                       [ Batal ]  [ Tolak ]       |
+--------------------------------------------------+
```

Dialog ACC (konfirmasi singkat):

```
+--------------------------------------------------+
| ACC koreksi - Nabila, 6 Okt 2026?                |
| Pengajuan diteruskan ke admin. Jika disetujui    |
| admin, status hari itu menjadi Hadir.            |
| Catatan (opsional) [___________________________] |
|                       [ Batal ]  [ ACC ]         |
+--------------------------------------------------+
```

| Kondisi | Perilaku |
|---|---|
| Intern membatalkan saat mentor membuka | "Pengajuan ini sudah dibatalkan intern." |
| Keputusan sudah diambil | Hanya baca. Mentor tidak bisa mengubah ACC atau Tolak **[Usulan]** |

---

## 8. Alur 6 - Memproses Izin

**Aturan:**
- Izin Sakit dan Izin Urgent. Tidak ada cuti. **[Keputusan]**
- Bukti berupa **link Google Drive/Docs**, opsional. Mentor membuka link untuk memeriksa. **[Keputusan]**
- Kuota 3 kali per masa magang dijaga sistem di sisi intern. Mentor melihat sisa kuota sebagai informasi. **[Keputusan]**
- Jika tidak diproses dalam **24 jam**, admin memberi keputusan final. **[Keputusan]**
- Catatan wajib saat Setujui maupun Tolak. **[Usulan, sama dengan sebelumnya]**

### 8.1 Layar detail

```
+--------------------------------------------------+
| Izin - Putri                      Status: Menunggu |
| Jenis: Sakit   Tanggal: 12-13 Okt (2 hari kerja) |
| Diajukan: 11 Okt 20:15 (pending 14 jam)          |
| Kuota terpakai: 2 dari 3 (termasuk izin ini)     |
| Alasan: "Demam, disarankan istirahat dokter."    |
| Bukti: https://drive.google.com/...  [Buka link] |
|                                                  |
| Catatan *  [___________________________________] |
|                       [ Tolak ]  [ Setujui ]     |
+--------------------------------------------------+
```

| Kondisi | Perilaku |
|---|---|
| Tanpa link bukti | Label "Tanpa bukti". Mentor tetap boleh memutuskan |
| Link tidak bisa dibuka | Mentor menolak dengan catatan "Link tidak bisa dibuka." Kuota intern tidak terpakai karena ditolak |
| Lewat 24 jam dan admin memutuskan | Layar hanya baca, "Izin ini sudah diproses oleh admin." |
| Intern membatalkan | "Pengajuan ini sudah dibatalkan intern." |

---

## 9. Alur 7 - Kalender Izin

Tetap seperti sebelumnya: izin Menunggu tampil bergaris tepi, Disetujui berwarna penuh, Ditolak dan Dibatalkan hilang. Hari libur mengikuti jadwal lokasi magang intern dan hari libur admin. **[Keputusan]**

```
+------------------------------------------------------------------------+
| Kalender Izin          < Oktober 2026 >         Intern: [Semua v]      |
|  Sen     Sel     Rab     Kam     Jum     Sab     Min                   |
|  12      13      14      15      16      17      18                    |
|  Putri(S)Putri(S)                        libur   libur                 |
|  [Penuh] Disetujui   [Garis tepi] Menunggu   (S) Sakit (U) Urgent      |
+------------------------------------------------------------------------+
```

---

## 10. Alur 8 - Performa Intern

**Aturan:** dashboard pemantauan berisi rekap kehadiran dan KPI. Bukan nilai akhir. Tidak ada export untuk mentor. **[Keputusan]**

### 10.1 Layout

```
+------------------------------------------------------------------------+
| Performa Intern     Periode: [Oktober 2026 v]   Intern: [Semua v]      |
|                                                                        |
| Intern   Hadir Terlambat LupaCI LupaCO Izin TdkHadir  Hari kerja       |
| Rizki    16    2         0      1      1    0         18               |
| Dimas    13    3         1      0      0    1         18               |
|                                                                        |
| KPI      Kehadiran  Tepat waktu  Logbook disetujui  Revisi logbook    |
| Rizki    100%       89%          94%                2                 |
| Dimas    94%        76%          88%                5                 |
|                                                                        |
| KPI hanya untuk pemantauan dan bukan nilai intern.                     |
+------------------------------------------------------------------------+
```

### 10.2 Rumus KPI (diganti karena Task dihapus)

| Indikator | Rumus | Catatan |
|---|---|---|
| Kehadiran | (Hadir + Terlambat + Lupa Clock In) dibagi (hari kerja dikurangi hari Izin) | Izin disetujui tidak dihitung ketidakhadiran |
| Tepat waktu | Hari Hadir (tidak Terlambat) dibagi (Hadir + Terlambat) | Lupa Clock In tidak dihitung karena tidak ada jam masuk |
| Logbook disetujui | Logbook Disetujui dibagi hari yang wajib berlogbook | Menunjukkan pekerjaan review yang tersisa |
| Revisi logbook | Jumlah permintaan revisi | Informasi saja |

Semua rumus **[Usulan]**. Data kurang dari 5 hari kerja menampilkan "Data belum cukup".

Setiap angka bisa diklik untuk melihat daftar harinya. **[Keputusan: dashboard bisa diklik]**

---

## 11. Alur 9 - Penilaian Intern

**Tujuan:** mentor memberi nilai akhir per indikator. Nilai menjadi dasar sertifikat, menggantikan formulir kertas. **[Keputusan]**

**Aturan:** (diperbarui 26 Okt 2026, menu **Input Nilai**)
- Penilaian baru terbuka jika **presentasi akhir sudah disetujui admin** dan **semua logbook sudah disetujui mentor**. **[Keputusan]**
- **9 indikator tetap** dari formulir "Penilaian Magang", dikelompokkan per kategori: Motivasi (Perhatian terhadap Instruksi/Petunjuk, Disiplin Kerja, Inisiatif), Kemampuan Kerja (Pengetahuan tentang Pekerjaan, Kualitas Pekerjaan / Keterampilan, Efektivitas Penggunaan Waktu Kerja), Kepribadian (Keberhasilan, Kemampuan Menyesuaikan Diri dengan Lingkungan, Tanggung Jawab). **[Keputusan]**
- Nilai **bilangan bulat 0-100** per indikator. Nilai akhir = **rata-rata**, 2 desimal, dihitung di server. **[Keputusan]**
- **Predikat** dari nilai akhir: ≥ 86 Baik Sekali, ≥ 71 Baik, ≥ 60 Cukup, < 60 Kurang. Dihitung di server. **[Keputusan]**
- **Catatan** mentor opsional, maksimal 1000 karakter. Ikut tercetak di PDF Penilaian. **[Keputusan]**
- Bisa disimpan sebagai draft. Setelah **Submit**, terkunci dan admin diberi tahu. Setiap perubahan nilai dan submit tercatat di Log Aktivitas. **[Keputusan]**

### 11.1 Daftar penilaian

```
+------------------------------------------------------------------------+
| Penilaian                                                              |
|                                                                        |
| Intern   Selesai magang  Presentasi  Logbook       Status       Aksi   |
| Rizki    31 Des 2026     Disetujui   Semua ok      Siap dinilai [Nilai]|
| Nabila   17 Okt 2026     Menunggu    2 belum ok    Belum bisa   [Lihat]|
| Putri    30 Sep 2026     Disetujui   Semua ok      Selesai 87,5 [Lihat]|
+------------------------------------------------------------------------+
```

"Belum bisa" menampilkan alasannya, misalnya "2 logbook belum disetujui" dengan tautan ke logbook tersebut.

### 11.2 Formulir

```
+---------------------------------------------------------+
| Input Nilai - Rizki Pratama                             |
| Periode: 1 Sep - 31 Des 2026                            |
|                                                         |
| Indikator                                 Nilai (0-100) |
| MOTIVASI                                                |
| 1 Perhatian terhadap Instruksi/Petunjuk   [ 90 ]        |
| 2 Disiplin Kerja                          [ 85 ]        |
| 3 Inisiatif                               [ 80 ]        |
| KEMAMPUAN KERJA                                         |
| 4 Pengetahuan tentang Pekerjaan           [ 88 ]        |
| 5 Kualitas Pekerjaan / Keterampilan       [ 84 ]        |
| 6 Efektivitas Penggunaan Waktu Kerja      [ 82 ]        |
| KEPRIBADIAN                                             |
| 7 Keberhasilan                            [ 86 ]        |
| 8 Kemampuan Menyesuaikan Diri ...         [ 90 ]        |
| 9 Tanggung Jawab                          [ 92 ]        |
|                                                         |
| Nilai rata-rata (otomatis)   86,33   Predikat: Baik Sekali |
| Catatan  [______________________________________]       |
|                                                         |
| Setelah submit nilai tidak bisa diubah.                 |
|                    [ Simpan Draft ]  [ Submit ]         |
+---------------------------------------------------------+
```

| Validasi | Pesan |
|---|---|
| Nilai kosong saat submit | "Isi semua nilai sebelum submit." |
| Nilai di luar 0-100 | "Nilai harus antara 0 dan 100." |
| Nilai bukan bilangan bulat | "Nilai harus berupa bilangan bulat." |
| Catatan lebih dari 1000 karakter | "Catatan maksimal 1000 karakter." |
| Syarat belum terpenuhi (dicek ulang di server) | "Penilaian belum bisa dilakukan: [alasan]." |

Dialog Submit: "Submit penilaian Rizki? Nilai akan dikirim ke admin dan tidak bisa diubah." Tombol **Submit Penilaian**.

Jika nilai perlu dikoreksi setelah submit, mentor menghubungi admin. **[Usulan, lihat Bagian 17]**

---

## 12. Alur 10 - Chat dan Notifikasi

- Semua pengguna dapat saling chat. Admin tidak membaca chat orang lain. **[Keputusan]**
- Admin memakai chat untuk menanyakan perpanjangan magang. **[Keputusan]**
- Notifikasi lewat bell icon di navbar. **[Keputusan]**

---

## 13. Situasi Khusus

### 13.1 Ganti mentor oleh admin

| Sisi | Yang terjadi |
|---|---|
| Mentor baru | Intern muncul di Intern Saya. Logbook Menunggu Review, koreksi Menunggu Mentor, dan izin Menunggu pindah ke mentor baru. Notifikasi masuk |
| Mentor lama | Intern hilang dari daftar aktif, bisa dilihat hanya baca lewat filter "Pernah dibimbing". Keputusan lama tetap tercatat atas namanya |

Penilaian dilakukan oleh mentor saat penilaian dibuka. **[Usulan]**

### 13.2 Magang segera berakhir

- Admin bertanya ke mentor lewat chat apakah intern diperpanjang. Mentor menjawab di chat, admin yang mengubah tanggal. **[Keputusan]**
- Intern diingatkan H-7 untuk presentasi di unit. Mentor mendampingi presentasi. **[Keputusan]**
- Saran: selesaikan review semua logbook sebelum hari terakhir agar penilaian bisa langsung dilakukan.

### 13.3 Intern nonaktif

Data tetap bisa dilihat. Mentor tetap bisa menyetujui logbook dan memberi penilaian. **[Usulan]**

---

## 14. Notifikasi Mentor

| Kejadian | Isi | Tujuan klik |
|---|---|---|
| Intern mengirim ulang logbook setelah revisi | "Rizki memperbaiki logbook 8 Okt." | Detail logbook |
| Logbook baru dari clock out | Tidak dikirim satu per satu. Cukup angka di menu dan Dashboard **[Usulan, menghindari notifikasi harian berlebihan]** | - |
| Intern mengajukan koreksi presensi | "Nabila mengajukan koreksi presensi 6 Okt." | Koreksi |
| Admin memutuskan koreksi yang di-ACC | "Koreksi Nabila 6 Okt disetujui admin." | Koreksi |
| Intern mengajukan izin | "Putri mengajukan Izin Sakit 12-13 Okt." | Detail izin |
| Intern membatalkan izin | "Putri membatalkan izin 12-13 Okt." | Izin |
| Admin memutuskan izin yang lewat 24 jam | "Izin Putri diproses oleh admin." | Detail izin |
| Presentasi intern disetujui admin | "Presentasi akhir Rizki disetujui." | Penilaian |
| Penilaian siap dilakukan | "Rizki siap dinilai." | Penilaian |
| Warning baru untuk intern bimbingan | "Ada catatan baru untuk Dimas." | Tab Catatan |
| Ganti mentor | "Intern [nama] kini menjadi bimbingan Anda." | Intern Saya |
| Chat, pengumuman | Seperti biasa | - |

Mentor **tidak** menerima notifikasi keterlambatan clock in. **[Keputusan]**

---

## 15. Aturan Tampilan

Warna status sama dengan `design-intern.md` Bagian 17.1. Tambahan:

| Status | Dipakai untuk | Warna |
|---|---|---|
| Siap dinilai | Penilaian | Biru #1565C0 |
| Belum bisa | Penilaian | Abu-abu |
| Draft | Penilaian | Abu-abu |
| Selesai | Penilaian | Hijau |

Aturan umum: badge selalu bertekst, tanggal "Sen, 12 Okt 2026", waktu 24 jam, tombol utama di kanan bawah, dialog konfirmasi menjelaskan dampak, kondisi memuat/kosong/gagal tersedia, link bukti dibuka di tab baru.

---

## 16. Hak Akses Mentor

| Area | Mentor bisa | Mentor tidak bisa |
|---|---|---|
| Intern | Melihat intern bimbingan sendiri (termasuk nonaktif) | Mengubah data intern, melihat intern mentor lain |
| Presensi | Melihat, termasuk status Terlambat | Mengubah presensi |
| Logbook | Setujui, Minta Revisi, setujui banyak sekaligus | Mengedit isi logbook, menolak |
| Koreksi | ACC atau Tolak | Mengubah data presensi, mengubah keputusan |
| Izin | Setujui atau Tolak izin intern bimbingan | Mengubah izin yang sudah diputuskan |
| Warning | Membaca catatan intern bimbingan | Membuat atau mengubah |
| Performa | Melihat rekap dan KPI | Export |
| Input Nilai | Mengisi nilai 9 indikator dan catatan, submit penilaian intern bimbingan setelah syarat terpenuhi | Mengubah setelah submit, menilai intern lain, export PDF |
| Presentasi | Melihat status | Memverifikasi (hak admin) |
| Laporan, Pengaturan, Log | - | Semua |

---

## 17. Ringkasan Keputusan dan Hal Terbuka

### 17.1 Keputusan

| No | Topik | Keputusan |
|---|---|---|
| 1 | Task | Dihapus, termasuk Kanban dan komentar |
| 2 | Logbook | Mentor Setujui atau Minta Revisi (komentar wajib). Tanpa Tolak, tanpa eskalasi |
| 3 | Koreksi presensi | Mentor ACC atau Tolak, admin mengeksekusi. Tanpa bukti |
| 4 | Izin | Mentor memproses, admin final setelah 24 jam. Bukti berupa link |
| 5 | Terlambat | Terlihat oleh mentor |
| 6 | Warning | Mentor membaca catatan intern bimbingannya |
| 7 | Penilaian | Menu Input Nilai. Terbuka setelah presentasi disetujui dan semua logbook disetujui. 9 indikator tetap, nilai bulat 0-100, rata-rata dan predikat dihitung server, catatan opsional (26 Okt 2026) |
| 8 | KPI | Kehadiran, tepat waktu, logbook disetujui, jumlah revisi |
| 9 | Notifikasi terlambat | Tidak ada |

### 17.2 Hal terbuka

| No | Topik | Keterangan |
|---|---|---|
| 1 | Indikator dan rumus penilaian | **Selesai 26 Okt 2026**: 9 indikator formulir Penilaian Magang, rata-rata, predikat |
| 2 | Koreksi nilai setelah submit | Usulan: mentor menghubungi admin, admin bisa membuka kembali penilaian. Perlu konfirmasi |
| 3 | Setujui banyak logbook sekaligus | Usulan untuk mengurangi klik. Perlu konfirmasi bahwa mitra tidak mewajibkan membaca satu per satu |
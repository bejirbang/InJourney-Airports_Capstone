# Perubahan: Penyesuaian Tampilan PDF & Penguatan Keamanan Export

Tanggal: 27 Oktober 2026
Status: siap dikerjakan
Sumber template: `Daftar Kehadiran Magang.pdf`, `Penilaian Magang.pdf`
Lanjutan dari: `update26okt.md`

---

## 1. Ringkasan Perubahan

| Area | Perubahan |
|---|---|
| PDF Daftar Kehadiran | Judul, posisi Bulan/Tahun, struktur kolom tabel, dan tanda tangan disamakan dengan template mitra |
| PDF Penilaian | Judul, urutan identitas, header tabel, penomoran per kategori, dan keterangan disamakan dengan template mitra |
| Keamanan export | Header anti-cache, config dompdf dikunci, rate limit route export |
| Seeder | 9 indikator penilaian ikut diisi di production |

Catatan: data dan logika bisnis PDF sudah benar (sesuai `update26okt.md`). Yang diubah hanya tampilan dan penguatan keamanan.

---

## 2. Keputusan

| Poin | Keputusan |
|---|---|
| Nama perusahaan di dokumen | `PT ANGKASA PURA INDONESIA` (menggantikan kop `INJOURNEY AIRPORTS`) |
| Baris "Predikat" di PDF Penilaian | Dihapus. Diganti daftar keterangan rentang nilai seperti template |
| Predikat di sistem | Tetap dihitung server dan tetap tampil di aplikasi, hanya tidak dicetak sebagai baris di PDF |
| "Kantor Regional I" | Hanya di PDF Daftar Kehadiran. PDF Penilaian tidak memakai baris ini |
| Kolom "No" Daftar Kehadiran | Dihapus |
| Penomoran indikator | Per kategori (1–3), bukan berurutan 1–9 |
| Nama mentor di PDF Daftar Kehadiran | Mentor yang berlaku saat ini di profil intern, untuk bulan apa pun. Riwayat pergantian mentor tidak disimpan |
| Nama mentor di PDF Penilaian | Mentor yang mengisi penilaian (tetap) |
| Migration baru | Tidak ada |

---

## 3. Yang Sudah Ada di Repo (tidak perlu diubah)

| Kebutuhan | Lokasi |
|---|---|
| Penyusunan data PDF | `app/Services/AdminPdfReports.php` |
| Endpoint PDF (admin only) | `routes/api.php` → `reports.attendance-pdf`, `reports.assessment-pdf` |
| Validasi input | `app/Http/Requests/Admin/PdfReportRequest.php` |
| Aturan hari kerja, izin, logbook draft, "(Dikoreksi)" | `AdminPdfReports::attendanceData()` |
| Gate penilaian submitted | `AdminPdfReports::assessmentData()` |
| Escape teks di template | Semua memakai `{{ }}` |
| Audit log export | `AuditLog::ACTION_REPORT` |

---

## 4. Perubahan Tampilan PDF

Lokasi: `backend/resources/views/pdf/`

### 4.1 Layout

File: `layout.blade.php`

- Kop `INJOURNEY AIRPORTS` + region dipindah dari layout ke masing-masing dokumen.
- Layout menyediakan `@yield('header')` agar tiap dokumen mengatur judulnya sendiri.

### 4.2 PDF Daftar Kehadiran

File: `daftar-kehadiran.blade.php`, `identity.blade.php`

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Judul | Kop `INJOURNEY AIRPORTS` + region, lalu `DAFTAR KEHADIRAN MAGANG` | 3 baris di tengah: `DAFTAR KEHADIRAN` / `PESERTA MAGANG/PKL PT ANGKASA PURA INDONESIA` / `{report_region_name}` |
| Bulan/Tahun | Baris terakhir blok identitas | `BULAN/TAHUN : {bulan}` di bawah judul, sebelum identitas |
| Identitas | Nama, Asal, Jurusan, Unit, Periode, Bulan/Tahun | Nama, Asal Universitas/Sekolah, Jurusan, Unit Penempatan, Periode Magang |
| Kolom tabel | No, Tanggal, Jam Masuk, Jam Keluar, Kegiatan, Keterangan | Tanggal, Jam (Masuk, Keluar), Kegiatan, Keterangan |
| Tanda tangan kiri | `Pembimbing,` | `Menyetujui,` / `Pembimbing Peserta Magang` |
| Tanda tangan kanan | `{kota}, {tanggal}` / `Peserta Magang,` | Tetap |

Header tabel dua tingkat:

```html
<thead>
    <tr>
        <th rowspan="2">Tanggal</th>
        <th colspan="2">Jam</th>
        <th rowspan="2">Kegiatan</th>
        <th rowspan="2">Keterangan</th>
    </tr>
    <tr>
        <th>Masuk</th>
        <th>Keluar</th>
    </tr>
</thead>
```

### 4.3 PDF Penilaian

File: `penilaian.blade.php`, `identity.blade.php`, `app/Services/AdminPdfReports.php`

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Judul | Kop `INJOURNEY AIRPORTS` + region, lalu `PENILAIAN MAGANG` | 2 baris di tengah: `PENILAIAN PESERTA MAGANG / PKL` / `PT ANGKASA PURA INDONESIA`. Tanpa region |
| Urutan identitas | Nama, NIM, Asal, Jurusan, Unit, Periode | Nama, Asal Universitas/Sekolah, Jurusan, NIM/NIS, Unit Penempatan, Periode Magang |
| Header tabel | No, Indikator Penilaian, Nilai (0-100) | No, KOMPONEN, DAFTAR NILAI (sub-header: Angka) |
| Baris kategori | Tanpa nomor, huruf biasa | Bernomor dan kapital: `1 MOTIVASI`, `2 KEMAMPUAN KERJA`, `3 KEPRIBADIAN` |
| Nomor indikator | 1–9 berurutan | 1–3 di dalam tiap kategori |
| Baris akhir | Nilai Rata-rata, Predikat | `NILAI RATA-RATA` saja |
| Keterangan | Satu kalimat `≥ 86 Baik Sekali, ...` | Daftar: `86-100 : Baik Sekali`, `71-85 : Baik`, `60-70 : Cukup`, `<60 : Kurang` |
| Catatan | Kotak tabel | `CATATAN: {isi}`. Jika kosong, garis titik-titik |
| Tanda tangan | `{kota}, {tanggal}` / `Pembimbing,` di kanan | Tetap |

Perubahan di `AdminPdfReports::assessmentData()`:

- Struktur `groups` diubah agar setiap kategori punya nomor kategori dan nomor indikator dimulai ulang dari 1.
- Nama kategori ditampilkan kapital (`mb_strtoupper`), data di database tetap.
- Indikator tanpa kategori masuk `LAINNYA`, diletakkan paling akhir.
- Urutan tetap berdasarkan `sort_order`, lalu `indicator_id`.
- Key `predicate` boleh tetap ada di data, hanya tidak dipakai template.

---

## 5. Penguatan Keamanan

| No | Perubahan | File | Alasan |
|---|---|---|---|
| 1 | Header `Cache-Control: no-store, private` dan `Pragma: no-cache` pada response PDF dan Excel | `app/Http/Controllers/Admin/ReportController.php` | Dokumen berisi data pribadi (NIM, nilai). Mencegah browser/proxy menyimpan salinan |
| 2 | Publish config dompdf, set eksplisit `enable_remote => false`, `enable_php => false`, `enable_javascript => false`, `chroot` tetap di folder proyek | `config/dompdf.php` (baru, hasil `vendor:publish`) | Saat ini bergantung pada default library. Jika default berubah saat upgrade, celah bisa muncul tanpa disadari |
| 3 | Rate limit `throttle:10,1` pada `reports.export`, `reports.attendance-pdf`, `reports.assessment-pdf` | `routes/api.php` | Pembuatan PDF/Excel berat untuk CPU |

| 4 | Relasi `mentor()` diberi `->withTrashed()`, sama seperti di `Assessment` | `app/Models/InternProfile.php` | Jika akun mentor pernah terhapus (soft delete), export Daftar Kehadiran tidak error 500 |
| 5 | Rule `city` menjadi `required` saat **tambah** bandara. Saat edit tetap seperti sekarang (tanpa `city` = kota lama dipertahankan) | `app/Http/Requests/Admin/AirportRequest.php` | Mencegah PDF tercetak tanpa nama kota karena admin lupa mengisi. Data bandara lama tidak terpengaruh |

Perintah publish config:

```bash
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"
```

Aturan yang tetap berlaku:

1. Semua teks dari data memakai `{{ }}`, bukan `{!! !!}`.
2. Template tidak memuat gambar, font, atau URL dari luar.
3. dompdf hanya mendukung CSS 2.1. Tata letak memakai `<table>`, bukan flexbox/grid.

---

## 6. Seeder

Masalah: 9 indikator penilaian hanya ada di `DatabaseSeeder`. `ProductionSeeder` tidak mengisinya, sehingga di production mentor tidak bisa menilai dan PDF Penilaian tidak bisa dibuat.

| File | Perubahan |
|---|---|
| `database/seeders/AssessmentIndicatorSeeder.php` (baru) | Satu sumber daftar 9 indikator (kategori, nama, `sort_order`). Pakai `updateOrCreate` berdasarkan nama agar aman dijalankan berulang |
| `database/seeders/DatabaseSeeder.php` | Panggil `AssessmentIndicatorSeeder`, hapus konstanta `INDICATORS` lama |
| `database/seeders/ProductionSeeder.php` | Panggil `AssessmentIndicatorSeeder` |

Daftar indikator tetap sama dengan `update26okt.md` bagian 5.

---

## 7. Pengujian

File: `tests/Feature/Admin/PdfReportTest.php`

| Test | Yang dicek |
|---|---|
| Judul Daftar Kehadiran | Memuat `PESERTA MAGANG/PKL PT ANGKASA PURA INDONESIA` dan region |
| Judul Penilaian | Memuat `PT ANGKASA PURA INDONESIA`, tidak memuat region dan baris `Predikat` |
| Penomoran indikator | Nomor indikator 1–3 per kategori, kategori bernomor 1–3 |
| Header anti-cache | `Cache-Control` berisi `no-store` pada response PDF dan Excel |
| Rate limit | Request ke-11 dalam 1 menit ditolak (429) |
| Escape | Test escape teks user yang sudah ada tetap lulus |
| Seeder | `ProductionSeeder` mengisi 9 indikator, dijalankan dua kali tidak duplikat |

Jalankan:

```bash
cd backend
php artisan test
```

Setelah lulus, buat contoh kedua PDF dari data seeder dan bandingkan secara visual dengan template mitra. File contoh tidak masuk repo.

---

## 8. Langkah Setelah Merge

```bash
cd backend
composer install
php artisan migrate:fresh --seed
```

Untuk production (tanpa reset data):

```bash
php artisan db:seed --class=AssessmentIndicatorSeeder
```

---

## 9. Perlu Dikonfirmasi ke Mitra

| Poin | Pertanyaan |
|---|---|
| Kop perusahaan | Benar memakai `PT ANGKASA PURA INDONESIA`, bukan `InJourney Airports`? |
| Predikat | Perlu dicetak sebagai baris di PDF Penilaian, atau cukup keterangan rentang? |
| Indikator "Keberhasilan" | Di kategori Kepribadian, apakah maksudnya "Kebersihan" atau "Kejujuran"? |
| Kota | Data `airports.city` untuk Soekarno-Hatta diisi `Tangerang` |

---

## 10. Catatan untuk Tim Frontend

Backend sudah siap. Bagian di bawah ini dikerjakan oleh tim frontend.

| No | Kebutuhan | Endpoint / Field | Keterangan |
|---|---|---|---|
| 1 | Tambah kolom input **Kota** di form tambah dan edit bandara | Field `city` (string, maks 100 karakter) pada endpoint tambah/edit bandara | **Wajib.** Saat ini belum ada input kota di UI, sehingga admin tidak bisa mengisinya dan PDF selalu tercetak tanpa nama kota |
| 2 | Tombol export PDF Daftar Kehadiran | `POST /api/admin/reports/attendance-pdf` dengan `intern_id` dan `month` (YYYY-MM) | Response berupa file PDF. Unduh lewat blob dengan Bearer token, seperti `downloadAttachment` di `api.ts` |
| 3 | Tombol export PDF Penilaian | `POST /api/admin/reports/assessment-pdf` dengan `intern_id` | Hanya berhasil jika penilaian sudah disubmit. Tampilkan pesan error dari backend jika ditolak |
| 4 | Pesan error rate limit | Response `429` | Setelah rate limit aktif (bagian 5 no. 3), tampilkan pesan seperti "Terlalu banyak permintaan, coba lagi sebentar" |

---

## 11. Dokumen yang Ikut Diupdate

- `design-admin.md` (tampilan hasil export PDF)
- `backend/progress.md` (status perubahan ini)
# Perubahan: Penilaian Mentor & Export PDF

Tanggal: 26 Oktober 2026
Status: siap dikerjakan
Sumber template: `Daftar Kehadiran Magang.pdf`, `Penilaian Magang.pdf`

---

## 1. Ringkasan Perubahan

| Role | Perubahan |
|---|---|
| Intern | Tambah identitas: jenis institusi (universitas/sekolah) dan NIM/NIS |
| Mentor | Menu **Input Nilai** berdasarkan 9 indikator tetap, ditambah catatan |
| Admin | Tarik 3 laporan: Excel Presensi, PDF Daftar Kehadiran, PDF Penilaian |

Catatan: keputusan lama "mentor tidak punya fitur penilaian" sudah tidak berlaku.

---

## 2. Keputusan

| Poin | Keputusan |
|---|---|
| Export presensi | Tetap Excel (sudah ada di `AdminReports`) |
| PDF Daftar Kehadiran | Gabungan presensi + logbook per tanggal, per intern per bulan |
| Isi Daftar Kehadiran | Hari kerja saja. Izin tetap tampil dengan Keterangan "Izin". Weekend & libur tidak ditampilkan |
| Kota di PDF | Diambil dari `airports.city` |
| Teks "Kantor Regional I" | Diambil dari `system_settings` key `report_region_name` |
| Alur nilai | Tetap draft → submitted (sudah ada di repo) |
| Format nilai | Bilangan bulat 0–100 per indikator |
| Rata-rata | Dihitung di server, dibulatkan 2 desimal |
| Predikat | ≥86 Baik Sekali, ≥71 Baik, ≥60 Cukup, <60 Kurang |
| Tanda tangan | Kolom kosong untuk tanda tangan basah |
| Gate input nilai | Presentasi akhir approved dan semua logbook sudah di-ACC (tetap) |

---

## 3. Yang Sudah Ada di Repo (tidak perlu dibuat)

| Kebutuhan | Lokasi |
|---|---|
| Asal universitas, jurusan | `intern_profiles.university`, `intern_profiles.major` |
| Unit penempatan | `users.unit_id` → `units` |
| Periode magang | `intern_profiles.start_date`, `end_date` |
| Tabel penilaian | `assessment_indicators`, `assessments`, `assessment_scores` |
| Input nilai mentor | `Mentor/AssessmentController`, `Mentor/AssessmentRequest` |
| Excel rekap | `app/Services/AdminReports.php` (pakai `openspout`) |

---

## 4. Migration Baru

Lokasi: `backend/database/migrations/`

Aturan: buat file baru, jangan edit migration lama. Kolom dibuat `nullable` karena tabel sudah berisi data. Kewajiban isi dipaksa lewat FormRequest.

### 4.1 Identitas intern

`2026_10_26_000001_add_identity_columns_to_intern_profiles_table.php`

```php
public function up(): void
{
    Schema::table('intern_profiles', function (Blueprint $table) {
        $table->enum('institution_type', ['universitas', 'sekolah'])->nullable()->after('user_id');
        $table->string('student_number', 30)->nullable()->after('major'); // NIM / NIS
    });
}

public function down(): void
{
    Schema::table('intern_profiles', function (Blueprint $table) {
        $table->dropColumn(['institution_type', 'student_number']);
    });
}
```

### 4.2 Kategori indikator

`2026_10_26_000002_add_category_to_assessment_indicators_table.php`

```php
public function up(): void
{
    Schema::table('assessment_indicators', function (Blueprint $table) {
        $table->string('category')->nullable()->after('id');
    });
}

public function down(): void
{
    Schema::table('assessment_indicators', function (Blueprint $table) {
        $table->dropColumn('category');
    });
}
```

### 4.3 Catatan penilaian

`2026_10_26_000003_add_notes_to_assessments_table.php`

```php
public function up(): void
{
    Schema::table('assessments', function (Blueprint $table) {
        $table->text('notes')->nullable()->after('final_score');
    });
}

public function down(): void
{
    Schema::table('assessments', function (Blueprint $table) {
        $table->dropColumn('notes');
    });
}
```

### 4.4 Kota bandara

`2026_10_26_000004_add_city_to_airports_table.php`

```php
public function up(): void
{
    Schema::table('airports', function (Blueprint $table) {
        $table->string('city')->nullable()->after('name');
    });
}

public function down(): void
{
    Schema::table('airports', function (Blueprint $table) {
        $table->dropColumn('city');
    });
}
```

Alasan `city` di `airports`: intern terhubung ke `airport_id`, bukan ke office.

---

## 5. Seeder

File: `backend/database/seeders/DatabaseSeeder.php`

Ganti konstanta `INDICATORS` (5 indikator lama) dengan 9 indikator berikut:

| Urutan | Kategori | Indikator |
|---|---|---|
| 1 | Motivasi | Perhatian terhadap Instruksi/Petunjuk |
| 2 | Motivasi | Disiplin Kerja |
| 3 | Motivasi | Inisiatif |
| 4 | Kemampuan Kerja | Pengetahuan tentang Pekerjaan |
| 5 | Kemampuan Kerja | Kualitas Pekerjaan / Keterampilan |
| 6 | Kemampuan Kerja | Efektivitas Penggunaan Waktu Kerja |
| 7 | Kepribadian | Keberhasilan |
| 8 | Kepribadian | Kemampuan Menyesuaikan Diri dengan Lingkungan |
| 9 | Kepribadian | Tanggung Jawab |

Tambahkan juga:
- `system_settings`: key `report_region_name`, value `Kantor Regional I`
- `airports.city` pada data airport contoh

Kolom `weight` dibiarkan `null` (rata-rata biasa).

---

## 6. Perubahan Kode Lain

| File | Perubahan |
|---|---|
| `app/Http/Requests/Mentor/AssessmentRequest.php` | Rule `score` → `integer`, `between:0,100`; tambah `notes` → `nullable`, `string`, `max:1000` |
| FormRequest admin create/edit intern | `institution_type` required, `in:universitas,sekolah`; `student_number` required, `string`, `max:30` |
| `app/Models/InternProfile.php` | Tambah `institution_type`, `student_number` ke `#[Fillable]` dan `@property` |
| `app/Models/AssessmentIndicator.php` | Tambah `category` |
| `app/Models/Assessment.php` | Tambah `notes` |
| `app/Models/Airport.php` | Tambah `city` |
| `composer.json` | `composer require barryvdh/laravel-dompdf` |

---

## 7. Export PDF (Admin)

### 7.1 PDF Daftar Kehadiran

- Input: `intern_id`, `month` (YYYY-MM)
- Data per baris (hari kerja): Tanggal, Jam Masuk, Jam Keluar, Kegiatan (logbook), Keterangan (status presensi)
- Header: Nama, Asal Universitas/Sekolah, Jurusan, Unit Penempatan, Periode Magang, Bulan/Tahun
- Footer: kota + tanggal, kolom tanda tangan Pembimbing dan Peserta Magang
- Template: `resources/views/pdf/daftar-kehadiran.blade.php`

### 7.2 PDF Penilaian

- Input: `intern_id`
- Hanya bisa jika `assessments.status = submitted`
- Isi: identitas intern (termasuk NIM/NIS), 9 indikator dikelompokkan per kategori, nilai rata-rata, predikat, catatan
- Footer: kota + tanggal, tanda tangan Pembimbing
- Template: `resources/views/pdf/penilaian.blade.php`

---

## 8. Keamanan

1. Rata-rata dan predikat dihitung di server, bukan dari frontend.
2. Mentor hanya bisa menilai intern bimbingannya sendiri (Policy).
3. Export PDF hanya untuk role admin. Cek di server untuk mencegah IDOR (ganti `intern_id` di URL).
4. Validasi semua indikator aktif terisi saat submit.
5. Setiap perubahan nilai tercatat di `audit_logs`.
6. Data teks di template Blade di-escape (`{{ }}`, bukan `{!! !!}`).

---

## 9. Langkah Setelah Merge

```bash
cd backend
composer install
php artisan migrate:fresh --seed
```

`migrate:fresh` diperlukan di lokal karena indikator lama perlu diganti.

---

## 10. Dokumen yang Ikut Diupdate

- PRD (fitur penilaian mentor, export PDF)
- `backend_architecture_ERD.md`
- `design-mentor.md` (menu Input Nilai)
- `design-admin.md` (3 jenis export)
- Use case diagram (Input Nilai, Export PDF)
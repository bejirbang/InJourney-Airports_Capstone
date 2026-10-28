# CLAUDE.md (frontend)

Panduan untuk Claude Code saat bekerja di folder `frontend/`. Batasan wajib ada di `AGENTS.md` dan ikut dimuat di bawah, jangan disalin ulang ke sini.

@AGENTS.md

## Proyek

**Web Intern Management dan Attendance System** untuk InJourney Airports (capstone). Tiga role: **Intern, Mentor, Admin**.

Frontend sudah diintegrasikan ke API Laravel (`backend/`) untuk Fase 0-6. Panduan integrasi per fitur, termasuk file yang diubah, dibuat, dan dihapus, ada di **`progress.md`**. Baca file itu sebelum mengerjakan fitur apa pun.

## Stack dan perintah

TanStack Start (React 19, TanStack Router berbasis file), Vite, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, sonner, react-hook-form dengan zod, date-fns, recharts, `@tanstack/react-query`, Leaflet. Real-time: `laravel-echo` + `pusher-js` (dipasang di Fase 5). Test memakai Vitest dan Testing Library.

```bash
cd frontend
npm install        # atau: bun install (ada bun.lock dan package-lock.json)
npm run dev        # server pengembangan
npm run test       # vitest run
npm run lint       # eslint
npm run build      # build produksi
```

Jalankan `npm run test`, `npm run lint`, dan `npm run build` sebelum commit.

Backend lokal harus berjalan untuk menguji integrasi (`cd backend && php artisan dev`). Cara lengkap dan akun contoh ada di `progress.md` bagian 3.

Variabel lingkungan ada di `.env.example`: `VITE_API_URL` dan `VITE_REVERB_*`.

## Struktur kode

- `src/routes/*.tsx`: satu file per halaman. `routeTree.gen.ts` dibuat otomatis, jangan diedit manual. Daftar route per role dan file komponennya ada di `progress.md` bagian 4.3.
- `src/components/internspace/`: dikelompokkan per role (`intern/`, `mentor/`, `admin/`), ditambah `shared/` untuk yang dipakai lebih dari satu role. Kode yang hanya dipakai satu role masuk folder role itu.
  - `shared/shell.tsx`: sidebar, navbar, lonceng, daftar halaman yang boleh dibuka tiap role (`allowed`, `nav`).
  - `shared/role-pages.tsx`: memilih komponen per role untuk route yang sama (`/`, `/absensi`, `/izin`, `/logbook`, `/koreksi`, `/presentasi`, `/penilaian`).
- `src/lib/api.ts`: klien HTTP inti (`request`, `ApiError`, token, `downloadFile`).
- `src/lib/endpoints/`: fungsi endpoint dan tipe respons per role.
- `src/lib/auth.tsx`: sesi login (`useAuth()`), sumber role pengguna.
- `src/lib/navigation.ts`: peta menu `key` dan `link_path` notifikasi ke route frontend.
- `src/lib/labels.ts`: label Indonesia untuk nilai status dari API.
- `src/lib/search.ts`: parameter URL `tab`, `open`, `to` (id pengguna), `date`.
- `src/lib/utils.ts`: helper tanggal/format tampilan, inisial nama, serta validasi form sisi klien. Aturan bisnis tetap ada di server.
- `src/components/ui/`: komponen shadcn. Ubah hanya bila perlu.
- `src/styles.css`: gaya global dan identitas visual InJourney.

## Aturan tampilan

- Teks UI berbahasa Indonesia. Format tanggal "Sen, 12 Okt 2026", waktu 24 jam.
- Tanggal dari API berupa teks `YYYY-MM-DD`. Tampilkan dengan helper tanggal di `src/lib/utils.ts`, **bukan** `new Date("YYYY-MM-DD")` (bisa bergeser satu hari karena dibaca UTC).
- Badge status selalu memakai teks, warna bukan satu-satunya penanda. Warna mengikuti `docs/design-intern.md` §17.1:

| Status | Warna |
|---|---|
| Hadir, Disetujui | Hijau `#2E7D32` |
| Terlambat | Merah gelap `#AD1457` |
| Lupa Clock In | Oranye tua `#E65100` |
| Izin | Biru `#1565C0` |
| Tidak Hadir, Ditolak | Merah `#C62828` |
| Libur, Dibatalkan, Draft | Abu-abu `#757575` |
| Lupa Clock Out, Revisi | Oranye `#EF6C00` |
| Menunggu, Menunggu Review, Menunggu Mentor, Menunggu Admin | Kuning `#F9A825` |
| Dikoreksi | Abu-abu gelap |

- Dialog konfirmasi menjelaskan dampak dalam kalimat biasa, tombol utama di kanan bawah (desktop) atau penuh lebar (ponsel), tombol berkata kerja jelas ("Nonaktifkan", bukan "OK").
- Halaman intern dirancang mobile first. Di ponsel sidebar menjadi menu bawah.
- Link bukti (Google Drive/Docs) dibuka di tab baru.

## Git dan sinkronisasi Lovable

Repo ini tersambung dua arah ke Lovable (branch `main`).

- `git pull` sebelum mengedit. Jika Lovable dan GitHub sama-sama punya commit baru, Lovable mendorong ke branch `lovable-sync`.
- Jangan force push, rebase, atau amend commit yang sudah di-push. Itu menghapus riwayat project di Lovable.
- Jangan memindahkan folder `frontend/` atau menghapus `frontend/package.json`. Ubah struktur repo hanya setelah dikonfirmasi.
- Jangan commit file `.env`.

## Ringkasan keputusan produk (per 27 Oktober 2026)

Rincian lengkap ada di `docs/design-*.md` dan `backend/progress.md`. Ringkasan ini hanya untuk orientasi; jika berbeda, dokumen dan kode backend yang berlaku.

**Lokasi dan jadwal**
- Dua tingkat: **Bandara** (lokasi magang, punya kota, jadwal mingguan per hari, dan jadwal khusus) dan **Titik Presensi** (punya titik peta dan radius clock in/out).
- Intern terhubung ke bandara. Clock in/out boleh di titik aktif mana pun milik bandaranya. Server yang memeriksa radius.
- Hari kerja dan jam kerja mengikuti jadwal bandara dan kalender libur. Tidak ada aturan "Sabtu-Minggu libur untuk semua".
- Bandara, titik presensi, dan unit tidak dihapus, hanya dinonaktifkan.

**Presensi**
- Status: Hadir, Terlambat (lewat jam masuk + toleransi), Lupa Clock In, Izin, Tidak Hadir, Libur. "Lupa Clock Out" dan "Dikoreksi" adalah tanda, bukan status.
- Clock out hanya setelah jam pulang dan wajib mengisi logbook hari itu.

**Logbook** (pengganti Task dan Daily Report)
- Satu logbook per hari presensi, diisi saat clock out. Mentor menyetujui atau meminta revisi (komentar wajib). Mentor bisa menyetujui banyak sekaligus.

**Koreksi presensi**
- Intern mengajukan tanggal + alasan (tanpa jam, tanpa bukti). Mentor ACC atau tolak, lalu admin setujui atau tolak (catatan wajib). Hasil selalu Hadir dengan tanda Dikoreksi; jam diisi otomatis dari jadwal.

**Izin**
- Hanya Izin Sakit dan Izin Urgent. Bukti berupa link Google Drive/Docs. Kuota per masa magang (bawaan 3 kali), 1 pengajuan = 1 kali. Mentor memproses lebih dulu; admin hanya setelah lewat batas jam (bawaan 24 jam) dan wajib mencentang pemeriksaan bukti.

**Akhir magang**
- Intern mengirim link bukti presentasi akhir (terbuka H-7), admin setujui atau minta revisi.
- Mentor mengisi nilai (9 indikator, bilangan bulat 0-100, 3 kategori) setelah presentasi disetujui dan semua logbook disetujui. Nilai akhir dan predikat dihitung server. Setelah submit terkunci permanen. Intern bisa melihat nilainya.

**Lain-lain**
- Akun dibuat admin, login email internal, tanpa Google OAuth. Password sementara ditampilkan sekali. Ganti password hanya saat login pertama dan setelah reset admin.
- Profil: semua role hanya bisa mengubah nomor telepon. Tanpa foto; avatar dari inisial nama.
- Identitas intern: unit, bandara, jenis institusi (universitas/sekolah), asal institusi, jurusan, NIM/NIS, periode magang.
- Warning: catatan admin tanpa level, terlihat oleh intern dan mentornya (hanya baca), mengirim notifikasi.
- Notifikasi lewat lonceng di navbar, real-time. Chat: semua bisa chat dengan semua, admin tidak bisa membaca chat orang lain.
- Laporan admin: Excel (sheet Presensi, Izin, Logbook, Penilaian) dan PDF (Daftar Kehadiran per intern per bulan, Penilaian per intern).
- Sesi berakhir setelah 30 menit tanpa aktivitas.

**Masih terbuka**: penanganan GPS kurang akurat dan VPN. Jangan mengarang nilainya di kode.

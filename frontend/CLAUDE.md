# CLAUDE.md (frontend)

Panduan untuk Claude Code saat bekerja di folder `frontend/`. Aturan prototipe yang sudah ada di `AGENTS.md` ikut dimuat di bawah, jangan disalin ulang ke sini.

@AGENTS.md

## Proyek

Prototipe **Web Intern Management dan Attendance System** untuk InJourney Airports (capstone). Tiga role: **Intern, Mentor, Admin**. Saat ini berupa prototipe interaktif sisi klien dengan data contoh yang hidup selama sesi. Belum ada autentikasi, penyimpanan, unggah file, validasi lokasi, atau PDF yang sungguhan. Itu urusan tim backend (`backend/`, Laravel) dan tidak dikerjakan dari sini kecuali diminta.

## Stack dan perintah

TanStack Start (React 19, TanStack Router berbasis file), Vite, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, sonner, react-hook-form dengan zod, date-fns, recharts. Test memakai Vitest dan Testing Library.

```bash
cd frontend
npm install        # atau: bun install (ada bun.lock dan package-lock.json)
npm run dev        # server pengembangan
npm run test       # vitest run
npm run lint       # eslint
npm run build      # build produksi
```

Jalankan `npm run test` dan `npm run lint` sebelum commit.

## Struktur kode

- `src/routes/*.tsx`: satu file per halaman. Bersama: index (Dashboard), task, izin, chat, profil. Intern: absensi. Mentor: intern-saya, kalender-izin, performa. Admin: absensi, users, koreksi, warning, pengumuman, laporan, pengaturan, lokasi-kantor, log. Akun: login, ganti-password. Halaman yang tidak sesuai role menampilkan "Anda tidak memiliki akses" (daftar izin ada di `components/internspace/shared/shell.tsx`). Parameter URL `tab`, `open`, `to` (`src/lib/search.ts`) dipakai untuk tautan langsung dari bell icon. `routeTree.gen.ts` dibuat otomatis, jangan diedit manual.
- `src/components/internspace/`: dikelompokkan per role. `intern/`, `mentor/`, `admin/` berisi menu masing-masing role. `shared/` berisi yang dipakai lebih dari satu role: `model.tsx` (MockProvider, satu sumber data contoh, "hari ini" = Sen, 12 Okt 2026), `shell.tsx` (sidebar, navbar, tombol Simulasi), `ui.tsx` (badge status, tab, dialog konfirmasi, input file), `role-pages.tsx` (memilih halaman per role untuk `/`, `/absensi`, `/izin`), `tasks.tsx` (Kanban Intern dan Mentor), `leave-review.tsx` (proses izin Mentor dan Admin), chat, profil, login. Pemetaan lengkap menu ke file ada di `src/components/internspace/README.md`. Kode yang hanya dipakai satu role masuk folder role itu.
- `src/lib/mock-rules.ts`: aturan PRD yang aman dipakai di browser. Test: `mock-rules.test.ts`, `admin-rules.test.ts`, `role-rules.test.ts`. `src/test/pages.test.tsx` merender semua halaman per role dan menguji alur utama.
- `src/components/ui/`: komponen shadcn. Ubah hanya bila perlu.
- `src/styles.css`: gaya global dan identitas visual InJourney.

## Aturan kerja

- Aturan PRD (siapa boleh apa, kapan tombol aktif, status otomatis) ditulis sebagai fungsi di `mock-rules.ts` beserta test, bukan di dalam komponen.
- Teks UI berbahasa Indonesia. Format tanggal "Sen, 12 Okt 2026", waktu 24 jam.
- Badge status selalu memakai teks, warna bukan satu-satunya penanda. Hadir hijau `#2E7D32`, Izin biru `#1565C0`, Tidak Hadir merah `#C62828`, Lupa Clock Out oranye `#EF6C00`, Libur abu-abu `#757575`, Pending kuning `#F9A825`, Disetujui hijau, Ditolak merah, Dibatalkan abu-abu.
- Dialog konfirmasi menjelaskan dampak dalam kalimat biasa, tombol utama di kanan bawah, tombol berkata kerja jelas ("Nonaktifkan", bukan "OK"). Sediakan kondisi memuat, kosong, dan gagal.
- Jangan menyentuh `backend/` dari pekerjaan frontend kecuali diminta.

## Git dan sinkronisasi Lovable

Repo ini tersambung dua arah ke Lovable (branch `main`).
- `git pull` sebelum mengedit. Jika Lovable dan GitHub sama-sama punya commit baru, Lovable mendorong ke branch `lovable-sync`.
- Jangan force push, rebase, atau amend commit yang sudah di-push. Itu menghapus riwayat project di Lovable.
- Jangan memindahkan folder `frontend/` atau menghapus `frontend/package.json`. Preview Lovable diduga bermasalah sejak refactor ke subfolder (belum terbukti). Ubah struktur repo hanya setelah dikonfirmasi.

## Ringkasan keputusan produk (per 10 Oktober 2026)

Dokumen desain lengkap per role ada di `docs/design-intern.md`, `docs/design-mentor.md`, dan `docs/design-admin.md` (path dari root repo; salin ke sana bila belum ada). Bila dokumen bertentangan dengan kode, dokumen menjadi acuan. Tanyakan bila ragu.

**Kehadiran**
- Sabtu dan Minggu libur. Admin mengatur hari libur lain dan jam kerja global (dengan tanggal efektif).
- Status ditentukan otomatis dengan batas 23:59: Hadir, Izin, Tidak Hadir (tanpa clock in), Lupa Clock Out (clock in tanpa clock out). Hari berjalan tampil "Belum Clock In", belum Tidak Hadir.
- Lokasi divalidasi saat clock in (radius clock in) dan clock out (radius clock out) terhadap kantor aktif yang dibuat admin di menu Lokasi Kantor. Tanpa kantor aktif, intern tidak bisa clock in.
- Selain lokasi, clock out hanya mensyaratkan Daily Report terkirim. Daily Report dapat diedit sampai clock out. Task dan Daily Report adalah dua hal berbeda.

**Task**
- Dibuat mentor untuk satu intern (tidak ada assign massal). Status: To Do, In Progress, In Review, Done. Task lewat tenggat diberi tanda Terlambat tetapi tetap bisa dikumpulkan.
- Pengumpulan lewat link dan atau file. Pengumpulan ulang menimpa hasil lama, tanpa riwayat versi. Mentor Accept (Done) atau Revise (kembali ke In Progress, komentar wajib). Komentar berupa thread dua arah.
- Kanban mendukung drag and drop. Intern: To Do ke In Progress boleh, In Progress ke To Do hanya jika belum pernah dikumpulkan, In Progress ke In Review membuka dialog Kumpulkan Hasil, kartu In Review dan Done terkunci. Mentor: hanya kartu In Review yang bisa diseret, ke Done (Accept) atau ke In Progress (Revise dengan komentar wajib). Perpindahan lain ditolak dan kartu kembali.

**Izin dan koreksi**
- Hanya Izin Sakit dan Izin Urgent, tidak ada cuti. Lampiran bukti opsional. Intern boleh membatalkan saat Pending. Mentor memproses lebih dulu. Admin hanya memproses yang masih Pending, dan hanya jika ada surat resmi atau bukti. Izin yang disetujui otomatis mengubah status absensi.
- Koreksi absensi diajukan intern ke admin, yang memverifikasi lebih dulu. Admin hanya mengubah jam, status dihitung ulang. Catatan keputusan wajib. Keputusan yang sudah diproses tidak bisa dibuka ulang.

**Lain-lain**
- Login memakai email internal yang dibuat admin, tanpa Google OAuth. Tidak ada ganti password mandiri (hanya saat login pertama dan reset oleh admin).
- Notifikasi hanya lewat bell icon di navbar, tanpa halaman notifikasi. Chat: semua bisa chat dengan semua, admin tidak bisa membaca chat orang lain.
- Warning: catatan sederhana tanpa level, hanya terlihat admin. Pengumuman: admin memilih role penerima. Laporan: hanya admin, hanya PDF.
- Mentor punya menu Performa Intern (rekap kehadiran dan KPI, bukan nilai). Tidak ada fitur penilaian intern. Admin tidak punya dashboard performa seluruh intern.

**Sudah diputuskan (Draft 2)**: batas ukuran file 2 MB untuk hasil Task, lampiran izin, dan bukti koreksi. Validasi lokasi memakai radius kantor aktif.

**Masih terbuka**: jenis file yang diizinkan, intern terikat satu kantor atau boleh kantor aktif mana pun (usulan: mana pun), batas radius (usulan 10-1000 m), penanganan GPS kurang akurat dan VPN. Jangan mengarang nilainya di kode. Tandai sebagai pengaturan yang nanti diisi tim backend.

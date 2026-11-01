<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Status proyek

Aplikasi ini sudah diintegrasikan ke API Laravel di `backend/` untuk Fase 0-6. Panduan kerja dan log verifikasi ada di `progress.md` (folder ini).

## Menjalankan dan menyambungkan ke backend

Rincian lengkap dan tabel pemecahan masalah ada di `progress.md` bagian 16.

1. **Backend** (terminal 1). PostgreSQL harus sudah hidup.

   ```bash
   cd backend
   composer install
   cp .env.example .env && php artisan key:generate
   # isi DB_* dan REVERB_APP_ID / REVERB_APP_KEY / REVERB_APP_SECRET (nilai acak bebas)
   php artisan migrate:fresh --seed
   php artisan dev        # API :8000, Reverb :8080, queue worker
   ```

2. **Frontend** (terminal 2).

   ```bash
   cd frontend
   npm install
   cp .env.example .env   # VITE_REVERB_APP_KEY = REVERB_APP_KEY di backend/.env
   npm run dev -- --port 5173
   ```

3. Buka `http://localhost:5173`, masuk dengan `intern@injourney.test`, `mentor@injourney.test`, atau `admin@injourney.test` (password `password`).

Yang sering membuat integrasi terlihat rusak:

- **`VITE_REVERB_APP_KEY` kosong atau beda dengan backend**: real-time mati tanpa error (chat perlu refresh, lonceng diam, status online tidak tampil).
- **Port tidak ditentukan**: konfigurasi Lovable memakai 8080, sama dengan Reverb. Selalu jalankan `npm run dev -- --port 5173`.
- **Queue worker mati** (misalnya hanya `php artisan serve`): event chat dan notifikasi tidak terkirim.
- `.env` hanya dibaca saat Vite start; restart setelah mengubahnya.

## Batasan wajib

1. **Sumber kebenaran**, urut dari yang paling kuat:
   1. Kode backend: `backend/routes/api.php`, `backend/app/Http/Requests/`, `backend/app/Http/Resources/`, `backend/app/Services/`.
   2. `backend/progress.md` bagian "Catatan integrasi frontend setelah rombak" dan "Catatan integrasi frontend (26 Okt 2026)".
   3. `docs/design-intern.md`, `docs/design-mentor.md`, `docs/design-admin.md` (tampilan dan teks UI).
   4. `progress.md` (urutan kerja dan pembagian file frontend).
   5. Kode prototipe yang sudah ada. **Bukan acuan aturan.**
2. **Jangan mengubah folder `backend/`.** Kebutuhan perubahan backend dicatat di `progress.md` bagian 13.
3. **Aturan bisnis ada di server.** Jangan menghitung ulang status presensi, nilai akhir, predikat, kuota izin, atau hak akses di frontend. Tampilkan nilai dari respons API.
4. **Tombol mengikuti flag dari server** (`can_*`, `action`, `state`). Jangan menulis aturan sendiri untuk menyalakan atau mematikan tombol.
5. **Pesan `message` dari server ditampilkan apa adanya.**
6. **Fitur yang sudah dihapus dan tidak boleh dibuat lagi:** Task/Kanban, Daily Report, upload file (bukti, foto profil), pengaturan jam kerja global, hapus bandara/titik presensi/unit.
7. **Jangan menambah fitur baru di atas data contoh.** `MockProvider` dan `mock-rules.ts` sudah dihapus pada Fase 6; semua halaman memakai API dan React Query.
8. **Jangan polling API** di latar belakang. Pembaruan real-time lewat WebSocket (Laravel Reverb).
9. **Jangan mengarang nama endpoint atau field.** Jika tidak ada di `progress.md` atau kode backend, cek respons nyata atau tanyakan.
10. **Jangan menyimpan token atau password sementara** selain token sesi di `localStorage` lewat `src/lib/api.ts`. Password sementara dari admin hanya ditampilkan sekali.

## Pola kode

- Klien HTTP inti di `src/lib/api.ts`. Fungsi endpoint per role di `src/lib/endpoints/`.
- Pengambilan data memakai React Query, satu file hook `*-data.ts` per fitur di folder role (contoh: `src/components/internspace/intern/leaves-data.ts`).
- Satu route per halaman di `src/routes/`. Route yang dipakai beberapa role memilih komponennya di `src/components/internspace/shared/role-pages.tsx`.
- Setiap halaman wajib punya kondisi memuat, kosong, dan gagal.

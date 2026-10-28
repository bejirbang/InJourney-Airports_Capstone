# Frontend: InternSpace (InJourney Airports)

Aplikasi web **Intern Management dan Attendance System** untuk tiga role: Intern, Mentor, Admin. Dibangun dengan TanStack Start dan tersambung ke API Laravel di folder `backend/`.

Proyek ini juga tersambung ke [Lovable](https://lovable.dev/projects/3735cd30-9f65-4963-a0a3-0b95d51251af). Commit ke `main` tersinkron ke editor Lovable dan sebaliknya.

**Preview Lovable**: https://injourney-canvas.lovable.app

## Status

Integrasi API Fase 0-6 selesai; data contoh dan `MockProvider` sudah dihapus. Uji live dua browser dan Reverb menunggu PostgreSQL/Reverb lokal. Lihat:

| Dokumen | Isi |
|---|---|
| [`progress.md`](progress.md) | Panduan integrasi per fitur dan log progres |
| [`roadmap.md`](roadmap.md) | Ringkasan tahap pengerjaan |
| [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md) | Batasan dan panduan untuk asisten AI |
| [`src/components/internspace/README.md`](src/components/internspace/README.md) | Pemetaan menu per role ke file komponen |
| `../docs/design-*.md` | Desain tampilan dan alur per role |

## Menjalankan secara lokal

Butuh Node.js dan npm. Backend harus berjalan lebih dulu (lihat `progress.md` bagian 3).

```sh
cd frontend
cp .env.example .env   # isi VITE_REVERB_APP_KEY sama dengan backend/.env
npm install
npm run dev
```

Perintah lain:

```sh
npm run test    # vitest
npm run lint    # eslint
npm run build   # build produksi
```

## Aturan git

- `git pull` sebelum mengedit.
- Jangan force push, rebase, atau amend commit yang sudah di-push (merusak riwayat Lovable).
- Jangan commit file `.env`.

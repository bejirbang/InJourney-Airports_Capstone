# Roadmap Frontend

## Tahap 1: Prototipe (selesai)

- [x] Build InJourney Airports-inspired design and Intern dashboard.
- [x] Add interactive attendance, reports, tasks, leave, chat, and role-specific views using sample data.
- [x] Verify PRD rules and key navigation and form flows.
- [x] Add mock login and first-login change-password pages (no self-service reset, per docs).
- [x] Align menus, pages, and flows per role with docs/design-intern.md, design-mentor.md, design-admin.md.
- [x] Admin Laporan: export changed from PDF to Excel (.xlsx) only; Rekap Izin removed (12 Oct 2026).

Catatan: sebagian isi prototipe (Task, Daily Report, upload file, jam kerja global) sudah tidak berlaku sejak rombak backend 24-25 Okt 2026.

## Tahap 2: Integrasi API (berjalan)

Panduan lengkap dan log progres per fitur ada di [`progress.md`](progress.md).

- [x] Fase 0: Fondasi (aturan agent, klien API, peta route, label, unduhan file)
- [x] Fase 1: Autentikasi, shell, profil
- [ ] Fase 2: Intern (dashboard, presensi, logbook, koreksi, izin, presentasi, catatan)
- [ ] Fase 3: Mentor (dashboard, intern saya, review logbook, koreksi, izin, kalender, performa, input nilai)
- [ ] Fase 4: Admin (dashboard, pengguna, presensi, koreksi, izin, presentasi, penilaian, warning, pengumuman, laporan, pengaturan, lokasi & jadwal, log)
- [ ] Fase 5: Lonceng, chat, real-time
- [ ] Fase 6: Hapus Task, data contoh, dan tombol Simulasi
- [ ] Pemeriksaan visual setiap halaman di browser (desktop dan lebar ponsel)

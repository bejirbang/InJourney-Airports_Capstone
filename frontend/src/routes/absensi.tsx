import { createFileRoute } from '@tanstack/react-router';
import { AttendancePage } from '@/components/internspace/attendance';
export const Route = createFileRoute('/absensi')({
 head: () => ({ meta: [
  { title: 'Absensi | InternSpace InJourney Airports' },
  { name: 'description', content: 'Riwayat kehadiran dan laporan harian peserta magang.' },
  { property: 'og:title', content: 'Absensi | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Riwayat kehadiran dan laporan harian peserta magang.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: AttendancePage,
});

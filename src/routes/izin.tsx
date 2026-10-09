import { createFileRoute } from '@tanstack/react-router';
import { LeavePage } from '@/components/internspace/leave';
export const Route = createFileRoute('/izin')({
 head: () => ({ meta: [
  { title: 'Pengajuan Izin | InternSpace InJourney Airports' },
  { name: 'description', content: 'Pengelolaan izin sakit dan urgent peserta magang.' },
  { property: 'og:title', content: 'Pengajuan Izin | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Pengelolaan izin sakit dan urgent peserta magang.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: LeavePage,
});

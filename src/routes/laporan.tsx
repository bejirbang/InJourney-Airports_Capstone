import { createFileRoute } from '@tanstack/react-router';
import { ReportsPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/laporan')({
 head: () => ({ meta: [
  { title: 'Export Laporan | InternSpace InJourney Airports' },
  { name: 'description', content: 'Persiapan laporan absensi, izin, dan task.' },
  { property: 'og:title', content: 'Export Laporan | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Persiapan laporan absensi, izin, dan task.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: ReportsPage,
});

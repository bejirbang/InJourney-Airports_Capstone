import { createFileRoute } from '@tanstack/react-router';
import { PerformancePage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/performa')({
 head: () => ({ meta: [
  { title: 'Performa Intern | InternSpace InJourney Airports' },
  { name: 'description', content: 'Rekap aktivitas intern bimbingan mentor.' },
  { property: 'og:title', content: 'Performa Intern | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Rekap aktivitas intern bimbingan mentor.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: PerformancePage,
});

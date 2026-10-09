import { createFileRoute } from '@tanstack/react-router';
import { LogsPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/log')({
 head: () => ({ meta: [
  { title: 'Log Aktivitas | InternSpace InJourney Airports' },
  { name: 'description', content: 'Riwayat perubahan administrasi magang.' },
  { property: 'og:title', content: 'Log Aktivitas | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Riwayat perubahan administrasi magang.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: LogsPage,
});

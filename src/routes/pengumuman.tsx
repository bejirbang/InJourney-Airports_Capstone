import { createFileRoute } from '@tanstack/react-router';
import { AnnouncementsPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/pengumuman')({
 head: () => ({ meta: [
  { title: 'Pengumuman | InternSpace InJourney Airports' },
  { name: 'description', content: 'Informasi terbaru dari Human Capital.' },
  { property: 'og:title', content: 'Pengumuman | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Informasi terbaru dari Human Capital.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: AnnouncementsPage,
});

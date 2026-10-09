import { createFileRoute } from '@tanstack/react-router';
import { WarningsPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/warning')({
 head: () => ({ meta: [
  { title: 'Catatan Warning | InternSpace InJourney Airports' },
  { name: 'description', content: 'Catatan peringatan intern untuk admin.' },
  { property: 'og:title', content: 'Catatan Warning | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Catatan peringatan intern untuk admin.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: WarningsPage,
});

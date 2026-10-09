import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/users')({
 head: () => ({ meta: [
  { title: 'Manajemen User | InternSpace InJourney Airports' },
  { name: 'description', content: 'Pengelolaan akun dan mentor peserta magang.' },
  { property: 'og:title', content: 'Manajemen User | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Pengelolaan akun dan mentor peserta magang.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: UsersPage,
});

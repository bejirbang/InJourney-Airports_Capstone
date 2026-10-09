import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/profil')({
 head: () => ({ meta: [
  { title: 'Profil Saya | InternSpace InJourney Airports' },
  { name: 'description', content: 'Informasi profil dan periode magang.' },
  { property: 'og:title', content: 'Profil Saya | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Informasi profil dan periode magang.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: ProfilePage,
});

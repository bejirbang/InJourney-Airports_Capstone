import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/pengaturan')({
 head: () => ({ meta: [
  { title: 'Pengaturan Sistem | InternSpace InJourney Airports' },
  { name: 'description', content: 'Pengaturan jam kerja dan kalender kerja magang.' },
  { property: 'og:title', content: 'Pengaturan Sistem | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Pengaturan jam kerja dan kalender kerja magang.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: SettingsPage,
});

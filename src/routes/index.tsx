import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from '@/components/internspace/dashboard';
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'Dashboard | InternSpace InJourney Airports' },
    { name: 'description', content: 'Ringkasan kehadiran, task, dan pengumuman peserta magang InJourney Airports.' },
    { property: 'og:title', content: 'Dashboard | InternSpace InJourney Airports' },
    { property: 'og:description', content: 'Ringkasan kehadiran, task, dan pengumuman peserta magang InJourney Airports.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Dashboard,
});

import { createFileRoute } from '@tanstack/react-router';
import { ChatPage } from '@/components/internspace/other-pages';
export const Route = createFileRoute('/chat')({
 head: () => ({ meta: [
  { title: 'Chat | InternSpace InJourney Airports' },
  { name: 'description', content: 'Percakapan peserta magang, mentor, dan admin.' },
  { property: 'og:title', content: 'Chat | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Percakapan peserta magang, mentor, dan admin.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: ChatPage,
});

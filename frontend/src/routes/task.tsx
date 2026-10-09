import { createFileRoute } from '@tanstack/react-router';
import { TasksPage } from '@/components/internspace/tasks';
export const Route = createFileRoute('/task')({
 head: () => ({ meta: [
  { title: 'Task | InternSpace InJourney Airports' },
  { name: 'description', content: 'Kanban pekerjaan dan diskusi peserta magang dengan mentor.' },
  { property: 'og:title', content: 'Task | InternSpace InJourney Airports' },
  { property: 'og:description', content: 'Kanban pekerjaan dan diskusi peserta magang dengan mentor.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
 component: TasksPage,
});

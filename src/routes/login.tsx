import { createFileRoute } from '@tanstack/react-router';
import { LoginPage } from '@/components/internspace/account-pages';
export const Route = createFileRoute('/login')({
  head: () => ({ meta: [
    { title: 'Login | InternSpace InJourney Airports' },
    { name: 'description', content: 'Halaman masuk contoh ke workspace magang InJourney Airports.' },
    { property: 'og:title', content: 'Login | InternSpace InJourney Airports' },
    { property: 'og:description', content: 'Halaman masuk contoh ke workspace magang InJourney Airports.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: LoginPage,
});
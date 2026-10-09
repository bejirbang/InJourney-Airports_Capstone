import { createFileRoute } from '@tanstack/react-router';
import { ForgotPasswordPage } from '@/components/internspace/account-pages';
export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [
    { title: 'Lupa Password | InternSpace InJourney Airports' },
    { name: 'description', content: 'Permintaan reset password contoh untuk peserta magang InJourney Airports.' },
    { property: 'og:title', content: 'Lupa Password | InternSpace InJourney Airports' },
    { property: 'og:description', content: 'Permintaan reset password contoh untuk peserta magang InJourney Airports.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ForgotPasswordPage,
});
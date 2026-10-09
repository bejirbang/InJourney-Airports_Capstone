import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '@/components/internspace/account-pages';
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [
    { title: 'Reset Password | InternSpace InJourney Airports' },
    { name: 'description', content: 'Form password baru dalam alur reset contoh InternSpace InJourney Airports.' },
    { property: 'og:title', content: 'Reset Password | InternSpace InJourney Airports' },
    { property: 'og:description', content: 'Form password baru dalam alur reset contoh InternSpace InJourney Airports.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ResetPasswordPage,
});
import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordPage } from "@/components/internspace/account-pages";

export const Route = createFileRoute("/ganti-password")({
  head: () => ({
    meta: [
      { title: "Ganti Password | InternSpace InJourney Airports" },
      { name: "description", content: "Ganti password saat login pertama." },
      { property: "og:title", content: "Ganti Password | InternSpace InJourney Airports" },
      { property: "og:description", content: "Ganti password saat login pertama." },
    ],
  }),
  component: ChangePasswordPage,
});

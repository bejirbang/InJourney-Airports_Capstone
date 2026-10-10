import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/internspace/other-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/profil")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Profil | InternSpace InJourney Airports" },
      { name: "description", content: "Profil pengguna." },
      { property: "og:title", content: "Profil | InternSpace InJourney Airports" },
      { property: "og:description", content: "Profil pengguna." },
    ],
  }),
  component: ProfilePage,
});

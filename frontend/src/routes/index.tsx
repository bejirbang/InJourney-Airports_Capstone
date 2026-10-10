import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Dashboard | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Ringkasan hari ini dan hal yang perlu ditindak sesuai role.",
      },
      { property: "og:title", content: "Dashboard | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Ringkasan hari ini dan hal yang perlu ditindak sesuai role.",
      },
    ],
  }),
  component: Dashboard,
});

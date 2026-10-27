import { createFileRoute } from "@tanstack/react-router";
import { LogbookPage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/logbook")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Logbook | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Riwayat logbook harian intern dan review mentor.",
      },
      { property: "og:title", content: "Logbook | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Riwayat logbook harian intern dan review mentor.",
      },
    ],
  }),
  component: LogbookPage,
});

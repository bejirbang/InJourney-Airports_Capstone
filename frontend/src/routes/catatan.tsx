import { createFileRoute } from "@tanstack/react-router";
import { NotesPage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/catatan")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Catatan | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Catatan warning dan nilai akhir untuk intern.",
      },
      { property: "og:title", content: "Catatan | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Catatan warning dan nilai akhir untuk intern.",
      },
    ],
  }),
  component: NotesPage,
});

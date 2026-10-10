import { createFileRoute } from "@tanstack/react-router";
import { WarningsPage } from "@/components/internspace/admin-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/warning")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Warning | InternSpace InJourney Airports" },
      { name: "description", content: "Catatan warning intern, hanya untuk admin." },
      { property: "og:title", content: "Warning | InternSpace InJourney Airports" },
      { property: "og:description", content: "Catatan warning intern, hanya untuk admin." },
    ],
  }),
  component: WarningsPage,
});

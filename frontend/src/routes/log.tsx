import { createFileRoute } from "@tanstack/react-router";
import { LogsPage } from "@/components/internspace/admin-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/log")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Log Aktivitas | InternSpace InJourney Airports" },
      { name: "description", content: "Jejak tindakan admin." },
      { property: "og:title", content: "Log Aktivitas | InternSpace InJourney Airports" },
      { property: "og:description", content: "Jejak tindakan admin." },
    ],
  }),
  component: LogsPage,
});

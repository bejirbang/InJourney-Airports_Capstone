import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/internspace/admin/reports";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/laporan")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Laporan | InternSpace InJourney Airports" },
      { name: "description", content: "Export laporan PDF." },
      { property: "og:title", content: "Laporan | InternSpace InJourney Airports" },
      { property: "og:description", content: "Export laporan PDF." },
    ],
  }),
  component: ReportsPage,
});

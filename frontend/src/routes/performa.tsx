import { createFileRoute } from "@tanstack/react-router";
import { PerformancePage } from "@/components/internspace/mentor-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/performa")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Performa Intern | InternSpace InJourney Airports" },
      { name: "description", content: "Rekap kehadiran dan KPI intern bimbingan." },
      { property: "og:title", content: "Performa Intern | InternSpace InJourney Airports" },
      { property: "og:description", content: "Rekap kehadiran dan KPI intern bimbingan." },
    ],
  }),
  component: PerformancePage,
});

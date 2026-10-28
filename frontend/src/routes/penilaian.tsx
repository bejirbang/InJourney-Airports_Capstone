import { createFileRoute } from "@tanstack/react-router";
import { AssessmentPage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/penilaian")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Penilaian | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Penilaian intern oleh mentor dan rekap admin.",
      },
      { property: "og:title", content: "Penilaian | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Penilaian intern oleh mentor dan rekap admin.",
      },
    ],
  }),
  component: AssessmentPage,
});

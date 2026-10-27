import { createFileRoute } from "@tanstack/react-router";
import { CorrectionsPage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/koreksi")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Koreksi Presensi | InternSpace InJourney Airports" },
      { name: "description", content: "Permintaan koreksi presensi dari intern." },
      { property: "og:title", content: "Koreksi Presensi | InternSpace InJourney Airports" },
      { property: "og:description", content: "Permintaan koreksi presensi dari intern." },
    ],
  }),
  component: CorrectionsPage,
});

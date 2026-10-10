import { createFileRoute } from "@tanstack/react-router";
import { CorrectionsPage } from "@/components/internspace/admin/corrections";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/koreksi")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Koreksi Absensi | InternSpace InJourney Airports" },
      { name: "description", content: "Permintaan koreksi absensi dari intern." },
      { property: "og:title", content: "Koreksi Absensi | InternSpace InJourney Airports" },
      { property: "og:description", content: "Permintaan koreksi absensi dari intern." },
    ],
  }),
  component: CorrectionsPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { PresentationPage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/presentasi")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Presentasi Akhir | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Pengajuan dan verifikasi presentasi akhir magang.",
      },
      { property: "og:title", content: "Presentasi Akhir | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Pengajuan dan verifikasi presentasi akhir magang.",
      },
    ],
  }),
  component: PresentationPage,
});

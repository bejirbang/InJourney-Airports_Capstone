import { createFileRoute } from "@tanstack/react-router";
import { LeavePage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/izin")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Izin | InternSpace InJourney Airports" },
      { name: "description", content: "Pengajuan dan pemrosesan Izin Sakit dan Izin Urgent." },
      { property: "og:title", content: "Izin | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Pengajuan dan pemrosesan Izin Sakit dan Izin Urgent.",
      },
    ],
  }),
  component: LeavePage,
});

import { createFileRoute } from "@tanstack/react-router";
import { OfficesPage } from "@/components/internspace/admin/offices";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/lokasi-kantor")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Lokasi Kantor | InternSpace InJourney Airports" },
      { name: "description", content: "Lokasi kantor dan radius clock in serta clock out." },
      { property: "og:title", content: "Lokasi Kantor | InternSpace InJourney Airports" },
      { property: "og:description", content: "Lokasi kantor dan radius clock in serta clock out." },
    ],
  }),
  component: OfficesPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { AttendancePage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/absensi")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Presensi | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Clock in, logbook, clock out, riwayat, dan koreksi presensi.",
      },
      { property: "og:title", content: "Presensi | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Clock in, logbook, clock out, riwayat, dan koreksi presensi.",
      },
    ],
  }),
  component: AttendancePage,
});

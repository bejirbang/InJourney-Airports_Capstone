import { createFileRoute } from "@tanstack/react-router";
import { AttendancePage } from "@/components/internspace/shared/role-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/absensi")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Absensi | InternSpace InJourney Airports" },
      {
        name: "description",
        content: "Clock in, Daily Report, clock out, riwayat, dan koreksi absensi.",
      },
      { property: "og:title", content: "Absensi | InternSpace InJourney Airports" },
      {
        property: "og:description",
        content: "Clock in, Daily Report, clock out, riwayat, dan koreksi absensi.",
      },
    ],
  }),
  component: AttendancePage,
});

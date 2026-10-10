import { createFileRoute } from "@tanstack/react-router";
import { LeaveCalendarPage } from "@/components/internspace/leave";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/kalender-izin")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Kalender Izin | InternSpace InJourney Airports" },
      { name: "description", content: "Kalender izin intern bimbingan." },
      { property: "og:title", content: "Kalender Izin | InternSpace InJourney Airports" },
      { property: "og:description", content: "Kalender izin intern bimbingan." },
    ],
  }),
  component: LeaveCalendarPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { AnnouncementsPage } from "@/components/internspace/admin/announcements";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/pengumuman")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Pengumuman | InternSpace InJourney Airports" },
      { name: "description", content: "Pengumuman per role." },
      { property: "og:title", content: "Pengumuman | InternSpace InJourney Airports" },
      { property: "og:description", content: "Pengumuman per role." },
    ],
  }),
  component: AnnouncementsPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/internspace/admin/settings";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/pengaturan")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Pengaturan | InternSpace InJourney Airports" },
      { name: "description", content: "Jam kerja dan kalender libur." },
      { property: "og:title", content: "Pengaturan | InternSpace InJourney Airports" },
      { property: "og:description", content: "Jam kerja dan kalender libur." },
    ],
  }),
  component: SettingsPage,
});

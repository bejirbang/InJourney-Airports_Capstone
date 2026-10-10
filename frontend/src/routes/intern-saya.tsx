import { createFileRoute } from "@tanstack/react-router";
import { MyInternsPage } from "@/components/internspace/mentor/interns";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/intern-saya")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Intern Saya | InternSpace InJourney Airports" },
      { name: "description", content: "Intern bimbingan, absensi, dan Daily Report." },
      { property: "og:title", content: "Intern Saya | InternSpace InJourney Airports" },
      { property: "og:description", content: "Intern bimbingan, absensi, dan Daily Report." },
    ],
  }),
  component: MyInternsPage,
});

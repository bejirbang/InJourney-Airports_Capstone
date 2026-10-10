import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/components/internspace/admin/users";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/users")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Pengguna | InternSpace InJourney Airports" },
      { name: "description", content: "Kelola akun intern, mentor, dan admin." },
      { property: "og:title", content: "Pengguna | InternSpace InJourney Airports" },
      { property: "og:description", content: "Kelola akun intern, mentor, dan admin." },
    ],
  }),
  component: UsersPage,
});

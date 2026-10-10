import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/internspace/account-pages";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk | InternSpace InJourney Airports" },
      { name: "description", content: "Masuk dengan email internal dari admin." },
      { property: "og:title", content: "Masuk | InternSpace InJourney Airports" },
      { property: "og:description", content: "Masuk dengan email internal dari admin." },
    ],
  }),
  component: LoginPage,
});

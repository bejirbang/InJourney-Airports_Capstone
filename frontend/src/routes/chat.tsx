import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/components/internspace/other-pages";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/chat")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Chat | InternSpace InJourney Airports" },
      { name: "description", content: "Chat antarpengguna." },
      { property: "og:title", content: "Chat | InternSpace InJourney Airports" },
      { property: "og:description", content: "Chat antarpengguna." },
    ],
  }),
  component: ChatPage,
});

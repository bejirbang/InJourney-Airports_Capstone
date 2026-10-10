import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/components/internspace/shared/tasks";
import { pageSearch } from "@/lib/search";

export const Route = createFileRoute("/task")({
  validateSearch: pageSearch,
  head: () => ({
    meta: [
      { title: "Task | InternSpace InJourney Airports" },
      { name: "description", content: "Kanban dan daftar Task dari mentor." },
      { property: "og:title", content: "Task | InternSpace InJourney Airports" },
      { property: "og:description", content: "Kanban dan daftar Task dari mentor." },
    ],
  }),
  component: TasksPage,
});

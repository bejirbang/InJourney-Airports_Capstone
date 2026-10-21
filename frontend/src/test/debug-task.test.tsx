import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import type { Role } from "@/lib/mock-rules";

const router = vi.hoisted(() => ({ search: {} as Record<string, string>, pathname: "/" }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: unknown }) => <a>{children}</a>,
  useSearch: () => router.search,
  useNavigate: () => () => Promise.resolve(),
  useLocation: () => ({ pathname: router.pathname }),
}));

const { MockProvider } = await import("@/components/internspace/shared/model");
const { AuthProvider } = await import("@/lib/auth");
const { Workspace } = await import("@/components/internspace/shared/shell");
const { TasksPage } = await import("@/components/internspace/shared/tasks");

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const TASK = {
  id: 24,
  code: "TSK-024",
  title: "Redesign halaman informasi penerbangan",
  mentor: { id: 2, name: "Dewi Lestari" },
  status: "in_progress",
  due_at: "2026-10-15T23:59:00+07:00",
  is_late: false,
  late_label: null,
  done_at: null,
  unread_comments: 0,
  ever_submitted: false,
  revise_pending: false,
  action: "submit",
  description: "Susun ulang layout.",
  can_comment: true,
  comments: [],
};

beforeEach(() => {
  localStorage.setItem("internspace_token", "token-uji");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me"))
        return jsonResponse({
          data: {
            id: 1,
            name: "Budi Santoso",
            email: "intern@injourney.test",
            role: "intern",
            title: null,
            phone: null,
            photo_url: null,
            is_active: true,
            must_change_password: false,
            intern_profile: null,
          },
        });
      if (url.split("?")[0]?.endsWith("/api/intern/tasks"))
        return jsonResponse({ data: [TASK], meta: { hidden_done: 0 } });
      if (/\/api\/intern\/tasks\/\d+$/.test(url.split("?")[0] ?? ""))
        return jsonResponse({ data: TASK });
      return jsonResponse({ message: `Belum ditangani: ${url}` }, 404);
    }),
  );
});

const show = (role: Role) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } },
        })
      }
    >
      <AuthProvider>
        <MockProvider initialRole={role}>
          <Workspace>
            <TasksPage />
          </Workspace>
        </MockProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );

it("debug submit dialog", async () => {
  show("Intern");
  const card = await screen.findByRole("button", { name: "Buka Redesign halaman informasi penerbangan" });
  fireEvent.dragStart(card, { dataTransfer: { setData: () => undefined } });
  fireEvent.drop(screen.getByLabelText("Kolom In Review"), {
    dataTransfer: { getData: () => "24" },
  });
  await screen.findByText("Kumpulkan Hasil - Redesign halaman informasi penerbangan");
  console.log("DIALOG OPEN OK");
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  console.log(
    "AFTER LINK CLICK, dialog present:",
    !!screen.queryByText("Kumpulkan Hasil - Redesign halaman informasi penerbangan"),
  );
  fireEvent.change(screen.getByLabelText("Link hasil"), { target: { value: "drive.com/x" } });
  console.log(
    "AFTER CHANGE, dialog present:",
    !!screen.queryByText("Kumpulkan Hasil - Redesign halaman informasi penerbangan"),
    "input value:",
    (screen.getByLabelText("Link hasil") as HTMLInputElement).value,
  );
  document.addEventListener("submit", () => console.log("SUBMIT EVENT FIRED"), true);
  const kumpulkan = screen.getByRole("button", { name: "Kumpulkan" }) as HTMLButtonElement;
  console.log("kumpulkan type:", kumpulkan.getAttribute("type"), "disabled:", kumpulkan.disabled);
  console.log("inside form:", kumpulkan.form?.className ?? "NO FORM", "forms:", document.forms.length);
  kumpulkan.addEventListener("click", () => console.log("CLICK REACHED BUTTON"));
  fireEvent.click(kumpulkan);
  await new Promise((r) => setTimeout(r, 200));
  console.log("after click error:", document.querySelector(".form-error")?.textContent ?? "none");
  fireEvent.submit(kumpulkan.form!);
  await new Promise((r) => setTimeout(r, 200));
  console.log("after submitEvent error:", document.querySelector(".form-error")?.textContent ?? "none");
  await new Promise((r) => setTimeout(r, 200));
  console.log("forms:", document.forms.length, "buttons:", document.querySelectorAll("button").length);
  console.log(
    "AFTER SUBMIT, dialog present:",
    !!screen.queryByText("Kumpulkan Hasil - Redesign halaman informasi penerbangan"),
  );
  console.log(document.querySelector(".form-error")?.textContent ?? "NO FORM ERROR");
  console.log(
    "ALL ALERTS:",
    Array.from(document.querySelectorAll("[role=alert]")).map((n) => n.textContent),
  );
  await waitFor(() => expect(screen.queryByText(/Format link/)).not.toBeNull(), { timeout: 3000 });
  console.log("ERROR SHOWN");
});

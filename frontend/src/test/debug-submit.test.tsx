import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SubmitDialog } from "@/components/internspace/intern/task-submit";
import type { Task } from "@/components/internspace/shared/model";
import { MockProvider } from "@/components/internspace/shared/model";

const task: Task = {
  id: "24",
  title: "Redesign halaman informasi penerbangan",
  description: "Susun ulang layout.",
  intern: "Budi Santoso",
  mentor: "Dewi Lestari",
  due: "2026-10-15T23:59:00+07:00",
  status: "In Progress",
  createdAt: "2026-10-01T08:00:00+07:00",
  everSubmitted: false,
  revisions: 0,
  comments: [],
  unread: { Intern: 0, Mentor: 0 },
};

it("inspect submit dialog", () => {
  render(
    <MockProvider initialRole="Intern">
      <SubmitDialog task={task} onClose={() => {}} submit={vi.fn(async () => {})} />
    </MockProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  fireEvent.change(screen.getByLabelText("Link hasil"), { target: { value: "drive.com/x" } });
  const btn = screen.getByRole("button", { name: "Kumpulkan" }) as HTMLButtonElement;
  fireEvent.click(btn);
  expect({
    formHtml: document.querySelector("form")?.outerHTML.slice(0, 1500),
    btnType: btn.type,
    hasForm: !!btn.form,
    alerts: document.querySelectorAll("[role=alert]").length,
    nativeSubmitSeen: "filled below",
  }).toBe("LIHAT DI ATAS");
});

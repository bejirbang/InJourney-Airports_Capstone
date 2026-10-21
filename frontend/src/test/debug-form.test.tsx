import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

function Plain() {
  const [hits, setHits] = useState(0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setHits((h) => h + 1); }}>
      <button type="submit">Kirim Polos</button>
      <output>{hits}</output>
    </form>
  );
}

function InDialog() {
  const [hits, setHits] = useState(0);
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Uji</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); setHits((h) => h + 1); }}>
          <Button type="submit">Kirim Dialog</Button>
          <output>{hits}</output>
        </form>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

it("plain form submit via click", () => {
  render(<Plain />);
  fireEvent.click(screen.getByRole("button", { name: "Kirim Polos" }));
  expect(screen.getByRole("status").textContent).toBe("1");
});

it("dialog form submit via click", () => {
  render(<InDialog />);
  fireEvent.click(screen.getByRole("button", { name: "Kirim Dialog" }));
  expect(screen.getByRole("status").textContent).toBe("1");
});

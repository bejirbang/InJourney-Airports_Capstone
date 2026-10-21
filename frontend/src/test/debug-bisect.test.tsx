import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/internspace/shared/ui";
import { useState } from "react";

const Probe = ({ variant }: { variant: "plain" | "segmented" | "url" | "label" }) => {
  const hits = vi.fn();
  const [kind, setKind] = useState<"file" | "link">("file");
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Uji {variant}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            hits();
          }}
        >
          {variant === "segmented" && (
            <Segmented
              label="Jenis hasil"
              value={kind}
              onChange={setKind}
              items={[
                { value: "file", label: "File" },
                { value: "link", label: "Link" },
              ]}
            />
          )}
          {variant === "url" && <input type="url" aria-label="Link hasil" />}
          {variant === "label" && (
            <label className="form-field">
              File hasil
              <input type="file" aria-label="File hasil" />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline">
              Batal
            </Button>
            <Button type="submit">Kumpulkan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const cases = ["plain", "segmented", "url", "label"] as const;
it.each(cases)("%s: klik Kumpulkan memicu submit", (variant) => {
  const spy = vi.fn();
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Uji {variant}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            spy();
          }}
        >
          {variant === "segmented" && (
            <Segmented
              label="Jenis hasil"
              value="file"
              onChange={() => {}}
              items={[
                { value: "file", label: "File" },
                { value: "link", label: "Link" },
              ]}
            />
          )}
          {variant === "url" && <input type="url" aria-label="Link hasil" />}
          {variant === "label" && (
            <label className="form-field">
              File hasil
              <input type="file" aria-label="File hasil" />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline">
              Batal
            </Button>
            <Button type="submit">Kumpulkan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Kumpulkan" }));
  expect(spy).toHaveBeenCalled();
});

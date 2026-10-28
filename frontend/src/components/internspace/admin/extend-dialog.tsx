import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { addDays, formatDateLong } from "@/lib/mock-rules";
import type { AdminPerson } from "@/lib/endpoints/admin";
import { useExtendInternship } from "@/components/internspace/admin/dashboard-data";
import { FormError } from "@/components/internspace/shared/ui";

export function ExtendDialog({
  intern,
  currentEnd,
  mutation,
  onClose,
}: {
  intern: Pick<AdminPerson, "id" | "name"> | null;
  currentEnd: string | null;
  mutation: ReturnType<typeof useExtendInternship>;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (intern === null) {
      setDate("");
      setError(null);
    }
  }, [intern]);

  return (
    <Dialog
      open={intern !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>Perpanjang Magang - {intern?.name}</DialogTitle>
        <DialogDescription>
          {currentEnd
            ? `Tanggal selesai saat ini: ${formatDateLong(currentEnd)}`
            : "Isi tanggal selesai baru."}
        </DialogDescription>
        <label className="form-field">
          Tanggal selesai baru *
          <input
            type="date"
            value={date}
            min={currentEnd ? addDays(currentEnd, 1) : undefined}
            onChange={(event) => {
              setDate(event.target.value);
              setError(null);
            }}
          />
        </label>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (intern === null) return;
              if (date === "") {
                setError("Tanggal selesai baru wajib diisi.");
                return;
              }
              mutation.mutate(
                { id: intern.id, endDate: date },
                {
                  onSuccess: onClose,
                  onError: (cause) =>
                    setError(
                      cause instanceof ApiError ? cause.message : "Perpanjangan gagal disimpan.",
                    ),
                },
              );
            }}
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

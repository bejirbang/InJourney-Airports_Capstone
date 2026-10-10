import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { addDays, canExtend, formatShort } from "@/lib/mock-rules";
import { type Person, useMock } from "@/components/internspace/shared/model";
import { FormError } from "@/components/internspace/shared/ui";

export function ExtendDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const m = useMock();
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={!!person}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setDate("");
          setError(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>Perpanjang Magang - {person?.name}</DialogTitle>
        <DialogDescription>
          Tanggal selesai saat ini: {person && formatShort(person.end, true)}
        </DialogDescription>
        <label className="form-field">
          Tanggal selesai baru *
          <input
            type="date"
            value={date}
            min={person ? addDays(person.end, 1) : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              if (!person) return;
              if (!canExtend(person.end, date))
                return setError("Tanggal baru harus setelah tanggal selesai saat ini.");
              m.setPeople((old) =>
                old.map((p) => (p.id === person.id ? { ...p, end: date, active: true } : p)),
              );
              m.log(
                "Akun",
                person.name,
                `Perpanjang magang dari ${formatShort(person.end, true)} ke ${formatShort(date, true)}.`,
              );
              toast.success("Perubahan tersimpan.");
              setDate("");
              setError(null);
              onClose();
            }}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

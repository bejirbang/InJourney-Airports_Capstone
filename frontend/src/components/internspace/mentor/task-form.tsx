import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { TODAY, dueOnHoliday, validateTask } from "@/lib/mock-rules";
import { ME, type Task, useMock } from "@/components/internspace/shared/model";
import { FormError } from "@/components/internspace/shared/ui";

export function TaskForm({ task, onClose }: { task: Task | "new" | null; onClose: () => void }) {
  const m = useMock();
  const editing = task && task !== "new" ? task : null;
  const active = m.internsOf(ME.Mentor).filter((p) => m.isActive(p));
  const [intern, setIntern] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setIntern(editing?.intern ?? "");
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setDate(editing?.due.slice(0, 10) ?? "");
    setTime(editing?.due.slice(11, 16) ?? "17:00");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);
  const due = date ? `${date}T${time || "17:00"}` : "";
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{editing ? "Ubah Task" : "Buat Task"}</DialogTitle>
        <DialogDescription>
          Setiap Task diberikan ke satu intern. Perubahan memberi notifikasi ke intern.
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const err = validateTask({ intern, title, description, due }, m.nowIso());
            setError(err);
            if (err) return;
            if (editing) {
              m.setTasks((old) =>
                old.map((t) =>
                  t.id === editing.id
                    ? { ...t, title: title.trim(), description: description.trim(), due }
                    : t,
                ),
              );
              if (editing.intern === ME.Intern)
                m.notify("Intern", `Task '${title.trim()}' diubah mentor.`, "/task", {
                  open: editing.id,
                });
              toast.success("Perubahan tersimpan.");
            } else {
              const id = `TSK-${String(Math.max(...m.tasks.map((t) => Number(t.id.slice(4)))) + 1).padStart(3, "0")}`;
              m.setTasks((old) => [
                ...old,
                {
                  id,
                  title: title.trim(),
                  description: description.trim(),
                  intern,
                  mentor: ME.Mentor,
                  due,
                  status: "To Do",
                  createdAt: m.nowIso(),
                  everSubmitted: false,
                  revisions: 0,
                  comments: [],
                  unread: { Intern: 0, Mentor: 0 },
                },
              ]);
              if (intern === ME.Intern)
                m.notify("Intern", `Task baru dari ${ME.Mentor}: ${title.trim()}.`, "/task", {
                  open: id,
                });
              toast.success("Task dibuat. Intern sudah diberi tahu.");
            }
            onClose();
          }}
        >
          <label className="form-field">
            Intern *
            <select value={intern} disabled={!!editing} onChange={(e) => setIntern(e.target.value)}>
              <option value="">Pilih intern</option>
              {active.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Judul *
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="form-field">
            Deskripsi *
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="form-two">
            <label className="form-field">
              Tenggat (tanggal) *
              <input
                type="date"
                value={date}
                min={TODAY}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="form-field">
              Jam
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          {dueOnHoliday(due, m.holidayDates) && (
            <p className="text-[11px] text-warning">
              Tenggat jatuh pada hari libur. Task tetap bisa disimpan.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Lampiran referensi, prioritas, dan label belum termasuk versi ini.
          </p>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

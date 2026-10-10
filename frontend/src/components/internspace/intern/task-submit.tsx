import { Link } from "@tanstack/react-router";
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
import { validateSubmission } from "@/lib/mock-rules";
import { type Task, shortName, useMock } from "@/components/internspace/shared/model";
import { type Update } from "@/components/internspace/shared/tasks";
import { FileField, FormError } from "@/components/internspace/shared/ui";

export function SubmitDialog({
  task,
  onClose,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  update: Update;
}) {
  const m = useMock();
  const [link, setLink] = useState("");
  const [file, setFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLink("");
    setFile("");
    setError(null);
  }, [task?.id]);
  if (!task) return <Dialog open={false} />;
  const replacing = !!(task.link || task.file);
  const late = m.nowIso() > task.due;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Kumpulkan Hasil - {task.title}</DialogTitle>
        <DialogDescription>Isi link, file, atau keduanya.</DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (task.status === "Done") return setError("Task ini sudah selesai.");
            const err = validateSubmission(link, file);
            setError(err);
            if (err) return;
            const wasReview = task.status === "In Review";
            update(task.id, (t) => {
              const next: Task = {
                ...t,
                status: "In Review",
                everSubmitted: true,
                submittedAt: m.nowIso(),
                revisePending: false,
              };
              delete next.link;
              delete next.file;
              if (link.trim()) next.link = link.trim();
              if (file) next.file = file;
              return next;
            });
            m.notify(
              "Mentor",
              wasReview
                ? `${shortName(task.intern)} mengganti hasil Task '${task.title}'.`
                : `${shortName(task.intern)} mengumpulkan Task '${task.title}'.`,
              "/task",
              { open: task.id },
            );
            toast.success("Hasil terkumpul. Menunggu pemeriksaan mentor.");
            onClose();
          }}
        >
          <label className="form-field">
            Link hasil
            <input
              type="url"
              placeholder="https://"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </label>
          <FileField label="File hasil" onFile={setFile} />
          {replacing && (
            <div className="banner warn">
              Hasil sebelumnya akan diganti dan file lama dihapus permanen.
            </div>
          )}
          {late && (
            <div className="banner warn">
              Tenggat sudah lewat. Hasil tetap dapat dikumpulkan, mentor yang memutuskan.
            </div>
          )}
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Kumpulkan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

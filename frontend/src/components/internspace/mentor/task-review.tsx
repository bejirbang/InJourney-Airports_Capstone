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
import { validateRevise } from "@/lib/mock-rules";
import { ME, type Task, useMock } from "@/components/internspace/shared/model";
import { type Update } from "@/components/internspace/shared/tasks";
import { Confirm, FormError } from "@/components/internspace/shared/ui";

export function ReviseDialog({
  task,
  onClose,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  update: Update;
}) {
  const m = useMock();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText("");
    setError(null);
  }, [task?.id]);
  if (!task) return <Dialog open={false} />;
  const p = m.person(task.intern);
  const inactive = !!p && !m.isActive(p);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Revise Task - {task.title}</DialogTitle>
        <DialogDescription>
          Task akan kembali ke In Progress dan intern diberi tahu.
        </DialogDescription>
        {inactive && (
          <div className="banner warn">
            Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi.
          </div>
        )}
        <label className="form-field">
          Komentar revisi *
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const err = validateRevise(text);
              setError(err);
              if (err) return;
              update(task.id, (t) => ({
                ...t,
                status: "In Progress",
                revisions: t.revisions + 1,
                revisePending: true,
                unread: { ...t.unread, Intern: t.unread.Intern + 1 },
                comments: [
                  ...t.comments,
                  {
                    id: Date.now(),
                    author: ME.Mentor,
                    role: "Mentor",
                    text: text.trim(),
                    at: m.nowIso(),
                    revise: true,
                  },
                ],
              }));
              if (task.intern === ME.Intern)
                m.notify("Intern", `Task '${task.title}' perlu direvisi.`, "/task", {
                  open: task.id,
                });
              toast.success("Task dikembalikan ke intern untuk diperbaiki.");
              onClose();
            }}
          >
            Kirim Revisi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AcceptDialog({
  task,
  onClose,
  update,
}: {
  task: Task | null;
  onClose: () => void;
  update: Update;
}) {
  const m = useMock();
  const [text, setText] = useState("");
  if (!task) return null;
  return (
    <Confirm
      open
      title={`Accept Task - ${task.title}`}
      confirmLabel="Accept"
      onClose={() => {
        setText("");
        onClose();
      }}
      onConfirm={() => {
        update(task.id, (t) => ({
          ...t,
          status: "Done",
          doneAt: m.nowIso(),
          revisePending: false,
          comments: text.trim()
            ? [
                ...t.comments,
                {
                  id: Date.now(),
                  author: ME.Mentor,
                  role: "Mentor",
                  text: text.trim(),
                  at: m.nowIso(),
                },
              ]
            : t.comments,
        }));
        if (task.intern === ME.Intern)
          m.notify("Intern", `Task '${task.title}' diterima.`, "/task", { open: task.id });
        toast.success("Task diterima dan ditandai Done.");
        setText("");
        onClose();
      }}
    >
      <p>Task akan ditandai Done, terkunci, dan intern diberi tahu.</p>
      <label className="form-field mt-3">
        Komentar (opsional)
        <textarea className="!min-h-16" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
    </Confirm>
  );
}

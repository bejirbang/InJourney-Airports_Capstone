import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_FILE_MB,
  SUBMISSION_EXTENSIONS,
  taskIsLate,
  validateSubmissionFile,
  validateSubmissionLink,
} from "@/lib/mock-rules";
import { ApiError } from "@/lib/api";
import type { Task } from "@/components/internspace/shared/model";
import { FormError, Segmented } from "@/components/internspace/shared/ui";

/** Isian dialog submit: satu pilihan, file atau link. Pengiriman ditangani induk (API atau mock). */
export type SubmitInput = { link: string; file: File | null };

type Kind = "file" | "link";

export function SubmitDialog({
  task,
  onClose,
  submit,
}: {
  task: Task | null;
  onClose: () => void;
  submit: (task: Task, input: SubmitInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>("file");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setKind("file");
    setLink("");
    setFile(null);
    setFileError(null);
    setError(null);
    setBusy(false);
  }, [task?.id]);
  if (!task) return <Dialog open={false} />;

  const replacing = task.everSubmitted;
  const late = task.late ?? taskIsLate(task.due, task.status, task.submittedAt);

  const send = async () => {
    const err =
      kind === "link"
        ? validateSubmissionLink(link)
        : file
          ? validateSubmissionFile(file)
          : "Pilih file hasil.";
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await submit(task, kind === "link" ? { link: link.trim(), file: null } : { link: "", file });
      onClose();
    } catch (e) {
      // Pesan penolakan (misalnya jenis file ditolak server) ditampilkan apa adanya.
      setError(e instanceof ApiError ? e.message : "Tidak bisa mengirim hasil. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Kumpulkan Hasil - {task.title}</DialogTitle>
        <DialogDescription>Kirim satu hasil: berkas atau tautan kerja Anda.</DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Segmented
            label="Jenis hasil"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setError(null);
            }}
            items={[
              { value: "file", label: "File" },
              { value: "link", label: "Link" },
            ]}
          />
          {kind === "file" ? (
            <label className="form-field">
              File hasil
              <input
                type="file"
                aria-label="File hasil"
                accept={SUBMISSION_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  const err = picked ? validateSubmissionFile(picked) : null;
                  setFileError(err);
                  // File yang ditolak tidak dipakai, agar tidak terkirim diam-diam.
                  setFile(err ? null : picked);
                  if (err) e.target.value = "";
                }}
              />
              <small className="text-muted-foreground">
                {SUBMISSION_EXTENSIONS.join(", ").toUpperCase()}. Maksimal {MAX_FILE_MB} MB.
              </small>
              <FormError text={fileError} />
            </label>
          ) : (
            <label className="form-field">
              Link hasil
              <input
                type="url"
                aria-label="Link hasil"
                placeholder="https://"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
              />
              <small className="text-muted-foreground">
                Gunakan tautan berbagi dokumen atau demo, misalnya Google Drive.
              </small>
            </label>
          )}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Mengirim..." : "Kumpulkan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

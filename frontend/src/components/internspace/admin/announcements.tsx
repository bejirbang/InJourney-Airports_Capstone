import { Plus } from "lucide-react";
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
import { formatDateTime } from "@/lib/mock-rules";
import type { AdminAnnouncement } from "@/lib/endpoints/admin";
import {
  useAdminAnnouncements,
  useDeleteAnnouncement,
  useSaveAnnouncement,
} from "@/components/internspace/admin/announcements-data";
import { errorText } from "@/components/internspace/admin/utils";
import {
  Confirm,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  SimpleTable,
} from "@/components/internspace/shared/ui";

// ---------- Pengumuman (design-admin.md Alur 9) ----------
export function AnnouncementsPage() {
  const list = useAdminAnnouncements();
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();
  const [form, setForm] = useState<AdminAnnouncement | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AdminAnnouncement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [forIntern, setForIntern] = useState(true);
  const [forMentor, setForMentor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const editing = form && form !== "new" ? form : null;
    setTitle(editing?.title ?? "");
    setBody(editing?.body ?? "");
    setForIntern(editing ? editing.for_intern : true);
    setForMentor(editing ? editing.for_mentor : false);
    setError(null);
  }, [form]);

  const editing = form && form !== "new" ? form : null;

  return (
    <>
      <PageHeading
        title="Pengumuman"
        subtitle="Pengumuman tampil di bell icon role penerima."
        action={
          <Button onClick={() => setForm("new")}>
            <Plus /> Buat Pengumuman
          </Button>
        }
      />
      <Panel title="Daftar pengumuman">
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <SimpleTable
            empty="Belum ada pengumuman."
            head={["Judul", "Penerima", "Diperbarui", "Aksi"]}
            rows={(list.data ?? []).map((announcement) => [
              <span key="title">
                <strong>{announcement.title}</strong>
                <small className="block max-w-md truncate text-muted-foreground">
                  {announcement.body}
                </small>
              </span>,
              [announcement.for_intern ? "Intern" : null, announcement.for_mentor ? "Mentor" : null]
                .filter(Boolean)
                .join(", ") || "-",
              announcement.updated_at ? formatDateTime(announcement.updated_at) : "-",
              <span key="actions" className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setForm(announcement)}>
                  Ubah
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setToDelete(announcement)}
                >
                  Hapus
                </Button>
              </span>,
            ])}
          />
        )}
      </Panel>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogTitle>{editing ? "Ubah Pengumuman" : "Buat Pengumuman"}</DialogTitle>
          <DialogDescription>Perubahan tampil ke penerima.</DialogDescription>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim() === "" || body.trim() === "") {
                return setError("Judul dan isi wajib diisi.");
              }
              if (!forIntern && !forMentor) return setError("Pilih minimal satu penerima.");
              save.mutate(
                {
                  ...(editing ? { id: editing.id } : {}),
                  input: {
                    title: title.trim(),
                    body: body.trim(),
                    for_intern: forIntern,
                    for_mentor: forMentor,
                  },
                },
                {
                  onSuccess: (body) => {
                    toast.success(body.message);
                    setForm(null);
                  },
                  onError: (cause) => setError(errorText(cause, "Pengumuman gagal disimpan.")),
                },
              );
            }}
          >
            <label className="form-field">
              Judul *
              <input
                value={title}
                maxLength={255}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="form-field">
              Isi *
              <textarea
                className="min-h-32"
                maxLength={5000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <fieldset className="form-field">
              <legend className="mb-2">Penerima *</legend>
              <div className="flex gap-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={forIntern}
                    onChange={(event) => setForIntern(event.target.checked)}
                  />
                  Intern
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={forMentor}
                    onChange={(event) => setForMentor(event.target.checked)}
                  />
                  Mentor
                </label>
              </div>
            </fieldset>
            <FormError text={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Menyimpan..." : editing ? "Simpan" : "Kirim"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirm
        open={toDelete !== null}
        title="Hapus pengumuman?"
        confirmLabel="Hapus"
        destructive
        disabled={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete === null) return;
          remove.mutate(toDelete.id, {
            onSuccess: (message) => toast.success(message),
            onError: (cause) => toast.error(errorText(cause, "Pengumuman gagal dihapus.")),
          });
          setToDelete(null);
        }}
      >
        "{toDelete?.title}" akan dihapus dan tidak lagi tampil ke penerima.
      </Confirm>
    </>
  );
}

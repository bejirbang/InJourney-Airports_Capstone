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
import { TODAY, audienceValid, formatShort } from "@/lib/mock-rules";
import { ME, useMock } from "@/components/internspace/shared/model";
import {
  Confirm,
  FormError,
  PageHeading,
  Panel,
  SimpleTable,
} from "@/components/internspace/shared/ui";

// ---------- Pengumuman (design-admin.md Alur 9) ----------
export function AnnouncementsPage() {
  const m = useMock();
  const [form, setForm] = useState<number | "new" | null>(null);
  const [del, setDel] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [intern, setIntern] = useState(true);
  const [mentor, setMentor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = typeof form === "number" ? m.announcements.find((a) => a.id === form) : undefined;
  useEffect(() => {
    setTitle(editing?.title ?? "");
    setText(editing?.text ?? "");
    setIntern(editing ? editing.audience.includes("Intern") : true);
    setMentor(editing ? editing.audience.includes("Mentor") : false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const toDelete = m.announcements.find((a) => a.id === del);
  return (
    <>
      <PageHeading
        title="Pengumuman"
        subtitle="Pengumuman tampil di bell icon role penerima."
        action={
          <Button onClick={() => setForm("new")}>
            <Plus />
            Buat Pengumuman
          </Button>
        }
      />
      <Panel title="Daftar pengumuman">
        <SimpleTable
          empty="Belum ada pengumuman."
          head={["Judul", "Penerima", "Tanggal", "Aksi"]}
          rows={[...m.announcements]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => [
              <span key="t">
                <strong>{a.title}</strong>
                <small className="block text-muted-foreground max-w-md truncate">{a.text}</small>
              </span>,
              a.audience.replace(" & ", ", "),
              formatShort(a.date, true),
              <span key="a" className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setForm(a.id)}>
                  Ubah
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDel(a.id)}
                >
                  Hapus
                </Button>
              </span>,
            ])}
        />
      </Panel>
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogTitle>{editing ? "Ubah Pengumuman" : "Buat Pengumuman"}</DialogTitle>
          <DialogDescription>Perubahan tampil ke penerima.</DialogDescription>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !text.trim()) return setError("Judul dan isi wajib diisi.");
              if (!audienceValid(intern, mentor)) return setError("Pilih minimal satu penerima.");
              const audience = intern && mentor ? "Intern & Mentor" : intern ? "Intern" : "Mentor";
              if (editing) {
                m.setAnnouncements((old) =>
                  old.map((a) =>
                    a.id === editing.id
                      ? { ...a, title: title.trim(), text: text.trim(), audience }
                      : a,
                  ),
                );
                m.log("Pengumuman", title.trim(), "Ubah pengumuman.");
                toast.success("Perubahan tersimpan.");
              } else {
                m.setAnnouncements((old) => [
                  ...old,
                  {
                    id: Date.now(),
                    title: title.trim(),
                    text: text.trim(),
                    audience,
                    date: TODAY,
                    author: ME.Admin,
                  },
                ]);
                if (intern) m.notify("Intern", `Pengumuman: ${title.trim()}`, "/");
                if (mentor) m.notify("Mentor", `Pengumuman: ${title.trim()}`, "/");
                m.log(
                  "Pengumuman",
                  title.trim(),
                  `Buat pengumuman untuk ${audience.replace(" & ", " dan ")}.`,
                );
                toast.success("Pengumuman terkirim ke bell icon penerima.");
              }
              setForm(null);
            }}
          >
            <label className="form-field">
              Judul *
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="form-field">
              Isi *
              <textarea value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <fieldset className="form-field">
              <legend className="mb-2">Penerima *</legend>
              <div className="flex gap-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={intern}
                    onChange={(e) => setIntern(e.target.checked)}
                  />
                  Intern
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mentor}
                    onChange={(e) => setMentor(e.target.checked)}
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
              <Button type="submit">{editing ? "Simpan" : "Kirim"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!toDelete}
        title="Hapus pengumuman?"
        confirmLabel="Hapus"
        destructive
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!toDelete) return;
          m.setAnnouncements((old) => old.filter((a) => a.id !== toDelete.id));
          m.log("Pengumuman", toDelete.title, "Hapus pengumuman.");
          setDel(null);
          toast.success("Pengumuman dihapus.");
        }}
      >
        "{toDelete?.title}" akan dihapus dan tidak lagi tampil ke penerima.
      </Confirm>
    </>
  );
}

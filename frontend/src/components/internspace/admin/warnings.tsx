import { Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canEditWarning, formatShort } from "@/lib/mock-rules";
import { ME, useMock } from "@/components/internspace/shared/model";
import { Empty, PageHeading, Panel, Tag } from "@/components/internspace/shared/ui";

// ---------- Warning (design-admin.md Alur 8) ----------
export function WarningsPage() {
  const m = useMock();
  const interns = m.people.filter((p) => p.role === "Intern");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(interns[0]?.name ?? "");
  return (
    <>
      <PageHeading
        title="Warning"
        subtitle="Catatan peringatan sederhana tanpa level. Hanya admin yang melihatnya."
      />
      <div className="split">
        <Panel title="Intern">
          <div className="px-4 pb-3">
            <label className="search-field">
              <Search size={15} className="text-muted-foreground" />
              <input
                aria-label="Cari intern"
                placeholder="Cari intern"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="pick-list">
            {interns
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={selected === p.name ? "active" : ""}
                  onClick={() => setSelected(p.name)}
                >
                  {p.name}
                  <span>{m.warnings.filter((w) => w.intern === p.name).length}</span>
                </button>
              ))}
          </div>
        </Panel>
        {selected && <WarningList intern={selected} />}
      </div>
    </>
  );
}

export function WarningList({ intern }: { intern: string }) {
  const m = useMock();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const list = m.warnings
    .filter((w) => w.intern === intern)
    .sort((a, b) => b.created.localeCompare(a.created));
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Warning - {intern} <Tag tone="dark">Hanya terlihat oleh admin</Tag>
        </span>
      }
      action={
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus />
          Tambah Catatan
        </Button>
      }
    >
      {adding && (
        <form
          className="form-grid px-5 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            m.setWarnings((old) => [
              ...old,
              { id: Date.now(), intern, text: text.trim(), author: ME.Admin, created: m.nowIso() },
            ]);
            m.log("Warning", intern, "Tambah catatan warning.");
            setText("");
            setAdding(false);
            toast.success("Catatan tersimpan. Tidak ada notifikasi ke intern atau mentor.");
          }}
        >
          <textarea
            className="border border-border rounded-md p-3 text-xs min-h-20"
            aria-label="Catatan warning"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!text.trim()}>
              Simpan
            </Button>
          </div>
        </form>
      )}
      {list.length === 0 && !adding && <Empty>Belum ada catatan untuk intern ini.</Empty>}
      {list.map((w) => {
        const editable = canEditWarning(w.author, ME.Admin, w.created, m.nowIso());
        return (
          <div className="announcement" key={w.id}>
            <div className="flex-1">
              <h3>
                {formatShort(w.created, true)} - {w.author}
              </h3>
              {editId === w.id ? (
                <div className="grid gap-2 mt-2">
                  <textarea
                    className="border border-border rounded-md p-2 text-xs"
                    aria-label="Ubah catatan"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="form-actions">
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editText.trim()}
                      onClick={() => {
                        m.setWarnings((old) =>
                          old.map((x) => (x.id === w.id ? { ...x, text: editText.trim() } : x)),
                        );
                        m.log("Warning", intern, "Ubah catatan warning.");
                        setEditId(null);
                        toast.success("Perubahan tersimpan.");
                      }}
                    >
                      Simpan
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{w.text}</p>
              )}
              <small>{editable ? "Dapat diubah pembuat dalam 24 jam." : "Terkunci."}</small>
            </div>
            {editable && editId !== w.id && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Ubah catatan"
                onClick={() => {
                  setEditId(w.id);
                  setEditText(w.text);
                }}
              >
                <Pencil />
              </Button>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

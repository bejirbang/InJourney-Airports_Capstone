import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/lib/mock-rules";
import { initials, useMock } from "@/components/internspace/shared/model";
import { DetailList, FormError, PageHeading, Panel } from "@/components/internspace/shared/ui";

// ---------- Profil (semua role) ----------
export function ProfilePage() {
  const m = useMock();
  const [name, setName] = useState(m.me.name);
  const [phone, setPhone] = useState(m.me.phone ?? "");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setName(m.me.name);
    setPhone(m.me.phone ?? "");
  }, [m.me.name, m.me.phone]);
  return (
    <>
      <PageHeading
        title="Profil Saya"
        subtitle="Anda dapat mengubah nama, foto, dan kontak. Data lain dikelola admin."
      />
      <div className="grid gap-5 max-w-3xl">
        <Panel title="Data profil">
          <form
            className="form-grid px-5 pb-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return setError("Nama wajib diisi.");
              setError(null);
              // Nama tampilan tidak mengubah kunci data contoh.
              m.setPeople((old) =>
                old.map((p) => (p.id === m.me.id ? { ...p, phone: phone.trim() } : p)),
              );
              toast.success("Perubahan tersimpan.");
            }}
          >
            <div className="flex items-center gap-4">
              <span className="avatar !w-16 !h-16 !text-xl">{initials(name || m.me.name)}</span>
              <label className="form-field">
                Foto profil
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? "")}
                />
                {photo && (
                  <small className="text-muted-foreground">
                    {photo} (pratinjau tidak disimpan di prototipe)
                  </small>
                )}
              </label>
            </div>
            <div className="form-two">
              <label className="form-field">
                Nama lengkap
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="form-field">
                Nomor telepon
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xx-xxxx-xxxx"
                />
              </label>
            </div>
            <FormError text={error} />
            <div className="form-actions">
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        </Panel>
        <Panel title="Data akun" subtitle="Hanya dapat diubah admin.">
          <div className="px-5 pb-5">
            <DetailList
              items={[
                ["Email internal", m.me.email],
                ["Role", m.role],
                ["Jabatan atau bidang", m.me.title],
                ...(m.role === "Intern"
                  ? ([
                      ["Mentor", m.me.mentor],
                      ["Periode magang", m.me.start ? formatPeriod(m.me.start, m.me.end) : "-"],
                    ] as [string, string][])
                  : []),
                ["Password", "Diganti saat login pertama atau lewat reset oleh admin."],
              ]}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/lib/mock-rules";
import { ApiError, toMockRole } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { initials, useMock } from "@/components/internspace/shared/model";
import { DetailList, FormError, PageHeading, Panel } from "@/components/internspace/shared/ui";

// ---------- Profil (semua role) ----------
export function ProfilePage() {
  const auth = useAuth();
  const m = useMock();
  const user = auth.user;
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  const roleLabel = user ? toMockRole[user.role] : m.role;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Nama wajib diisi.");
    setError(null);
    setBusy(true);
    const phoneTrimmed = phone.trim();
    void (async () => {
      try {
        await auth.updateProfile({ name: trimmed, phone: phoneTrimmed });
        toast.success("Perubahan tersimpan.");
      } catch (submitErr) {
        setError(
          submitErr instanceof ApiError
            ? submitErr.message
            : "Tidak bisa menghubungi server. Periksa koneksi dan API.",
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <PageHeading
        title="Profil Saya"
        subtitle="Anda dapat mengubah nama dan kontak. Data lain dikelola admin."
      />
      <div className="grid gap-5 max-w-3xl">
        <Panel title="Data profil">
          <form className="form-grid px-5 pb-5" onSubmit={save}>
            <div className="flex items-center gap-4">
              <span className="avatar !w-16 !h-16 !text-xl">{initials(name || m.me.name)}</span>
            </div>
            <div className="form-two">
              <label className="form-field">
                Nama lengkap
                <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              </label>
              <label className="form-field">
                Nomor telepon
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xx-xxxx-xxxx"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="form-two">
              <label className="form-field">
                Email internal
                <input readOnly value={user?.email ?? m.me.email} aria-readonly="true" />
              </label>
              <label className="form-field">
                Role
                <input readOnly value={roleLabel} aria-readonly="true" />
              </label>
            </div>
            <FormError text={error} />
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </Panel>
        <Panel title="Data akun" subtitle="Hanya dapat diubah admin.">
          <div className="px-5 pb-5">
            <DetailList
              items={[
                ["Jabatan atau bidang", user?.title ?? m.me.title],
                ...(roleLabel === "Intern"
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

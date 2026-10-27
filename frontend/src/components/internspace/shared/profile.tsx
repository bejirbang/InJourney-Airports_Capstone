import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/lib/mock-rules";
import { ApiError, toMockRole } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { initials } from "@/components/internspace/shared/model";
import {
  DetailList,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
} from "@/components/internspace/shared/ui";

// ---------- Profil (semua role) ----------
// Hanya nomor telepon yang bisa diubah; nama, email, unit, dan data magang hanya tampil
// (progress.md 5.3, design-*.md bagian Profil). Avatar = inisial nama, tanpa unggah foto.
export function ProfilePage() {
  const auth = useAuth();
  const user = auth.user;
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setPhone(user.phone ?? "");
  }, [user]);

  if (!user) return <LoadingState />;

  const roleLabel = toMockRole[user.role];
  const profile = user.intern_profile;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const phoneTrimmed = phone.trim();
    void (async () => {
      try {
        // `phone` wajib ikut dikirim; kosong dikirim null agar lolos validasi server.
        const result = await auth.updateProfile(phoneTrimmed === "" ? null : phoneTrimmed);
        setPhone(result.user.phone ?? "");
        toast.success(result.message);
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
        subtitle="Anda dapat mengubah nomor telepon. Data lain dikelola admin."
      />
      <div className="grid gap-5 max-w-3xl">
        <Panel title="Data profil">
          <form className="form-grid px-5 pb-5" onSubmit={save}>
            <div className="flex items-center gap-4">
              <span className="avatar !w-16 !h-16 !text-xl">{initials(user.name)}</span>
            </div>
            <div className="form-two">
              <label className="form-field">
                Nama lengkap
                <input value={user.name} readOnly aria-readonly="true" />
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
                <input readOnly value={user.email} aria-readonly="true" />
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
                ["Unit", user.unit?.name ?? "-"],
                ...(roleLabel === "Intern" && profile
                  ? ([
                      ["Lokasi magang", profile.airport.name],
                      ["Universitas", profile.university],
                      ["Jurusan", profile.major],
                      ["Mentor", profile.mentor.name],
                      ["Periode magang", formatPeriod(profile.start_date, profile.end_date)],
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

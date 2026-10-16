import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validatePassword } from "@/lib/mock-rules";
import { ApiError, toMockRole } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMock } from "@/components/internspace/shared/model";
import airport from "@/assets/airport-banner.jpg";
import icon from "@/assets/icon.png";

function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <main className="account-page">
      <img className="account-photo" src={airport} alt="Terminal bandara dan pesawat di apron" />
      <div className="account-wash" />
      <div className="account-content">
        <Link to="/login" className="brand account-brand" aria-label="InJourney Airports">
          <img className="brand-mark" src={icon} alt="Logo InJourney Airports" />
          <div className="brand-word">
            InJourney<span>airports</span>
          </div>
        </Link>
        <div className="account-form">{children}</div>
        <footer className="account-footer">
          © 2026 InJourney Airports<span>Intern Management & Attendance System</span>
        </footer>
      </div>
      <div className="account-caption">
        <span>INJOURNEY AIRPORTS</span>
        <p>
          Awal perjalanan,
          <br />
          peluang tanpa batas.
        </p>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="account-field">
      {label}
      <div className="account-input">
        <LockKeyhole size={17} />
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${visible ? "Sembunyikan" : "Tampilkan"} ${label.toLowerCase()}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </Button>
      </div>
    </label>
  );
}

const demoAccounts = [
  { email: "admin@injourney.test", note: "Admin" },
  { email: "mentor@injourney.test", note: "Mentor" },
  { email: "intern@injourney.test", note: "Intern" },
  { email: "intern.baru@injourney.test", note: "login pertama (wajib ganti password)" },
];

/** Login lewat API Laravel. Tanpa Google OAuth dan tanpa pemulihan mandiri. */
export function LoginPage() {
  const auth = useAuth();
  const m = useMock();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AccountLayout>
      <span className="account-eyebrow">
        INTERN MANAGEMENT <span>PROTOTIPE</span>
      </span>
      <h1>Masuk</h1>
      <p className="account-intro">Gunakan email internal dan password dari admin.</p>
      <form
        className="account-fields"
        onSubmit={(e) => {
          e.preventDefault();
          const value = email.trim();
          if (!value) return setError("Email wajib diisi.");
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            return setError("Format email tidak valid.");
          if (!password) return setError("Password wajib diisi.");
          setError("");
          setBusy(true);
          void (async () => {
            try {
              const user = await auth.login(value, password);
              setPassword("");
              // Samakan role tampilan prototipe dengan role akun yang sebenarnya.
              m.setRole(toMockRole[user.role]);
              if (user.must_change_password) {
                m.setMustChangePassword(true);
                await navigate({ to: "/ganti-password" });
              } else {
                m.setMustChangePassword(false);
                await navigate({ to: "/" });
              }
            } catch (err) {
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Tidak bisa menghubungi server. Periksa koneksi dan API.",
              );
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label className="account-field">
          Email internal
          <div className="account-input">
            <Mail size={17} />
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@example.com"
            />
          </div>
        </label>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Masukkan password"
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" className="account-submit" disabled={busy}>
          {busy ? "Memeriksa..." : "Masuk"} <ArrowRight size={17} />
        </Button>
        <p className="text-xs text-muted-foreground">Lupa password? Hubungi admin.</p>
      </form>
      <details className="demo-box">
        <summary>Akun contoh untuk mencoba</summary>
        <p>
          Password <code>password</code> untuk semua akun di bawah.
        </p>
        <ul>
          {demoAccounts.map((a) => (
            <li key={a.email}>
              <button type="button" onClick={() => setEmail(a.email)}>
                {a.email}
              </button>{" "}
              · {a.note}
            </li>
          ))}
        </ul>
      </details>
    </AccountLayout>
  );
}

/** Ganti password wajib saat login pertama dan setelah reset oleh admin. */
export function ChangePasswordPage() {
  const auth = useAuth();
  const m = useMock();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AccountLayout>
      <div className="account-icon">
        <LockKeyhole />
      </div>
      <h1>Ganti Password</h1>
      <p className="account-intro">
        Demi keamanan, buat password baru Anda. Halaman lain terbuka setelah password diganti.
      </p>
      <form
        className="account-fields"
        onSubmit={(e) => {
          e.preventDefault();
          // Cek "sama dengan password sementara" dilakukan server; di sini cukup "".
          const err = validatePassword(password, confirmation, "");
          if (err) return setError(err);
          setError("");
          setBusy(true);
          void (async () => {
            try {
              await auth.changePassword(password, confirmation);
              setPassword("");
              setConfirmation("");
              m.setMustChangePassword(false);
              toast.success("Password tersimpan.");
              await navigate({ to: "/" });
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
        }}
      >
        <PasswordField
          label="Password baru"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="Password baru"
        />
        <PasswordField
          label="Ulangi password baru"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          placeholder="Ulangi password baru"
        />
        <p className="text-xs text-muted-foreground">
          Syarat: minimal 8 karakter, ada huruf dan angka.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" className="account-submit" disabled={busy}>
          {busy ? "Menyimpan..." : "Simpan Password"} <ArrowRight size={17} />
        </Button>
      </form>
      <p className="account-notice">Password tersimpan aman di server.</p>
    </AccountLayout>
  );
}

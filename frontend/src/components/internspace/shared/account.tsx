import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isAutoInactive, notStarted, validatePassword } from "@/lib/mock-rules";
import { DEMO_PASSWORD, ME, TEMP_PASSWORD, useMock } from "@/components/internspace/shared/model";
import airport from "@/assets/airport-banner.jpg";

function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <main className="account-page">
      <img className="account-photo" src={airport} alt="Terminal bandara dan pesawat di apron" />
      <div className="account-wash" />
      <div className="account-content">
        <Link to="/login" className="brand account-brand" aria-label="InJourney Airports">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
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
  { email: "nabila.putri@example.com", note: "Intern" },
  { email: "budi.santoso@example.com", note: "Mentor" },
  { email: "ayu.wulandari@example.com", note: "Admin" },
  { email: "dimas.arya@example.com", note: "magang sudah selesai" },
  { email: "hana.kusuma@example.com", note: "magang belum dimulai" },
];

/** Login dengan email internal buatan admin. Tanpa Google OAuth dan tanpa pemulihan mandiri. */
export function LoginPage() {
  const m = useMock();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
          const person = m.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
          if (!person || (password !== DEMO_PASSWORD && password !== TEMP_PASSWORD))
            return setError("Email atau password salah.");
          if (person.role === "Intern" && notStarted(person.start))
            return setError("Masa magang Anda belum dimulai.");
          if (!person.active || (person.role === "Intern" && isAutoInactive(person.end)))
            return setError("Akun Anda tidak aktif. Hubungi admin.");
          if (ME[person.role] !== person.name)
            return setError(
              `Prototipe hanya membuka tampilan ${ME[person.role]} untuk role ${person.role}.`,
            );
          setError("");
          setPassword("");
          m.setRole(person.role);
          if (password === TEMP_PASSWORD) {
            m.setMustChangePassword(true);
            void navigate({ to: "/ganti-password" });
          } else void navigate({ to: "/" });
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
        <Button type="submit" className="account-submit">
          Masuk <ArrowRight size={17} />
        </Button>
        <p className="text-xs text-muted-foreground">Lupa password? Hubungi admin.</p>
      </form>
      <details className="demo-box">
        <summary>Akun contoh untuk mencoba prototipe</summary>
        <p>
          Password <code>{DEMO_PASSWORD}</code>. Pakai <code>{TEMP_PASSWORD}</code> untuk mencoba
          alur login pertama (ganti password).
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
  const m = useMock();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
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
          const err = validatePassword(password, confirmation, TEMP_PASSWORD);
          if (err) return setError(err);
          setError("");
          setPassword("");
          setConfirmation("");
          m.setMustChangePassword(false);
          toast.success("Password tersimpan.");
          void navigate({ to: "/" });
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
        <Button type="submit" className="account-submit">
          Simpan Password <ArrowRight size={17} />
        </Button>
      </form>
      <p className="account-notice">Prototipe · Password tidak disimpan.</p>
    </AccountLayout>
  );
}

import { CalendarDays, ChevronLeft, ChevronRight, Lock, Paperclip, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_EXTENSIONS,
  MAX_FILE_MB,
  TODAY,
  addMonths,
  formatDateLong,
  formatMonth,
  validateEvidenceFile,
} from "@/lib/mock-rules";
import { initials } from "@/components/internspace/shared/model";

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action ?? (
        <div className="date-chip">
          <CalendarDays size={14} /> {formatDateLong(TODAY)}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

// Warna mengikuti tabel "Status dan warna" di dokumen desain. Teks selalu ikut tampil.
const tone: Record<string, string> = {
  Hadir: "green",
  Done: "green",
  Disetujui: "green",
  Aktif: "green",
  Terkirim: "green",
  "Sudah Clock Out": "green",
  Izin: "blue",
  "In Progress": "blue",
  "Sudah Clock In": "teal",
  "Tidak Hadir": "red",
  Ditolak: "red",
  "Ditolak Mentor": "red",
  "Ditolak Admin": "red",
  Terlambat: "red",
  "Lupa Clock Out": "orange",
  "Lupa Clock In": "orange",
  Revisi: "orange",
  "Belum dikirim": "orange",
  "Belum Dikirim": "orange",
  Pending: "yellow",
  Menunggu: "yellow",
  "Menunggu Mentor": "yellow",
  "Menunggu Admin": "yellow",
  "Menunggu Review": "yellow",
  "In Review": "yellow",
  Libur: "gray",
  Draft: "gray",
  "To Do": "gray",
  Dibatalkan: "gray",
  Nonaktif: "gray",
  "Belum Clock In": "light",
  "Belum Dibuka": "light",
  "Belum Diisi": "light",
  Berjalan: "light",
  "Di luar periode": "light",
  "Belum dimulai": "light",
  Dikoreksi: "dark",
  "Dikoreksi admin": "dark",
  "Baik Sekali": "green",
  Baik: "teal",
  Cukup: "yellow",
  Kurang: "red",
};
export function Status({ status, label }: { status: string; label?: string }) {
  return <span className={`status st-${tone[status] ?? "gray"}`}>{label ?? status}</span>;
}
export function Tag({ children, tone: t = "dark" }: { children: ReactNode; tone?: string }) {
  return <span className={`tag st-${t}`}>{children}</span>;
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          className={value === it.value ? "active" : ""}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          aria-pressed={value === it.value}
          className={value === it.value ? "active" : ""}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function FormError({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p role="alert" className="form-error">
      {text}
    </p>
  );
}

function Avatar({ name, blue = false }: { name: string; blue?: boolean }) {
  return <span className={`avatar ${blue ? "blue" : ""}`}>{initials(name)}</span>;
}

export function MonthNav({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (ym: string) => void;
  min: string;
  max: string;
}) {
  return (
    <div className="month-nav">
      <span className="text-muted-foreground">Bulan:</span>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Bulan sebelumnya"
        disabled={value <= min}
        onClick={() => onChange(addMonths(value, -1))}
      >
        <ChevronLeft />
      </Button>
      <strong>{formatMonth(value)}</strong>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Bulan berikutnya"
        disabled={value >= max}
        onClick={() => onChange(addMonths(value, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Dialog konfirmasi: dampak dijelaskan dalam kalimat biasa, tombol utama di kanan. */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Batal",
  destructive = false,
  disabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="detail-copy">{children}</div>
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nama file hasil beserta aksinya. File dari API tidak punya URL publik, jadi `onDownload`
 * mengambilnya lewat token; tanpa itu tombol Pratinjau/Unduh tampil sebagai prototipe.
 */
export function Attachment({
  name,
  onDownload,
}: {
  name: string;
  onDownload?: (() => void) | undefined;
}) {
  return (
    <span className="attachment">
      <Paperclip size={13} />
      {name}
      {!onDownload && (
        <Button variant="link" size="sm" className="h-auto p-0">
          Pratinjau
        </Button>
      )}
      <Button variant="link" size="sm" className="h-auto p-0" onClick={onDownload}>
        Unduh
      </Button>
    </span>
  );
}

export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="detail-list">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Locked({ text }: { text: string }) {
  return (
    <span className="locked" title={text}>
      <Lock size={11} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function ErrorState({
  onRetry,
  message,
}: {
  onRetry: () => void;
  /** Pesan dari server (ApiError) bila tersedia; kalau tidak, tampil pesan bawaan. */
  message?: string | undefined;
}) {
  return (
    <div className="state-box" role="alert">
      <p>{message || "Data gagal dimuat."}</p>
      <Button variant="outline" onClick={onRetry}>
        <RotateCw />
        Coba lagi
      </Button>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="state-box" aria-busy="true" aria-label="Memuat">
      <div className="skeleton w-1/3" />
      <div className="skeleton w-full h-24" />
      <div className="skeleton w-2/3" />
    </div>
  );
}

export function NoAccess() {
  return (
    <>
      <PageHeading title="Akses terbatas" />
      <Panel title="Anda tidak memiliki akses ke halaman ini.">
        <p className="detail-copy px-5 pb-5">
          Menu ini tidak tersedia untuk role yang sedang dipilih. Gunakan menu di samping.
        </p>
      </Panel>
    </>
  );
}

/**
 * Input file lampiran bukti (izin dan koreksi). Jenis file dibatasi PDF, Word, Excel, atau
 * PowerPoint, dan ukuran maksimal 2 MB (keputusan 13 Okt 2026). File yang ditolak tidak dipakai.
 */
export function FileField({ label, onFile }: { label: string; onFile: (name: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="form-field">
      {label}
      <input
        type="file"
        accept={DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const err = file ? validateEvidenceFile(file) : null;
          setError(err);
          if (err) e.target.value = "";
          onFile(file && !err ? file.name : "");
        }}
      />
      <small className="text-muted-foreground">
        {DOCUMENT_EXTENSIONS.join(", ").toUpperCase()}. Maksimal {MAX_FILE_MB} MB.
      </small>
      <FormError text={error} />
    </label>
  );
}

export function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

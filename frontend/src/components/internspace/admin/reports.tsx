import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TODAY, formatRange, formatShort, taskIsLate, workingDays } from "@/lib/mock-rules";
import { recap, useMock } from "@/components/internspace/shared/model";
import { FormError, PageHeading, Panel, SimpleTable } from "@/components/internspace/shared/ui";

// ---------- Laporan PDF (design-admin.md Alur 10) ----------
type ReportType = "absensi" | "izin" | "task";

export function ReportsPage() {
  const m = useMock();
  const [type, setType] = useState<ReportType | "">("");
  const [from, setFrom] = useState(`${TODAY.slice(0, 7)}-01`);
  const [to, setTo] = useState(TODAY);
  const [intern, setIntern] = useState("Semua");
  const [mentor, setMentor] = useState("Semua");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    head: string[];
    rows: React.ReactNode[][];
    title: string;
  } | null>(null);
  const interns = m.people
    .filter((p) => p.role === "Intern" && p.start)
    .filter(
      (p) =>
        (intern === "Semua" || p.name === intern) && (mentor === "Semua" || p.mentor === mentor),
    );
  const names = interns.map((p) => p.name);
  const build = () => {
    if (!type) return setError("Pilih jenis laporan.");
    if (!from || !to || to < from) return setError("Periode tidak valid.");
    setError(null);
    let head: string[] = [];
    let rows: React.ReactNode[][] = [];
    if (type === "absensi") {
      head = ["Intern", "Hadir", "Izin", "Tidak Hadir", "Lupa Clock Out", "Hari kerja"];
      rows = interns
        .map((p) => ({ p, r: recap(m.rowsFor(p.name, from, to)) }))
        .filter((x) => x.r.hariKerja > 0)
        .map(({ p, r }) => [p.name, r.hadir, r.izin, r.tidakHadir, r.lupa, r.hariKerja]);
    } else if (type === "izin") {
      head = ["Intern", "Jenis", "Tanggal", "Hari kerja", "Status", "Pemroses", "Catatan"];
      rows = m.leaves
        .filter((l) => names.includes(l.intern) && l.start <= to && l.end >= from)
        .map((l) => [
          l.intern,
          l.type,
          formatRange(l.start, l.end),
          workingDays(l.start, l.end, m.holidayDates),
          l.status,
          l.by ?? "-",
          l.note ?? "-",
        ]);
    } else {
      head = ["Intern", "Mentor", "Judul Task", "Status", "Terlambat"];
      rows = m.tasks
        .filter(
          (t) => names.includes(t.intern) && t.due.slice(0, 10) >= from && t.due.slice(0, 10) <= to,
        )
        .map((t) => [
          t.intern,
          t.mentor,
          t.title,
          t.status,
          taskIsLate(t.due, t.status, t.submittedAt) ? "Terlambat" : "-",
        ]);
    }
    if (rows.length === 0) {
      setPreview(null);
      return setError("Tidak ada data pada periode ini.");
    }
    const label = { absensi: "Rekap Absensi", izin: "Rekap Izin", task: "Rekap Task" }[type];
    setPreview({
      head,
      rows,
      title: `${label} · ${formatShort(from, true)} - ${formatShort(to, true)}`,
    });
    m.log("Laporan", label, `Export PDF ${formatShort(from, true)} - ${formatShort(to, true)}.`);
    toast.success("PDF disiapkan.", {
      description: "Prototipe menampilkan isi laporan. Unduhan PDF dikerjakan tim backend.",
    });
  };
  return (
    <>
      <PageHeading
        title="Laporan (Export PDF)"
        subtitle="Format PDF saja. Hanya admin yang bisa export."
      />
      <Panel title="Buat laporan">
        <div className="form-grid px-5 pb-5 max-w-xl">
          <fieldset className="form-field">
            <legend className="mb-2">Jenis laporan *</legend>
            <div className="radio-list">
              {(
                [
                  ["absensi", "Rekap Absensi"],
                  ["izin", "Rekap Izin"],
                  ["task", "Rekap Task"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="radio-item">
                  <input
                    type="radio"
                    name="report-type"
                    checked={type === v}
                    onChange={() => setType(v)}
                  />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-two">
            <label className="form-field">
              Periode dari *
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="form-field">
              Sampai *
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="form-two">
            <label className="form-field">
              Intern
              <select value={intern} onChange={(e) => setIntern(e.target.value)}>
                <option value="Semua">Semua</option>
                {m.people
                  .filter((p) => p.role === "Intern")
                  .map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
              </select>
            </label>
            <label className="form-field">
              Mentor
              <select value={mentor} onChange={(e) => setMentor(e.target.value)}>
                <option value="Semua">Semua</option>
                {m.people
                  .filter((p) => p.role === "Mentor")
                  .map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
              </select>
            </label>
          </div>
          <FormError text={error} />
          <div className="form-actions">
            <Button onClick={build}>
              <Download />
              Buat PDF
            </Button>
          </div>
        </div>
      </Panel>
      {preview && (
        <div className="mt-5">
          <Panel
            title={`Pratinjau isi PDF: ${preview.title}`}
            subtitle="InJourney Airports · Intern Management & Attendance System"
          >
            <SimpleTable head={preview.head} rows={preview.rows} empty="" />
          </Panel>
        </div>
      )}
    </>
  );
}

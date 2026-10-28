import { Download, FileSpreadsheet, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AdminReportFilters } from "@/lib/endpoints/admin";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useExportAssessmentPdf,
  useExportAttendancePdf,
  useExportReport,
  useReportOptions,
  useReportPreview,
} from "@/components/internspace/admin/reports-data";
import { errorText, todayIso } from "@/components/internspace/admin/utils";
import {
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Tag,
} from "@/components/internspace/shared/ui";

const SHEET_LABEL: Record<string, string> = {
  attendance: "Rekap Presensi",
  leave: "Rekap Izin",
  logbook: "Rekap Logbook",
  assessment: "Rekap Penilaian",
};

// ---------- Laporan Excel dan PDF (design-admin.md Alur 13) ----------
export function ReportsPage() {
  const filter = useAirportFilter();
  const options = useReportOptions();
  const preview = useReportPreview();
  const exportExcel = useExportReport();
  const attendancePdf = useExportAttendancePdf();
  const assessmentPdf = useExportAssessmentPdf();

  const today = todayIso();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [mentorId, setMentorId] = useState("");
  const [internSearch, setInternSearch] = useState("");
  const [internIds, setInternIds] = useState<number[]>([]);
  const [sheets, setSheets] = useState<string[]>([]);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfIntern, setPdfIntern] = useState("");
  const [pdfMonth, setPdfMonth] = useState(today.slice(0, 7));
  const [pdfError, setPdfError] = useState<string | null>(null);

  const allSheets = Object.keys(options.data?.sheets ?? SHEET_LABEL);
  const chosenSheets = sheets.length === 0 ? allSheets : sheets;
  const interns = useMemo(() => options.data?.interns ?? [], [options.data?.interns]);
  const filteredInterns = useMemo(() => {
    const needle = internSearch.trim().toLowerCase();
    if (needle === "") return interns;
    return interns.filter(
      (intern) =>
        intern.name.toLowerCase().includes(needle) || intern.email.toLowerCase().includes(needle),
    );
  }, [interns, internSearch]);

  const filters = (): AdminReportFilters => ({
    from,
    to,
    ...(filter.airportId === null ? {} : { airport_id: filter.airportId }),
    ...(mentorId === "" ? {} : { mentor_id: Number(mentorId) }),
    ...(internIds.length === 0 ? {} : { intern_ids: internIds }),
    ...(chosenSheets.length === 0 || chosenSheets.length === allSheets.length
      ? {}
      : { sheets: chosenSheets }),
    ...(quotaExhausted ? { quota_exhausted: true } : {}),
  });

  const validate = (): boolean => {
    setError(null);
    if (from === "" || to === "") {
      setError("Periode wajib diisi.");
      return false;
    }
    if (to < from) {
      setError("Tanggal sampai harus setelah tanggal mulai.");
      return false;
    }
    return true;
  };

  const pdfInternName = interns.find((intern) => String(intern.id) === pdfIntern)?.name ?? "intern";

  return (
    <>
      <PageHeading
        title="Laporan"
        subtitle="Unduh rekap Excel atau dokumen PDF per intern. Setiap unduhan tercatat di Log Aktivitas."
      />

      <Panel
        title="Excel"
        subtitle="Satu berkas berisi satu sheet untuk setiap jenis rekap yang dipilih."
      >
        {options.isLoading ? (
          <LoadingState />
        ) : options.isError ? (
          <ErrorState error={options.error} onRetry={() => void options.refetch()} />
        ) : (
          <div className="form-grid max-w-3xl px-5 pb-5">
            <div className="toolbar !px-0">
              <AirportFilter
                value={filter.airportId}
                onChange={(id) => {
                  filter.setAirport(id);
                  setPreviewCount(null);
                }}
                airports={filter.airports}
                disabled={filter.airportsLoading}
              />
            </div>
            <div className="form-two">
              <label className="form-field">
                Periode dari *
                <input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPreviewCount(null);
                  }}
                />
              </label>
              <label className="form-field">
                Sampai *
                <input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPreviewCount(null);
                  }}
                />
              </label>
            </div>
            <div className="form-two">
              <label className="form-field">
                Mentor
                <select
                  value={mentorId}
                  onChange={(event) => {
                    setMentorId(event.target.value);
                    setPreviewCount(null);
                  }}
                >
                  <option value="">Semua mentor</option>
                  {(options.data?.mentors ?? []).map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.name}
                      {mentor.is_active ? "" : " (nonaktif)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Cari intern (nama atau email)
                <span className="search-field">
                  <Search size={15} className="text-muted-foreground" />
                  <input
                    className="!w-full"
                    aria-label="Cari intern untuk laporan"
                    placeholder="Kosong = semua intern"
                    value={internSearch}
                    onChange={(event) => setInternSearch(event.target.value)}
                  />
                </span>
              </label>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Pilih intern</span>
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-lg border p-3">
                {filteredInterns.length === 0 ? (
                  <Empty>Tidak ada intern yang cocok.</Empty>
                ) : (
                  filteredInterns.map((intern) => (
                    <label className="inline-flex items-center gap-2 text-sm" key={intern.id}>
                      <input
                        type="checkbox"
                        checked={internIds.includes(intern.id)}
                        onChange={(event) => {
                          setInternIds((old) =>
                            event.target.checked
                              ? [...old, intern.id]
                              : old.filter((id) => id !== intern.id),
                          );
                          setPreviewCount(null);
                        }}
                      />
                      {intern.name}
                      <small className="text-muted-foreground">{intern.email}</small>
                    </label>
                  ))
                )}
              </div>
              {internIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {internIds.map((id) => {
                    const intern = interns.find((item) => item.id === id);
                    return (
                      <Tag key={id}>
                        {intern?.name ?? `#${id}`}{" "}
                        <button
                          type="button"
                          className="ml-1"
                          aria-label={`Hapus ${intern?.name ?? id}`}
                          onClick={() => {
                            setInternIds((old) => old.filter((item) => item !== id));
                            setPreviewCount(null);
                          }}
                        >
                          ×
                        </button>
                      </Tag>
                    );
                  })}
                </div>
              )}
            </div>
            <fieldset className="form-field">
              <legend className="mb-2">Isi laporan</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {allSheets.map((sheet) => (
                  <label className="inline-flex items-center gap-2 text-sm" key={sheet}>
                    <input
                      type="checkbox"
                      checked={chosenSheets.includes(sheet)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...chosenSheets, sheet]
                          : chosenSheets.filter((item) => item !== sheet);
                        setSheets(next.length === allSheets.length ? [] : next);
                        setPreviewCount(null);
                      }}
                    />
                    {options.data?.sheets[sheet] ?? SHEET_LABEL[sheet] ?? sheet}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={quotaExhausted}
                onChange={(event) => {
                  setQuotaExhausted(event.target.checked);
                  setPreviewCount(null);
                }}
              />
              Hanya intern dengan kuota izin habis
            </label>
            <FormError text={error} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {previewCount === null
                  ? "Belum ada pratinjau."
                  : `Pratinjau: ${previewCount} intern akan masuk.`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={preview.isPending}
                  onClick={() => {
                    if (!validate()) return;
                    preview.mutate(filters(), {
                      onSuccess: (count) => {
                        setPreviewCount(count);
                        if (count === 0) setError("Tidak ada data pada periode dan filter ini.");
                      },
                      onError: (cause) => setError(errorText(cause, "Pratinjau gagal dibuat.")),
                    });
                  }}
                >
                  Pratinjau
                </Button>
                <Button
                  disabled={exportExcel.isPending}
                  onClick={() => {
                    if (!validate()) return;
                    exportExcel.mutate(filters(), {
                      onSuccess: (filename) =>
                        toast.success(`Berkas diunduh: ${filename}`, {
                          description: "Excel berisi rekap sesuai filter dan sheet yang dipilih.",
                        }),
                      onError: (cause) => setError(errorText(cause, "Excel gagal diunduh.")),
                    });
                  }}
                >
                  <FileSpreadsheet /> Buat Excel
                </Button>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="PDF per intern"
        subtitle="Dokumen siap tanda tangan. Nama berkas mengikuti nama intern dan periode."
      >
        {options.isLoading ? (
          <LoadingState />
        ) : options.isError ? (
          <ErrorState error={options.error} onRetry={() => void options.refetch()} />
        ) : (
          <div className="form-grid max-w-3xl px-5 pb-5">
            <label className="form-field">
              Intern
              <select
                value={pdfIntern}
                onChange={(event) => {
                  setPdfIntern(event.target.value);
                  setPdfError(null);
                }}
              >
                <option value="">Pilih intern</option>
                {interns.map((intern) => (
                  <option key={intern.id} value={intern.id}>
                    {intern.name} — {intern.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-two">
              <label className="form-field">
                Bulan daftar kehadiran
                <input
                  type="month"
                  value={pdfMonth}
                  onChange={(event) => {
                    setPdfMonth(event.target.value);
                    setPdfError(null);
                  }}
                />
              </label>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  disabled={attendancePdf.isPending || pdfIntern === "" || pdfMonth === ""}
                  onClick={() => {
                    if (pdfIntern === "") return setPdfError("Pilih intern.");
                    attendancePdf.mutate(
                      { intern_id: Number(pdfIntern), month: pdfMonth },
                      {
                        onSuccess: (filename) => toast.success(`Berkas diunduh: ${filename}`),
                        onError: (cause) =>
                          setPdfError(errorText(cause, "PDF kehadiran gagal diunduh.")),
                      },
                    );
                  }}
                >
                  <Download /> PDF Daftar Kehadiran
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={assessmentPdf.isPending || pdfIntern === ""}
                onClick={() => {
                  if (pdfIntern === "") return setPdfError("Pilih intern.");
                  assessmentPdf.mutate(
                    { intern_id: Number(pdfIntern) },
                    {
                      onSuccess: (filename) => toast.success(`Berkas diunduh: ${filename}`),
                      onError: (cause) =>
                        setPdfError(errorText(cause, "PDF penilaian gagal diunduh.")),
                    },
                  );
                }}
              >
                <Download /> PDF Penilaian {pdfIntern === "" ? "" : `- ${pdfInternName}`}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                PDF penilaian hanya tersedia setelah penilaian disubmit mentor.
              </span>
            </div>
            <FormError text={pdfError} />
          </div>
        )}
      </Panel>
    </>
  );
}

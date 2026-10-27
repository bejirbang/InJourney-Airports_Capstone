import { useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import {
  ATTENDANCE_STATUS_LABEL,
  CORRECTED_LABEL,
  LEAVE_TYPE_LABEL,
  LOGBOOK_STATUS_LABEL,
  MISSED_CLOCK_OUT_LABEL,
  labelOf,
} from "@/lib/labels";
import { TODAY, formatDate, formatShort, formatShortTime } from "@/lib/mock-rules";
import type { ApiLogbookAction, ApiLogbookListDay, ApiLogbookState } from "@/lib/endpoints/intern";
import { type PageSearch } from "@/lib/search";
import { useInternDashboard } from "@/components/internspace/intern/dashboard-data";
import {
  useLogbookDay,
  useLogbookMonth,
  useSaveLogbook,
} from "@/components/internspace/intern/logbook-data";
import {
  DetailList,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Logbook intern (design-intern.md Alur 4, 8, dan 10) ----------

const ACTION_LABEL: Record<ApiLogbookAction, string> = {
  save: "Simpan",
  submit: "Kirim",
  resubmit: "Kirim Ulang",
};

const STATUS_OPTIONS: { value: "Semua" | ApiLogbookState; label: string }[] = [
  { value: "Semua", label: "Semua" },
  { value: "draft", label: labelOf(LOGBOOK_STATUS_LABEL, "draft") },
  { value: "pending_review", label: labelOf(LOGBOOK_STATUS_LABEL, "pending_review") },
  { value: "revision", label: labelOf(LOGBOOK_STATUS_LABEL, "revision") },
  { value: "approved", label: labelOf(LOGBOOK_STATUS_LABEL, "approved") },
  { value: "missing", label: labelOf(LOGBOOK_STATUS_LABEL, "missing") },
];

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/** Ringkasan satu baris: jenis izin, isi logbook, atau status presensi bila tidak ada isian. */
const rowSummary = (day: ApiLogbookListDay) => {
  if (day.work) return day.work;
  if (day.leave_type) return labelOf(LEAVE_TYPE_LABEL, day.leave_type);
  if (day.attendance_status !== "present" && day.attendance_status !== "late") {
    return labelOf(ATTENDANCE_STATUS_LABEL, day.attendance_status);
  }
  return "-";
};

export function InternLogbook() {
  const search = useSearch({ strict: false }) as PageSearch;
  const dashboard = useInternDashboard();
  const [month, setMonth] = useState<string | null>(null);
  const [status, setStatus] = useState<"Semua" | ApiLogbookState>("Semua");
  const [openDate, setOpenDate] = useState<string | null>(search.date ?? null);
  const activeMonth = month ?? (dashboard.data?.date ?? TODAY).slice(0, 7);
  const query = useLogbookMonth({
    month: activeMonth,
    ...(status === "Semua" ? {} : { status }),
  });

  // Tautan notifikasi membawa ?date=YYYY-MM-DD; buka detail tanggal itu.
  useEffect(() => {
    if (search.date) setOpenDate(search.date);
  }, [search.date]);

  const data = query.data;
  const bounds = data?.selectable_months ?? { first: activeMonth, last: activeMonth };

  return (
    <>
      <PageHeading
        title="Logbook"
        subtitle="Satu logbook per hari kerja. Terkirim ke mentor saat clock out."
      />
      {data && data.action_needed.length > 0 && (
        <Panel
          title={`Perlu ditindak (${data.action_needed.length})`}
          subtitle="Logbook revisi dan hari hasil koreksi yang belum diisi."
          className="action-box mb-5"
        >
          <div className="action-list">
            {data.action_needed.map((item) => {
              const revision = item.logbook_state === "revision";
              return (
                <button
                  key={item.date}
                  type="button"
                  className="action-row w-full text-left hover:bg-muted/40"
                  onClick={() => setOpenDate(item.date)}
                >
                  <strong>{formatShort(item.date)}</strong>
                  <span className="truncate">
                    {revision
                      ? (item.comment ?? "Mentor meminta perbaikan.")
                      : "Koreksi disetujui, logbook belum diisi."}
                  </span>
                  <span className={`meta ${revision ? "warn" : ""}`}>
                    {revision ? "Revisi" : "Belum diisi"}
                  </span>
                  <span className="font-semibold text-primary">
                    {revision ? "Perbaiki" : "Isi"}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}
      <Panel
        title="Daftar logbook"
        subtitle="Baris yang perlu ditindak bisa dibuka langsung untuk diisi."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="role-select"
              aria-label="Filter status logbook"
              value={status}
              onChange={(e) => setStatus(e.target.value as "Semua" | ApiLogbookState)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Status: {option.label}
                </option>
              ))}
            </select>
            <MonthNav
              value={activeMonth}
              onChange={(ym) => setMonth(ym)}
              min={bounds.first}
              max={bounds.last}
            />
          </div>
        }
      >
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : data && data.days.length === 0 ? (
          <Empty>
            {status === "Semua"
              ? "Belum ada hari kerja pada bulan ini."
              : "Tidak ada logbook dengan status ini pada bulan ini."}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table clickable">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Ringkasan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.days.map((day) => (
                  <tr
                    key={day.date}
                    onClick={() => setOpenDate(day.date)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setOpenDate(day.date)}
                  >
                    <td>{formatDate(day.date)}</td>
                    <td className="max-w-96 truncate">{rowSummary(day)}</td>
                    <td>
                      {day.logbook_state ? (
                        <Status status={labelOf(LOGBOOK_STATUS_LABEL, day.logbook_state)} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      )}
                    </td>
                    <td>
                      {day.action ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDate(day.date);
                          }}
                        >
                          {ACTION_LABEL[day.action]}
                        </Button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <LogbookDetail date={openDate} onClose={() => setOpenDate(null)} />
    </>
  );
}

function LogbookDetail({ date, onClose }: { date: string | null; onClose: () => void }) {
  const query = useLogbookDay(date);
  const save = useSaveLogbook();
  const [work, setWork] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const day = query.data;

  // Isian mengikuti logbook terbaru dari server setiap kali dialog berganti tanggal.
  useEffect(() => {
    setWork(day?.logbook?.work ?? "");
    setNotes(day?.logbook?.notes ?? "");
    setError(null);
    setNeedsCorrection(false);
  }, [date, day?.logbook?.work, day?.logbook?.notes]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!day?.action) return;
    const trimmed = work.trim();
    if (!trimmed) {
      setError("Isi apa yang Anda kerjakan hari ini.");
      return;
    }
    setError(null);
    setNeedsCorrection(false);
    save.mutate(
      { date: day.date, work: trimmed, notes: notes.trim() || null },
      {
        onSuccess: (result) => toast.success(result.message),
        onError: (err) => {
          setError(errorText(err, "Logbook belum tersimpan. Isian Anda tidak hilang, coba lagi."));
          setNeedsCorrection(err instanceof ApiError && err.reason === "needs_correction");
        },
      },
    );
  };

  const revisionComment = day?.reviews.find((review) => review.action === "revision");

  return (
    <Dialog open={date !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          Logbook{day ? ` · ${formatDate(day.date)}` : date ? ` · ${formatDate(date)}` : ""}
        </DialogTitle>
        <DialogDescription>
          {day?.action === "save"
            ? "Masih draft. Terkirim otomatis ke mentor saat clock out."
            : "Riwayat review mentor dan isian logbook. Satu logbook per hari."}
        </DialogDescription>
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : day ? (
          <div className="grid gap-4">
            <DetailList
              items={[
                [
                  "Status presensi",
                  <span key="attendance" className="flex flex-wrap items-center gap-2">
                    <Status status={labelOf(ATTENDANCE_STATUS_LABEL, day.attendance?.status)} />
                    {day.attendance?.is_corrected && <Tag>{CORRECTED_LABEL}</Tag>}
                    {day.attendance?.missed_clock_out && (
                      <Tag tone="orange">{MISSED_CLOCK_OUT_LABEL}</Tag>
                    )}
                  </span>,
                ],
                [
                  "Jam",
                  day.attendance
                    ? `Clock in ${day.attendance.clock_in_at ?? "-"} | Clock out ${
                        day.attendance.clock_out_at ?? "-"
                      }`
                    : "-",
                ],
                [
                  "Status logbook",
                  day.logbook_state ? (
                    <Status status={labelOf(LOGBOOK_STATUS_LABEL, day.logbook_state)} />
                  ) : (
                    "Belum ada logbook"
                  ),
                ],
                ...(day.logbook?.submitted_at
                  ? ([["Dikirim", formatShortTime(day.logbook.submitted_at)]] as [string, string][])
                  : []),
                ...(day.logbook?.approved_at
                  ? ([
                      [
                        "Disetujui",
                        `${day.logbook.approved_by ?? "Mentor"} · ${formatShortTime(
                          day.logbook.approved_at,
                        )}`,
                      ],
                    ] as [string, string][])
                  : []),
              ]}
            />

            {revisionComment && day.action === "resubmit" && (
              <div className="banner warn">
                <span>
                  <strong>Komentar mentor</strong>
                  {revisionComment.mentor ? ` (${revisionComment.mentor})` : ""}
                  {revisionComment.created_at
                    ? ` · ${formatShortTime(revisionComment.created_at)}`
                    : ""}
                  : {revisionComment.comment ?? "-"}
                </span>
              </div>
            )}

            {day.action ? (
              <form className="form-grid" onSubmit={submit}>
                <label className="form-field">
                  Yang saya kerjakan hari ini *
                  <textarea value={work} onChange={(e) => setWork(e.target.value)} />
                </label>
                <label className="form-field">
                  Kendala atau catatan (opsional)
                  <textarea
                    className="!min-h-16"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <FormError text={error} />
                {needsCorrection && (
                  <p className="text-[11px] text-muted-foreground">
                    Ajukan koreksi presensi untuk tanggal ini dari tab Koreksi di halaman Presensi.
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Tutup
                  </Button>
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? "Menyimpan..." : ACTION_LABEL[day.action]}
                  </Button>
                </DialogFooter>
              </form>
            ) : day.logbook ? (
              <DetailList
                items={[
                  ["Yang saya kerjakan", day.logbook.work],
                  ["Kendala atau catatan", day.logbook.notes || "-"],
                  [
                    "Status",
                    <Status
                      key="logbook"
                      status={labelOf(LOGBOOK_STATUS_LABEL, day.logbook.status)}
                    />,
                  ],
                ]}
              />
            ) : (
              <Empty>Tidak ada logbook untuk tanggal ini.</Empty>
            )}

            {day.reviews.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Riwayat review
                </h3>
                <div className="grid gap-2">
                  {day.reviews.map((review, index) => (
                    <div
                      key={`${review.created_at ?? ""}-${index}`}
                      className="rounded-md border border-border p-3 text-[11px]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{review.mentor ?? "Mentor"}</strong>
                        <Status status={review.action === "approved" ? "Disetujui" : "Revisi"} />
                        <span className="text-muted-foreground">
                          {review.created_at ? formatShortTime(review.created_at) : "-"}
                        </span>
                      </div>
                      <p className="mt-1">{review.comment ?? "Tanpa komentar."}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

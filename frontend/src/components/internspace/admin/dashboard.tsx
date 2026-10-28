import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarOff, ExternalLink, MessageSquare } from "lucide-react";
import { useState } from "react";
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
  ACCOUNT_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatDate, formatDateLong, formatShort, formatShortTime } from "@/lib/utils";
import type {
  AdminActionBox,
  AdminEndingInternship,
  AdminPendingCorrection,
  AdminTodayRow,
} from "@/lib/endpoints/admin";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useAdminDashboard,
  useExtendInternship,
} from "@/components/internspace/admin/dashboard-data";
import { useDecideCorrection } from "@/components/internspace/admin/corrections-data";
import { ExtendDialog } from "@/components/internspace/admin/extend-dialog";
import { NoActiveOfficeBanner } from "@/components/internspace/admin/offices";
import { ActionBox, ActionRow, TodayCounts } from "@/components/internspace/shared/dashboard-parts";
import {
  DetailList,
  Empty,
  ErrorState,
  LoadingState,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Admin (design-admin.md Alur 3) ----------
export function AdminDashboard() {
  const navigate = useNavigate();
  const filter = useAirportFilter();
  const dashboard = useAdminDashboard(filter.airportId);
  const decide = useDecideCorrection();
  const extend = useExtendInternship();

  const [detail, setDetail] = useState<{ title: string; rows: AdminTodayRow[] } | null>(null);
  const [correction, setCorrection] = useState<AdminPendingCorrection | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [ending, setEnding] = useState<AdminEndingInternship | null>(null);

  const ok = (message: string) => toast.success(message);

  const submitCorrection = () => {
    if (correction === null) return;
    if (note.trim() === "") {
      setNoteError("Catatan wajib diisi.");
      return;
    }
    decide.mutate(
      { id: correction.id, decision: "approve", note: note.trim() },
      {
        onSuccess: (body) => {
          ok(body.message);
          setCorrection(null);
          setNote("");
          setNoteError(null);
        },
        onError: (error) =>
          setNoteError(error instanceof ApiError ? error.message : "Koreksi gagal diproses."),
      },
    );
  };

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }

  const data = dashboard.data;
  if (!data) return null;

  const visibleCount = (box: AdminActionBox<unknown>) => box.total > 0;

  return (
    <div className="grid gap-5">
      <div className="toolbar">
        <AirportFilter
          value={filter.airportId}
          onChange={filter.setAirport}
          airports={filter.airports}
          disabled={filter.airportsLoading}
        />
        <span className="text-sm text-muted-foreground">{formatDateLong(data.date)}</span>
      </div>

      {data.holiday && (
        <div className="banner info">
          <CalendarOff size={16} />
          Hari ini hari libur: {data.holiday.name ?? "akhir pekan"}.
        </div>
      )}
      {!data.has_active_office && <NoActiveOfficeBanner link />}

      {!data.holiday && data.today && (
        <Panel title={`Hari ini (${data.today.interns} intern aktif)`}>
          <TodayCounts
            interns={data.today.interns}
            clockedIn={data.today.clocked_in}
            late={data.today.late}
            onLeave={data.today.on_leave}
            notClockedIn={data.today.not_clocked_in}
            onClick={(label, rows) => setDetail({ title: label, rows })}
            rows={data.today.rows}
          />
          {data.yesterday && (
            <p className="px-5 pb-5 text-[11px]">
              Kemarin ({formatDate(data.yesterday.date)}): Hadir {data.yesterday.present} |
              Terlambat {data.yesterday.late} | Lupa Clock In {data.yesterday.missed_clock_in} |
              Izin {data.yesterday.leave} | Tidak Hadir {data.yesterday.absent} | Lupa Clock Out{" "}
              {data.yesterday.missed_clock_out}
            </p>
          )}
        </Panel>
      )}

      <h2 className="section-title">Perlu tindakan</h2>
      <div className="action-grid">
        {visibleCount(data.overdue_leaves) && (
          <ActionBox
            title="Izin lewat 24 jam"
            count={data.overdue_leaves.total}
            all={
              <Link className="text-action" to="/izin">
                Lihat semua
              </Link>
            }
          >
            {data.overdue_leaves.items.map((leave) => (
              <ActionRow
                key={leave.id}
                who={leave.intern.name}
                what={labelOf(LEAVE_TYPE_LABEL, leave.type)}
                meta={`${leave.pending_hours} jam`}
                warn
                to="/izin"
                open={String(leave.id)}
              />
            ))}
          </ActionBox>
        )}

        {visibleCount(data.pending_corrections) && (
          <ActionBox
            title="Koreksi menunggu admin"
            count={data.pending_corrections.total}
            all={
              <Link className="text-action" to="/koreksi">
                Lihat semua
              </Link>
            }
          >
            {data.pending_corrections.items.map((item) => (
              <div className="action-row" key={item.id}>
                <strong>{item.intern.short_name}</strong>
                <span>{formatShort(item.date)}</span>
                <span className="meta">
                  {labelOf(ATTENDANCE_STATUS_LABEL, item.recorded_status)}
                  {item.recorded_missed_clock_out ? ", Lupa Clock Out" : ""}
                </span>
                <span className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setCorrection(item);
                      setNote("");
                      setNoteError(null);
                    }}
                  >
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void navigate({ to: "/koreksi", search: { open: String(item.id) } })
                    }
                  >
                    Buka
                  </Button>
                </span>
              </div>
            ))}
          </ActionBox>
        )}

        {visibleCount(data.pending_presentations) && (
          <ActionBox
            title="Presentasi menunggu"
            count={data.pending_presentations.total}
            all={
              <Link className="text-action" to="/presentasi">
                Lihat semua
              </Link>
            }
          >
            {data.pending_presentations.items.map((item) => (
              <div className="action-row" key={item.id}>
                <strong>{item.intern.short_name}</strong>
                <a
                  className="text-action inline-flex items-center gap-1"
                  href={item.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka link <ExternalLink size={12} />
                </a>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    void navigate({
                      to: "/presentasi",
                      search: { open: String(item.id), tab: "pending" },
                    })
                  }
                >
                  Buka
                </Button>
              </div>
            ))}
          </ActionBox>
        )}

        {visibleCount(data.ending_internships) && (
          <ActionBox
            title="Magang berakhir 7 hari"
            count={data.ending_internships.total}
            all={
              <Link className="text-action" to="/users">
                Lihat semua
              </Link>
            }
          >
            {data.ending_internships.items.map((item) => (
              <div className="action-row" key={item.intern.id}>
                <strong>{item.intern.short_name}</strong>
                <span>
                  {formatShort(item.end_date)} ({item.ends_in_days} hari)
                </span>
                <span className="meta">Mentor: {item.mentor.name}</span>
                <span className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void navigate({ to: "/chat", search: { to: item.mentor.name } })}
                  >
                    <MessageSquare /> Tanya
                  </Button>
                  <Button size="sm" onClick={() => setEnding(item)}>
                    Perpanjang
                  </Button>
                </span>
              </div>
            ))}
          </ActionBox>
        )}

        {visibleCount(data.quota_exhausted) && (
          <ActionBox
            title="Kuota izin habis"
            count={data.quota_exhausted.total}
            all={
              <Link className="text-action" to="/warning">
                Lihat semua
              </Link>
            }
          >
            {data.quota_exhausted.items.map((item) => (
              <ActionRow
                key={item.intern.id}
                who={item.intern.name}
                what={item.quota ? `${item.quota.used} dari ${item.quota.limit}` : "Kuota habis"}
                meta="Warning"
                to="/warning"
                open={String(item.intern.id)}
              />
            ))}
          </ActionBox>
        )}

        {visibleCount(data.new_assessments) && (
          <ActionBox
            title="Penilaian baru masuk"
            count={data.new_assessments.total}
            all={
              <Link className="text-action" to="/penilaian">
                Lihat semua
              </Link>
            }
          >
            {data.new_assessments.items.map((item) => (
              <ActionRow
                key={item.intern.id}
                who={item.intern.name}
                what={item.final_score === null ? "-" : String(item.final_score)}
                meta={item.assessed_by ?? ""}
                to="/penilaian"
                open={String(item.intern.id)}
              />
            ))}
          </ActionBox>
        )}
      </div>

      <Panel title="Asal kampus intern aktif">
        {data.campuses.length === 0 ? (
          <Empty>Belum ada intern aktif.</Empty>
        ) : (
          <div className="flex flex-wrap gap-3 px-5 pb-5">
            {data.campuses.map((campus) => (
              <span className="tag" key={campus.university}>
                {campus.university} <strong>{campus.total}</strong>
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogTitle>{detail?.title}</DialogTitle>
          <DialogDescription>Daftar nama intern pada kelompok ini.</DialogDescription>
          {detail && detail.rows.length === 0 ? (
            <Empty>Tidak ada nama pada kelompok ini.</Empty>
          ) : (
            <DetailList
              items={(detail?.rows ?? []).map((row): [string, string] => [
                row.intern.name,
                `${labelOf(ATTENDANCE_STATUS_LABEL, row.status)}${
                  row.clock_in_at ? ` · ${formatShortTime(row.clock_in_at)}` : ""
                }`,
              ])}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={correction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCorrection(null);
            setNote("");
            setNoteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Setujui koreksi</DialogTitle>
          <DialogDescription>
            Catatan admin wajib diisi. Hasil persetujuan mengikuti aturan server.
          </DialogDescription>
          {correction && (
            <div className="grid gap-3">
              <p className="text-sm">
                <strong>{correction.intern.name}</strong> · {formatDate(correction.date)}
              </p>
              <label className="grid gap-1 text-sm">
                Catatan admin *
                <textarea
                  className="min-h-24 rounded-md border px-3 py-2"
                  value={note}
                  maxLength={2000}
                  onChange={(event) => {
                    setNote(event.target.value);
                    if (noteError) setNoteError(null);
                  }}
                />
              </label>
              {noteError && <p className="form-error">{noteError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrection(null)}>
              Batal
            </Button>
            <Button onClick={submitCorrection} disabled={decide.isPending}>
              {decide.isPending ? "Menyimpan..." : "Setujui"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExtendDialog
        intern={ending?.intern ?? null}
        currentEnd={ending?.end_date ?? null}
        mutation={extend}
        onClose={() => setEnding(null)}
      />
    </div>
  );
}

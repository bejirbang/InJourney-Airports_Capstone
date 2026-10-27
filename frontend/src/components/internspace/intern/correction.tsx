import { useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { ATTENDANCE_STATUS_LABEL, CORRECTION_STATUS_LABEL, labelOf } from "@/lib/labels";
import { TODAY, addDays, formatShort, formatShortTime } from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import { useAttendanceDay } from "@/components/internspace/intern/attendance-data";
import { useInternDashboard } from "@/components/internspace/intern/dashboard-data";
import {
  useCancelCorrection,
  useCorrectionDetail,
  useCorrections,
  useSubmitCorrection,
} from "@/components/internspace/intern/correction-data";
import {
  Confirm,
  DetailList,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Koreksi presensi intern (design-intern.md Alur 7) ----------

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/** Catatan terakhir yang dipakai kolom Catatan: keputusan admin lebih dulu, lalu mentor. */
const latestNote = (mentorNote: string | null, adminNote: string | null) =>
  adminNote ?? mentorNote ?? "-";

export function CorrectionTab({
  presetDate,
  onPresetUsed,
}: {
  presetDate: string | null;
  onPresetUsed: () => void;
}) {
  const search = useSearch({ strict: false }) as PageSearch;
  const list = useCorrections();
  const dashboard = useInternDashboard();
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const detail = useCorrectionDetail(openId);
  const cancel = useCancelCorrection();

  useEffect(() => {
    if (search.open) setOpenId(search.open);
  }, [search.open]);
  useEffect(() => {
    if (presetDate) setFormOpen(true);
  }, [presetDate]);

  const today = dashboard.data?.date ?? TODAY;
  const periodStart = dashboard.data?.internship?.start_date ?? TODAY;

  return (
    <Panel
      title="Koreksi presensi"
      subtitle="Diajukan ke mentor dulu, lalu diproses admin. Tanpa bukti."
      action={
        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Ajukan Koreksi
        </Button>
      }
    >
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={list.error instanceof ApiError ? list.error.message : undefined}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.length === 0 ? (
        <Empty>Belum ada pengajuan koreksi.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table clickable">
            <thead>
              <tr>
                <th>Tanggal presensi</th>
                <th>Diajukan</th>
                <th>Status</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setOpenId(String(item.id))}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setOpenId(String(item.id))}
                >
                  <td>{formatShort(item.date, true)}</td>
                  <td>{item.submitted_at ? formatShortTime(item.submitted_at) : "-"}</td>
                  <td>
                    <Status status={labelOf(CORRECTION_STATUS_LABEL, item.status)} />
                  </td>
                  <td className="max-w-56 truncate">
                    {latestNote(item.mentor_note, item.admin_note)}
                  </td>
                  <td>
                    {item.can_cancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelError(null);
                          setCancelId(item.id);
                        }}
                      >
                        Batalkan
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(String(item.id));
                        }}
                      >
                        Lihat
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CorrectionForm
        open={formOpen}
        presetDate={presetDate}
        periodStart={periodStart}
        today={today}
        onClose={() => {
          setFormOpen(false);
          onPresetUsed();
        }}
      />

      <Dialog open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent>
          <DialogTitle>
            Koreksi {detail.data ? formatShort(detail.data.date, true) : ""}
          </DialogTitle>
          <DialogDescription>
            Keputusan yang sudah diproses tidak bisa dibuka ulang. Jika perlu, ajukan koreksi baru.
          </DialogDescription>
          {detail.isPending ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState
              message={detail.error instanceof ApiError ? detail.error.message : undefined}
              onRetry={() => void detail.refetch()}
            />
          ) : detail.data ? (
            <DetailList
              items={[
                [
                  "Status",
                  <Status
                    key="status"
                    status={labelOf(CORRECTION_STATUS_LABEL, detail.data.status)}
                  />,
                ],
                [
                  "Kondisi tercatat",
                  `${labelOf(ATTENDANCE_STATUS_LABEL, detail.data.recorded_status)}${
                    detail.data.recorded_missed_clock_out ? " · Lupa Clock Out" : ""
                  }`,
                ],
                [
                  "Jam tercatat",
                  `Clock in ${detail.data.recorded?.clock_in_at ?? "-"} | Clock out ${
                    detail.data.recorded?.clock_out_at ?? "-"
                  }`,
                ],
                ["Alasan", detail.data.reason],
                [
                  "Diajukan",
                  detail.data.submitted_at ? formatShortTime(detail.data.submitted_at) : "-",
                ],
                [
                  "Mentor",
                  detail.data.mentor
                    ? `${detail.data.mentor.name}${
                        detail.data.mentor_decided_at
                          ? ` · ${formatShortTime(detail.data.mentor_decided_at)}`
                          : ""
                      }`
                    : "-",
                ],
                ["Catatan mentor", detail.data.mentor_note ?? "-"],
                [
                  "Admin",
                  detail.data.admin
                    ? `${detail.data.admin.name}${
                        detail.data.admin_decided_at
                          ? ` · ${formatShortTime(detail.data.admin_decided_at)}`
                          : ""
                      }`
                    : "-",
                ],
                ["Catatan admin", detail.data.admin_note ?? "-"],
              ]}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Confirm
        open={cancelId !== null}
        title="Batalkan pengajuan koreksi?"
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        destructive
        disabled={cancel.isPending}
        onClose={() => setCancelId(null)}
        onConfirm={() => {
          if (cancelId === null) return;
          cancel.mutate(cancelId, {
            onSuccess: (result) => {
              setCancelId(null);
              toast.success(result.message);
            },
            onError: (err) => setCancelError(errorText(err, "Pengajuan gagal dibatalkan.")),
          });
        }}
      >
        Pengajuan akan ditarik dari antrean mentor. Presensi tidak berubah.
        <FormError text={cancelError} />
      </Confirm>
    </Panel>
  );
}

function CorrectionForm({
  open,
  presetDate,
  periodStart,
  today,
  onClose,
}: {
  open: boolean;
  presetDate: string | null;
  periodStart: string;
  today: string;
  onClose: () => void;
}) {
  const submit = useSubmitCorrection();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorded = useAttendanceDay(date === "" ? null : date);

  useEffect(() => {
    if (!open) return;
    setDate(presetDate ?? "");
    setReason("");
    setError(null);
  }, [open, presetDate]);

  const onSubmit = () => {
    const trimmed = reason.trim();
    if (date === "") {
      setError("Pilih tanggal yang akan dikoreksi.");
      return;
    }
    if (trimmed === "") {
      setError("Alasan wajib diisi.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Alasan maksimal 1000 karakter.");
      return;
    }
    setError(null);
    submit.mutate(
      { date, reason: trimmed },
      {
        onSuccess: (result) => {
          toast.success(result.message);
          onClose();
        },
        onError: (err) =>
          setError(
            errorText(err, "Pengajuan koreksi belum terkirim. Periksa koneksi lalu coba lagi."),
          ),
      },
    );
  };

  const day = recorded.data;
  const condition = day
    ? `${labelOf(ATTENDANCE_STATUS_LABEL, day.status)}${
        day.missed_clock_out ? " · Lupa Clock Out" : ""
      } · Clock in ${day.clock_in_at ?? "-"} | Clock out ${day.clock_out_at ?? "-"}${
        day.holiday_name ? ` · ${day.holiday_name}` : ""
      }`
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Ajukan Koreksi Presensi</DialogTitle>
        <DialogDescription>
          Pengajuan diperiksa mentor lebih dulu, lalu diproses admin. Jika disetujui, status hari
          itu menjadi Hadir.
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="form-field">
            Tanggal presensi *
            <input
              type="date"
              value={date}
              min={periodStart}
              max={addDays(today, -1)}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
            />
          </label>
          {date !== "" && (
            <p className="text-[11px] text-muted-foreground">
              {recorded.isPending
                ? "Memuat kondisi presensi..."
                : recorded.isError
                  ? "Kondisi presensi tidak bisa dimuat. Anda tetap bisa mengirim pengajuan."
                  : `Kondisi: ${condition}`}
            </p>
          )}
          <label className="form-field">
            Alasan *
            <textarea
              className="!min-h-20"
              value={reason}
              maxLength={1000}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
            <small className="text-muted-foreground">{reason.trim().length}/1000 karakter</small>
          </label>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Mengirim..." : "Kirim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

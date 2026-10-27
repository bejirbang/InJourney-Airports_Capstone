import { useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  DOCUMENT_EXTENSIONS,
  MAX_FILE_MB,
  type LeaveType,
  canCancelLeave,
  formatDate,
  formatRange,
  formatShortTime,
  leaveSubmittedLate,
  leaveTypes,
  validateEvidenceFile,
  validateLeave,
} from "@/lib/mock-rules";
import { ApiError, internToken } from "@/lib/api";
import { leaveApi, type ApiLeaveStatus } from "@/lib/endpoints/intern";
import { useAuth } from "@/lib/auth";
import { type PageSearch } from "@/lib/search";
import {
  LEAVES_KEY,
  toApiLeaveType,
  toViewLeave,
  useInternLeaveDetail,
  useInternLeaveList,
  useLeaveWorkingDays,
} from "@/components/internspace/intern/leaves-data";
import { ME, type Leave, typeShort } from "@/components/internspace/shared/model";
import {
  Attachment,
  Confirm,
  DetailList,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Intern (design-intern.md Alur 11) ----------
// Riwayat, pengajuan, dan pembatalan izin dibaca langsung dari API Laravel.
export function InternLeave() {
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as PageSearch;
  const [filter, setFilter] = useState<"Semua" | ApiLeaveStatus>("Semua");
  const [form, setForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancel, setCancel] = useState<Leave | null>(null);
  const listQuery = useInternLeaveList(filter);

  useEffect(() => {
    if (search.open) setOpenId(String(search.open));
  }, [search.open]);

  const leaves = (listQuery.data ?? []).map((leave) => toViewLeave(leave, ME.Intern));

  const cancelLeave = () => {
    if (!cancel) return;
    leaveApi
      .cancel(internToken(), cancel.id)
      .then((res) => toast.success(res.message))
      .catch((e: unknown) => {
        // Mentor atau admin bisa sudah memproses sejak dialog konfirmasi dibuka.
        toast.error(e instanceof ApiError ? e.message : "Izin tidak dapat dibatalkan. Coba lagi.");
      })
      .finally(() => {
        setCancel(null);
        void queryClient.invalidateQueries({ queryKey: LEAVES_KEY });
      });
  };

  return (
    <>
      <PageHeading
        title="Izin"
        subtitle="Hanya Izin Sakit dan Izin Urgent. Intern tidak memiliki cuti."
        action={
          <Button onClick={() => setForm(true)}>
            <Plus />
            Ajukan Izin
          </Button>
        }
      />
      <Panel
        title="Riwayat izin"
        action={
          <select
            className="role-select"
            aria-label="Filter status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="Semua">Status: Semua</option>
            <option value="pending">Pending</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        }
      >
        {listQuery.isPending ? (
          <LoadingState />
        ) : listQuery.isError ? (
          <ErrorState
            message={listQuery.error instanceof ApiError ? listQuery.error.message : undefined}
            onRetry={() => void listQuery.refetch()}
          />
        ) : leaves.length === 0 ? (
          <Empty>Belum ada pengajuan izin.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Tanggal</th>
                  <th>Hari kerja</th>
                  <th>Status</th>
                  <th>Diproses oleh</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{typeShort(l.type)}</td>
                    <td>{formatRange(l.start, l.end)}</td>
                    <td>{l.workingDays}</td>
                    <td>
                      <Status status={l.status} />
                    </td>
                    <td>{l.by ? `${l.by}${l.byRole === "Admin" ? " (admin)" : ""}` : "-"}</td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(String(l.id))}>
                        Lihat
                      </Button>
                      {(l.canCancel ?? canCancelLeave(l.status)) && (
                        <Button size="sm" variant="outline" onClick={() => setCancel(l)}>
                          Batalkan
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <LeaveForm open={form} existing={leaves} onClose={() => setForm(false)} />
      <LeaveDetail openId={openId} onClose={() => setOpenId(null)} />
      <Confirm
        open={!!cancel}
        title="Batalkan pengajuan izin?"
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        destructive
        onClose={() => setCancel(null)}
        onConfirm={cancelLeave}
      >
        {cancel &&
          `${cancel.type} ${formatRange(cancel.start, cancel.end)} akan dibatalkan dan tidak diproses lagi.`}
      </Confirm>
    </>
  );
}

function LeaveForm({
  open,
  existing,
  onClose,
}: {
  open: boolean;
  /** Izin yang sudah ada, dipakai klien untuk menolak tumpang tindih sebelum kirim. */
  existing: Leave[];
  onClose: () => void;
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setType("");
    setStart("");
    setEnd("");
    setReason("");
    setFile(null);
    setFileError(null);
    setError(null);
    setBusy(false);
  }, [open]);

  const profile = auth.user?.intern_profile;
  const daysQuery = useLeaveWorkingDays(start, end, open);

  const send = async () => {
    const err = validateLeave(
      { type, start, end, reason },
      {
        periodStart: profile?.start_date ?? "",
        periodEnd: profile?.end_date ?? "9999-12-31",
        // Libur dan hari kerja ikut diperiksa server dengan kalender terbaru.
        holidays: [],
        existing: existing.map((l) => ({ start: l.start, end: l.end, status: l.status })),
      },
    );
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      const result = await leaveApi.store(internToken(), {
        type: toApiLeaveType(type as LeaveType),
        start_date: start,
        end_date: end,
        reason: reason.trim(),
        evidence: file,
      });
      toast.success(result.message);
      await queryClient.invalidateQueries({ queryKey: LEAVES_KEY });
      onClose();
    } catch (e) {
      // Pesan penolakan server (tumpang tindih, di luar periode, jenis file) tampil apa adanya.
      setError(
        e instanceof ApiError
          ? e.message
          : "Izin belum terkirim. Isian Anda tidak hilang, coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Ajukan Izin</DialogTitle>
        <DialogDescription>
          Pengajuan dikirim ke mentor. Izin tidak dapat diubah setelah dikirim.
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <fieldset className="form-field">
            <legend className="mb-2">Jenis izin *</legend>
            <div className="radio-list">
              {leaveTypes.map((t) => (
                <label key={t} className="radio-item">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-two">
            <label className="form-field">
              Tanggal mulai *
              <input
                type="date"
                value={start}
                min={profile?.start_date}
                max={profile?.end_date}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="form-field">
              Tanggal selesai *
              <input
                type="date"
                value={end}
                min={start || profile?.start_date}
                max={profile?.end_date}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          {start && end && end >= start && (
            <p className="text-[11px] text-muted-foreground">
              {daysQuery.isPending ? (
                "Menghitung hari kerja..."
              ) : daysQuery.isError ? (
                "Jumlah hari kerja belum bisa dihitung. Kirim tetap diperiksa server."
              ) : (
                <>
                  Total: <strong>{daysQuery.data} hari kerja</strong> (Sabtu, Minggu, dan libur
                  tidak dihitung)
                </>
              )}
            </p>
          )}
          <label className="form-field">
            Alasan *
            <textarea
              className="!min-h-20"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="form-field">
            Lampiran bukti (misalnya surat dokter)
            <input
              type="file"
              aria-label="Lampiran bukti"
              accept={DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                const err = picked ? validateEvidenceFile(picked) : null;
                setFileError(err);
                // File yang ditolak tidak dipakai, agar tidak terkirim diam-diam.
                setFile(err ? null : picked);
                if (err) e.target.value = "";
              }}
            />
            <small className="text-muted-foreground">
              {DOCUMENT_EXTENSIONS.join(", ").toUpperCase()}. Maksimal {MAX_FILE_MB} MB.
            </small>
            <FormError text={fileError} />
          </label>
          <p className="banner muted">
            Tanpa lampiran, izin hanya dapat diproses mentor. Admin hanya membantu bila ada surat
            resmi atau bukti.
          </p>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Mengirim..." : "Kirim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDetail({ openId, onClose }: { openId: string | null; onClose: () => void }) {
  const query = useInternLeaveDetail(openId);
  const leave = query.data ? toViewLeave(query.data, ME.Intern) : null;

  const downloadEvidence = (id: number) => {
    leaveApi.evidence(internToken(), id, `lampiran-izin-${id}.pdf`).catch((e: unknown) => {
      toast.error(e instanceof ApiError ? e.message : "Lampiran tidak dapat diunduh. Coba lagi.");
    });
  };

  return (
    <Dialog open={openId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {leave ? `${leave.type} · ${formatRange(leave.start, leave.end)}` : "Detail izin"}
        </DialogTitle>
        <DialogDescription>Status dan catatan pemroses.</DialogDescription>
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : leave ? (
          <DetailList
            items={[
              ["Status", <Status key="s" status={leave.status} />],
              [
                "Tanggal",
                `${formatDate(leave.start)} - ${formatDate(leave.end)} (${leave.workingDays} hari kerja)`,
              ],
              ["Alasan", leave.reason],
              [
                "Lampiran",
                leave.evidence ? (
                  <Attachment
                    key="a"
                    name={leave.evidence}
                    onDownload={() => downloadEvidence(leave.id)}
                  />
                ) : (
                  "Tanpa bukti"
                ),
              ],
              [
                "Diajukan",
                `${formatShortTime(leave.submitted)}${(leave.submittedLate ?? leaveSubmittedLate(leave.start, leave.submitted)) ? " · Diajukan setelah tanggal izin" : ""}`,
              ],
              [
                "Diproses oleh",
                leave.by ? `${leave.by} (${leave.byRole === "Admin" ? "admin" : "mentor"})` : "-",
              ],
              ["Catatan", leave.note ?? "-"],
            ]}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

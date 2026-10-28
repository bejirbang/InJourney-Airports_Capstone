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
import { LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL, labelOf } from "@/lib/labels";
import { type LeaveType, formatDate, formatRange, formatShortTime, leaveTypes } from "@/lib/utils";
import type { ApiInternLeave, ApiLeaveStatus } from "@/lib/endpoints/intern";
import { useAuth } from "@/lib/auth";
import { type PageSearch } from "@/lib/search";
import {
  useCancelLeave,
  useInternLeaveDetail,
  useInternLeaveList,
  useLeaveWorkingDays,
  useSubmitLeave,
  toApiLeaveType,
} from "@/components/internspace/intern/leaves-data";
import {
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

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

const STATUS_OPTIONS: { value: "Semua" | ApiLeaveStatus; label: string }[] = [
  { value: "Semua", label: "Semua" },
  { value: "pending", label: labelOf(LEAVE_STATUS_LABEL, "pending") },
  { value: "approved", label: labelOf(LEAVE_STATUS_LABEL, "approved") },
  { value: "rejected", label: labelOf(LEAVE_STATUS_LABEL, "rejected") },
  { value: "cancelled", label: labelOf(LEAVE_STATUS_LABEL, "cancelled") },
];

/** Link bukti dibuka di tab baru; server sudah memastikan domainnya Google Drive/Docs. */
function EvidenceLink({ url }: { url: string | null }) {
  if (!url) return <>Tanpa bukti</>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline">
      Buka link bukti
    </a>
  );
}

export function InternLeave() {
  const search = useSearch({ strict: false }) as PageSearch;
  const [filter, setFilter] = useState<"Semua" | ApiLeaveStatus>("Semua");
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ApiInternLeave | null>(null);
  const listQuery = useInternLeaveList(filter);
  const cancelMutation = useCancelLeave();

  useEffect(() => {
    if (search.open) setOpenId(String(search.open));
  }, [search.open]);

  const leaves = listQuery.data?.leaves ?? [];
  const quota = listQuery.data?.quota;
  const exhausted = quota?.exhausted === true;

  return (
    <>
      <PageHeading
        title="Izin"
        subtitle="Hanya Izin Sakit dan Izin Urgent. Bukti berupa link Google Drive atau Google Docs."
        action={
          <Button onClick={() => setFormOpen(true)} disabled={exhausted}>
            <Plus />
            Ajukan Izin
          </Button>
        }
      />
      {exhausted && (
        <p className="banner warn mb-4">
          Kuota izin Anda sudah habis ({quota?.limit} kali). Silakan hubungi mentor.
        </p>
      )}
      <Panel
        title="Riwayat izin"
        subtitle={quota ? `Sisa kuota izin: ${quota.remaining} dari ${quota.limit}` : undefined}
        action={
          <select
            className="role-select"
            aria-label="Filter status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Status: {option.label}
              </option>
            ))}
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
            <table className="data-table clickable">
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
                {leaves.map((leave) => (
                  <tr
                    key={leave.id}
                    onClick={() => setOpenId(String(leave.id))}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(String(leave.id))}
                  >
                    <td>{labelOf(LEAVE_TYPE_LABEL, leave.type)}</td>
                    <td>{formatRange(leave.start_date, leave.end_date)}</td>
                    <td>{leave.working_days}</td>
                    <td>
                      <Status status={labelOf(LEAVE_STATUS_LABEL, leave.status)} />
                    </td>
                    <td>
                      {leave.decided_by
                        ? `${leave.decided_by.name}${
                            leave.decided_by.role === "admin" ? " (admin)" : ""
                          }`
                        : "-"}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(String(leave.id));
                          }}
                        >
                          Lihat
                        </Button>
                        {leave.can_cancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelTarget(leave);
                            }}
                          >
                            Batalkan
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <LeaveForm
        open={formOpen}
        exhausted={exhausted}
        quotaText={quota ? `${quota.remaining} dari ${quota.limit}` : undefined}
        onClose={() => setFormOpen(false)}
      />
      <LeaveDetail openId={openId} onClose={() => setOpenId(null)} />
      <Confirm
        open={cancelTarget !== null}
        title="Batalkan pengajuan izin?"
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        destructive
        disabled={cancelMutation.isPending}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          cancelMutation.mutate(cancelTarget.id, {
            onSuccess: (result) => {
              setCancelTarget(null);
              toast.success(result.message);
            },
            onError: (err) => {
              setCancelTarget(null);
              // Mentor/admin bisa sudah memproses sejak dialog dibuka.
              toast.error(errorText(err, "Izin tidak dapat dibatalkan. Coba lagi."));
            },
          });
        }}
      >
        {cancelTarget &&
          `${labelOf(LEAVE_TYPE_LABEL, cancelTarget.type)} ${formatRange(
            cancelTarget.start_date,
            cancelTarget.end_date,
          )} akan dibatalkan dan tidak diproses lagi.`}
      </Confirm>
    </>
  );
}

function LeaveForm({
  open,
  exhausted,
  quotaText,
  onClose,
}: {
  open: boolean;
  exhausted: boolean;
  quotaText?: string | undefined;
  onClose: () => void;
}) {
  const auth = useAuth();
  const submit = useSubmitLeave();
  const [type, setType] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType("");
    setStart("");
    setEnd("");
    setReason("");
    setEvidenceUrl("");
    setError(null);
  }, [open]);

  const profile = auth.user?.intern_profile;
  const daysQuery = useLeaveWorkingDays(start, end, open);

  const send = () => {
    if (type === "") {
      setError("Pilih jenis izin.");
      return;
    }
    if (start === "" || end === "") {
      setError("Isi tanggal mulai dan selesai.");
      return;
    }
    if (reason.trim() === "") {
      setError("Alasan wajib diisi.");
      return;
    }
    setError(null);
    const url = evidenceUrl.trim();
    submit.mutate(
      {
        type: toApiLeaveType(type as LeaveType),
        start_date: start,
        end_date: end,
        reason: reason.trim(),
        ...(url === "" ? {} : { evidence_url: url }),
      },
      {
        onSuccess: (result) => {
          toast.success(result.message);
          onClose();
        },
        onError: (err) =>
          setError(errorText(err, "Izin belum terkirim. Isian Anda tidak hilang, coba lagi.")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Ajukan Izin</DialogTitle>
        <DialogDescription>
          Pengajuan dikirim ke mentor. Satu pengajuan dihitung 1 kali dari kuota.
          {quotaText ? ` Sisa kuota: ${quotaText}.` : ""}
        </DialogDescription>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            send();
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
                    onChange={() => {
                      setType(t);
                      setError(null);
                    }}
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
                onChange={(e) => {
                  setStart(e.target.value);
                  setError(null);
                }}
              />
            </label>
            <label className="form-field">
              Tanggal selesai *
              <input
                type="date"
                value={end}
                min={start || profile?.start_date}
                max={profile?.end_date}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setError(null);
                }}
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
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="form-field">
            Link bukti (opsional)
            <input
              type="text"
              placeholder="https://drive.google.com/..."
              value={evidenceUrl}
              onChange={(e) => {
                setEvidenceUrl(e.target.value);
                setError(null);
              }}
            />
            <small className="text-muted-foreground">
              Hanya link Google Drive atau Google Docs. Pastikan akses link &quot;Siapa saja yang
              memiliki link dapat melihat&quot;.
            </small>
          </label>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submit.isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={submit.isPending || exhausted}>
              {submit.isPending ? "Mengirim..." : "Kirim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDetail({ openId, onClose }: { openId: string | null; onClose: () => void }) {
  const query = useInternLeaveDetail(openId);
  const leave = query.data;

  return (
    <Dialog open={openId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {leave
            ? `${labelOf(LEAVE_TYPE_LABEL, leave.type)} · ${formatRange(
                leave.start_date,
                leave.end_date,
              )}`
            : "Detail izin"}
        </DialogTitle>
        <DialogDescription>Status, bukti, dan catatan pemroses.</DialogDescription>
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
              [
                "Status",
                <Status key="status" status={labelOf(LEAVE_STATUS_LABEL, leave.status)} />,
              ],
              [
                "Tanggal",
                `${formatDate(leave.start_date)} - ${formatDate(leave.end_date)} (${
                  leave.working_days
                } hari kerja)`,
              ],
              ["Alasan", leave.reason],
              ["Bukti", <EvidenceLink key="evidence" url={leave.evidence_url} />],
              [
                "Diajukan",
                `${formatShortTime(leave.submitted_at)}${
                  leave.submitted_late ? " · Diajukan setelah tanggal izin" : ""
                }`,
              ],
              [
                "Diproses oleh",
                leave.decided_by
                  ? `${leave.decided_by.name} (${
                      leave.decided_by.role === "admin" ? "admin" : "mentor"
                    })`
                  : "-",
              ],
              ["Catatan", leave.decision_note ?? "-"],
            ]}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

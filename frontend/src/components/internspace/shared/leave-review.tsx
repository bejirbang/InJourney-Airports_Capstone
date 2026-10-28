import { useSearch } from "@tanstack/react-router";
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
import { useAuth } from "@/lib/auth";
import { LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL, labelOf } from "@/lib/labels";
import { formatDate, formatDateTime, formatRange } from "@/lib/mock-rules";
import type { ApiLeaveType } from "@/lib/endpoints/intern";
import type { ReviewerLeave } from "@/lib/endpoints/mentor";
import { type PageSearch } from "@/lib/search";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useApproveLeave,
  useRejectLeave,
  useReviewerLeaveDetail,
  useReviewerLeaveInterns,
  useReviewerLeaves,
  type ReviewerRole,
} from "@/components/internspace/shared/leave-review-data";
import {
  DetailList,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Mentor dan Admin (design-mentor.md Alur 6, design-admin.md Alur 5) ----------

type Tab = "pending" | "all";

const errorMessage = (error: unknown, fallback: string | undefined = undefined) =>
  error instanceof ApiError ? error.message : fallback;

export function ReviewerLeave() {
  const auth = useAuth();
  const role: ReviewerRole | null =
    auth.user?.role === "admin" ? "admin" : auth.user?.role === "mentor" ? "mentor" : null;

  // Hook data di bawah baru boleh dipanggil setelah role pasti, jadi isinya
  // dipisah ke komponen sendiri agar urutan hook selalu sama.
  if (role === null) return <LoadingState />;
  return <ReviewerLeaveContent role={role} />;
}

function ReviewerLeaveContent({ role }: { role: ReviewerRole }) {
  const isAdmin = role === "admin";
  const search = useSearch({ strict: false }) as PageSearch;
  const [tab, setTab] = useState<Tab>(search.tab === "all" ? "all" : "pending");
  const [type, setType] = useState<"" | ApiLeaveType>("");
  const [internId, setInternId] = useState("");
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const airportId =
    search.airport_id !== undefined && /^\d+$/.test(search.airport_id)
      ? Number(search.airport_id)
      : null;

  useEffect(() => {
    if (search.tab === "all" || search.tab === "pending") setTab(search.tab);
  }, [search.tab]);

  useEffect(() => {
    if (search.open === undefined) return;
    const numeric = Number(search.open);
    if (Number.isInteger(numeric) && numeric > 0) setOpenId(numeric);
  }, [search.open]);

  const mentorInterns = useReviewerLeaveInterns(role);
  const params = {
    tab,
    ...(type === "" ? {} : { type }),
    ...(internId === "" ? {} : { intern_id: Number(internId) }),
    ...(isAdmin && airportId !== null ? { airport_id: airportId } : {}),
    ...(isAdmin && quotaExhausted ? { quota_exhausted: true } : {}),
  };
  const list = useReviewerLeaves(role, params);
  const internOptions = isAdmin ? (list.data?.interns ?? []) : mentorInterns;
  const pendingCount = list.data?.pendingCount ?? 0;
  const rows = list.data?.leaves ?? [];

  return (
    <>
      <PageHeading
        title="Izin"
        subtitle={
          isAdmin
            ? "Admin hanya memproses izin yang menunggu lebih dari batas eskalasi, dan hanya bila ada surat resmi atau bukti."
            : "Proses izin intern bimbingan. Mentor memproses lebih dulu."
        }
      />

      <div className="toolbar">
        <Tabs
          label="Daftar izin"
          value={tab}
          onChange={(next) => setTab(next)}
          items={[
            { value: "pending", label: `Pending (${pendingCount})` },
            { value: "all", label: "Semua" },
          ]}
        />
        <div className="toolbar-filters">
          {isAdmin && <AdminLeaveAirportFilter />}
          <select
            className="role-select"
            aria-label="Filter jenis"
            value={type}
            onChange={(event) => setType(event.target.value as "" | ApiLeaveType)}
          >
            <option value="">Jenis: Semua</option>
            <option value="sick">{LEAVE_TYPE_LABEL["sick"]}</option>
            <option value="urgent">{LEAVE_TYPE_LABEL["urgent"]}</option>
          </select>
          <select
            className="role-select"
            aria-label="Filter intern"
            value={internId}
            onChange={(event) => setInternId(event.target.value)}
          >
            <option value="">Intern: Semua</option>
            {internOptions.map((intern) => (
              <option key={intern.id} value={intern.id}>
                {intern.name}
              </option>
            ))}
          </select>
          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={quotaExhausted}
                onChange={(event) => setQuotaExhausted(event.target.checked)}
              />
              Kuota habis
            </label>
          )}
        </div>
      </div>

      <Panel
        title={tab === "pending" ? "Menunggu keputusan" : "Semua pengajuan"}
        subtitle={tab === "pending" ? "Diurutkan dari yang paling lama pending." : undefined}
      >
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <div className="px-5 pb-5">
            <ErrorState
              message={errorMessage(list.error, undefined)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <Empty>
            {tab === "pending" ? "Tidak ada izin yang menunggu." : "Belum ada pengajuan izin."}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  {isAdmin && <th>Mentor</th>}
                  <th>Jenis</th>
                  <th>Tanggal</th>
                  <th>Hari kerja</th>
                  <th>Bukti</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((leave) => (
                  <tr key={leave.id}>
                    <td>{leave.intern.name}</td>
                    {isAdmin && <td>{leave.mentor?.name ?? "-"}</td>}
                    <td>{labelOf(LEAVE_TYPE_LABEL, leave.type)}</td>
                    <td>
                      {formatRange(leave.start_date, leave.end_date)}
                      {leave.submitted_late && (
                        <div>
                          <Tag tone="light">Diajukan setelah tanggal izin</Tag>
                        </div>
                      )}
                    </td>
                    <td>{leave.working_days}</td>
                    <td>{leave.evidence_url ? "Ada" : "Tidak"}</td>
                    <td>
                      <Status status={labelOf(LEAVE_STATUS_LABEL, leave.status, leave.status)} />
                      {leave.status === "pending" && (
                        <div
                          className={`text-[10px] mt-1 ${
                            leave.is_overdue
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {leave.is_overdue
                            ? `! pending ${leave.pending_hours} jam`
                            : `diajukan ${leave.pending_hours} jam lalu`}
                        </div>
                      )}
                      {leave.decided_by?.role === "admin" && !isAdmin && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Diproses oleh admin
                        </div>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant={leave.status === "pending" ? "outline" : "ghost"}
                        onClick={() => setOpenId(leave.id)}
                      >
                        {leave.status === "pending" ? "Buka" : "Lihat"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <DecisionDialog
        role={role}
        id={openId === null ? null : String(openId)}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function AdminLeaveAirportFilter() {
  const filter = useAirportFilter();
  return (
    <AirportFilter
      value={filter.airportId}
      onChange={filter.setAirport}
      airports={filter.airports}
      disabled={filter.airportsLoading}
    />
  );
}

function DecisionDialog({
  role,
  id,
  onClose,
}: {
  role: ReviewerRole;
  id: string | null;
  onClose: () => void;
}) {
  const isAdmin = role === "admin";
  const detail = useReviewerLeaveDetail(role, id);
  const approve = useApproveLeave(role);
  const reject = useRejectLeave(role);
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote("");
    setChecked(false);
    setError(null);
  }, [id]);

  const leave: ReviewerLeave | undefined = detail.data;
  const pending = leave?.status === "pending";
  const canDecide = leave?.can_decide === true;
  const canApprove = !isAdmin || leave?.can_approve === true;
  const busy = approve.isPending || reject.isPending;

  const decide = (action: "approve" | "reject") => {
    if (!id || !leave) return;
    const numeric = Number(id);
    setError(null);

    if (note.trim() === "") {
      setError("Catatan wajib diisi.");
      return;
    }

    const options = {
      onSuccess: (result: { message: string }) => {
        toast.success(result.message);
        onClose();
      },
      onError: (mutationError: unknown) =>
        setError(errorMessage(mutationError, "Izin gagal diproses.") ?? null),
    };

    if (action === "approve") {
      approve.mutate(
        {
          id: numeric,
          note: note.trim(),
          ...(isAdmin ? { evidenceChecked: checked } : {}),
        },
        options,
      );
    } else {
      reject.mutate({ id: numeric, note: note.trim() }, options);
    }
  };

  return (
    <Dialog open={id !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <div className="flex justify-between items-start pr-6 gap-3">
          <DialogTitle>{leave ? `Izin - ${leave.intern.name}` : "Detail izin"}</DialogTitle>
          {leave && <Status status={labelOf(LEAVE_STATUS_LABEL, leave.status, leave.status)} />}
        </div>

        {detail.isLoading ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState
            message={errorMessage(detail.error, undefined)}
            onRetry={() => void detail.refetch()}
          />
        ) : leave ? (
          <>
            <DialogDescription>
              {isAdmin && `Mentor: ${leave.mentor?.name ?? "-"} · `}
              {labelOf(LEAVE_TYPE_LABEL, leave.type)} · {leave.working_days} hari kerja
            </DialogDescription>

            <DetailList
              items={[
                ["Tanggal", `${formatDate(leave.start_date)} - ${formatDate(leave.end_date)}`],
                ["Alasan", `"${leave.reason ?? "-"}"`],
                [
                  "Bukti",
                  leave.evidence_url ? (
                    <a
                      key="evidence"
                      className="text-action"
                      href={leave.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka bukti
                    </a>
                  ) : (
                    <Tag key="no-evidence" tone="orange">
                      Tanpa bukti
                    </Tag>
                  ),
                ],
                [
                  "Diajukan",
                  leave.submitted_at
                    ? `${formatDateTime(leave.submitted_at)} · ${leave.pending_hours} jam lalu${
                        leave.submitted_late ? " · Diajukan setelah tanggal izin" : ""
                      }`
                    : "-",
                ],
                ...(leave.quota
                  ? [
                      ["Sisa kuota izin", `${leave.quota.remaining} dari ${leave.quota.limit}`] as [
                        string,
                        string,
                      ],
                    ]
                  : []),
                ...(!pending
                  ? ([
                      [
                        "Diproses oleh",
                        leave.decided_by
                          ? `${leave.decided_by.name} (${
                              leave.decided_by.role === "admin" ? "admin" : "mentor"
                            })`
                          : "-",
                      ],
                      ["Catatan", leave.decision_note ?? "-"],
                      ["Diputuskan", leave.decided_at ? formatDateTime(leave.decided_at) : "-"],
                    ] as [string, string][])
                  : []),
              ]}
            />

            {!pending && (
              <p className="text-[11px] text-muted-foreground">
                {leave.status === "cancelled"
                  ? "Pengajuan ini sudah dibatalkan intern."
                  : "Keputusan sudah dibuat dan tidak dapat diubah."}
              </p>
            )}

            {pending && !canDecide && (
              <div className="banner muted">
                {isAdmin
                  ? "Izin ini belum lewat batas eskalasi. Tunggu mentor memproses lebih dulu."
                  : "Izin ini tidak dapat diputuskan oleh Anda saat ini."}
              </div>
            )}

            {pending && canDecide && (
              <div className="form-grid">
                {isAdmin && (
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!leave.evidence_url}
                      onChange={(event) => setChecked(event.target.checked)}
                    />
                    <span>Saya sudah memeriksa surat resmi atau bukti</span>
                  </label>
                )}
                <label className="form-field">
                  Catatan *
                  <textarea
                    className="!min-h-20"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <FormError text={error} />
                {isAdmin && !leave.evidence_url && (
                  <FormError text="Tidak ada surat resmi atau bukti. Admin hanya dapat menolak atau menunggu mentor." />
                )}
                <DialogFooter>
                  <Button variant="outline" disabled={busy} onClick={() => decide("reject")}>
                    Tolak
                  </Button>
                  <Button
                    disabled={busy || !canApprove || (isAdmin && !checked)}
                    title={
                      isAdmin && !leave.evidence_url
                        ? "Tidak ada surat resmi atau bukti."
                        : undefined
                    }
                    onClick={() => decide("approve")}
                  >
                    Setujui
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

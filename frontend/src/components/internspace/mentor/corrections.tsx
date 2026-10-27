import { useNavigate, useSearch } from "@tanstack/react-router";
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
import { formatDate, formatDateTime } from "@/lib/mock-rules";
import type { MentorCorrectionTab } from "@/lib/endpoints/mentor";
import { type PageSearch } from "@/lib/search";
import { useMentorInterns } from "@/components/internspace/mentor/interns-data";
import {
  useApproveCorrection,
  useMentorCorrectionDetail,
  useMentorCorrections,
  useRejectCorrection,
} from "@/components/internspace/mentor/corrections-data";
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

// ---------- Koreksi presensi mentor (design-mentor.md Alur 5) ----------

const TABS: MentorCorrectionTab[] = ["waiting", "all"];

const tabFromSearch = (tab: string | undefined): MentorCorrectionTab =>
  TABS.includes(tab as MentorCorrectionTab) ? (tab as MentorCorrectionTab) : "waiting";

const errorMessage = (error: unknown, fallback: string | undefined = undefined) =>
  error instanceof ApiError ? error.message : fallback;

const recordedLabel = (status: string, missedClockOut: boolean) => (
  <span className="flex flex-wrap items-center gap-2">
    <Status status={labelOf(ATTENDANCE_STATUS_LABEL, status, status)} />
    {missedClockOut && <Tag tone="orange">Lupa Clock Out</Tag>}
  </span>
);

export function MentorCorrections() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const [tab, setTab] = useState<MentorCorrectionTab>(tabFromSearch(search.tab));
  const [internId, setInternId] = useState("");
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);

  const interns = useMentorInterns("all", "");
  const list = useMentorCorrections(
    internId === "" ? { tab } : { tab, intern_id: Number(internId) },
  );

  const rows = list.data?.corrections ?? [];

  const open = (id: number) => {
    setOpenId(String(id));
    void navigate({ to: "/koreksi", search: { open: String(id), tab } });
  };

  const close = () => {
    setOpenId(null);
    void navigate({ to: "/koreksi", search: { tab } });
  };

  return (
    <>
      <PageHeading
        title="Koreksi Presensi"
        subtitle="ACC meneruskan ke admin; Tolak menyelesaikan pengajuan. Mentor tidak mengubah jam."
      />

      <Tabs
        label="Tab koreksi"
        value={tab}
        onChange={(next) => {
          setTab(next);
          void navigate({ to: "/koreksi", search: { tab: next } });
        }}
        items={[
          {
            value: "waiting",
            label: `Menunggu Saya (${list.data?.pendingCount ?? 0})`,
          },
          { value: "all", label: "Semua" },
        ]}
      />

      <div className="toolbar">
        <label className="form-field !mb-0">
          Intern
          <select
            aria-label="Filter intern"
            value={internId}
            onChange={(event) => setInternId(event.target.value)}
          >
            <option value="">Semua intern</option>
            {(interns.data?.interns ?? []).map((intern) => (
              <option key={intern.id} value={intern.id}>
                {intern.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Panel title="Daftar koreksi">
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
          <Empty>Tidak ada pengajuan koreksi pada tab ini.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Tanggal</th>
                  <th>Tercatat</th>
                  <th>Alasan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.intern.name}</td>
                    <td>{formatDate(row.date)}</td>
                    <td>{recordedLabel(row.recorded_status, row.recorded_missed_clock_out)}</td>
                    <td className="max-w-md truncate" title={row.reason}>
                      {row.reason}
                    </td>
                    <td>
                      <Status status={labelOf(CORRECTION_STATUS_LABEL, row.status, row.status)} />
                    </td>
                    <td>
                      <Button size="sm" variant="outline" onClick={() => open(row.id)}>
                        {row.can_decide ? "Buka" : "Lihat"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CorrectionDialog id={openId} onClose={close} />
    </>
  );
}

function CorrectionDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useMentorCorrectionDetail(id);
  const approve = useApproveCorrection();
  const reject = useRejectCorrection();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote("");
    setError(null);
  }, [id]);

  const decide = (action: "approve" | "reject") => {
    if (!id) return;
    const numeric = Number(id);
    setError(null);

    if (action === "reject" && note.trim() === "") {
      setError("Catatan wajib diisi.");
      return;
    }

    const options = {
      onSuccess: (result: { message: string }) => {
        toast.success(result.message);
        onClose();
      },
      onError: (mutationError: unknown) =>
        setError(errorMessage(mutationError, "Koreksi gagal diproses.") ?? null),
    };

    if (action === "approve") {
      approve.mutate({ id: numeric, note: note.trim() || null }, options);
    } else {
      reject.mutate({ id: numeric, note: note.trim() }, options);
    }
  };

  return (
    <Dialog open={id !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {detail.data
            ? `Koreksi ${detail.data.intern.name} · ${formatDate(detail.data.date)}`
            : "Detail koreksi"}
        </DialogTitle>
        <DialogDescription>
          Mentor hanya memvalidasi. Admin yang mengubah presensi setelah ACC.
        </DialogDescription>

        {detail.isLoading ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState
            message={errorMessage(detail.error, undefined)}
            onRetry={() => void detail.refetch()}
          />
        ) : detail.data ? (
          <>
            <DetailList
              items={[
                [
                  "Status",
                  <Status
                    key="status"
                    status={labelOf(
                      CORRECTION_STATUS_LABEL,
                      detail.data.status,
                      detail.data.status,
                    )}
                  />,
                ],
                [
                  "Tercatat",
                  recordedLabel(detail.data.recorded_status, detail.data.recorded_missed_clock_out),
                ],
                ...(detail.data.recorded
                  ? [
                      [
                        "Jam tercatat",
                        `${detail.data.recorded.clock_in_at ?? "-"} - ${
                          detail.data.recorded.clock_out_at ?? "-"
                        }`,
                      ] as [string, string],
                    ]
                  : []),
                ["Alasan", detail.data.reason],
                [
                  "Diajukan",
                  detail.data.submitted_at ? formatDateTime(detail.data.submitted_at) : "-",
                ],
                ...(detail.data.mentor_note
                  ? [["Catatan mentor", detail.data.mentor_note] as [string, string]]
                  : []),
                ...(detail.data.admin_note
                  ? [["Catatan admin", detail.data.admin_note] as [string, string]]
                  : []),
              ]}
            />

            {detail.data.can_decide && (
              <div className="grid gap-2">
                <label className="form-field">
                  Catatan (wajib bila menolak)
                  <textarea
                    className="!min-h-20"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <FormError text={error} />
              </div>
            )}

            {detail.data.can_decide && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => decide("reject")}
                  disabled={approve.isPending || reject.isPending}
                >
                  Tolak
                </Button>
                <Button
                  onClick={() => decide("approve")}
                  disabled={approve.isPending || reject.isPending}
                >
                  ACC
                </Button>
              </DialogFooter>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

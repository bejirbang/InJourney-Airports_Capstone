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
import { ATTENDANCE_STATUS_LABEL, LOGBOOK_STATUS_LABEL, labelOf } from "@/lib/labels";
import { formatDate, formatDateTime, formatShortTime } from "@/lib/mock-rules";
import type { MentorLogbookDetail, MentorLogbookTab } from "@/lib/endpoints/mentor";
import { type PageSearch } from "@/lib/search";
import { useMentorInterns } from "@/components/internspace/mentor/interns-data";
import {
  useApproveLogbook,
  useApproveLogbooks,
  useMentorLogbookDetail,
  useMentorLogbooks,
  useReviseLogbook,
} from "@/components/internspace/mentor/logbook-data";
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

// ---------- Review logbook mentor (design-mentor.md Alur 4) ----------

const TABS: MentorLogbookTab[] = ["pending_review", "revision", "all"];

const tabFromSearch = (tab: string | undefined): MentorLogbookTab =>
  TABS.includes(tab as MentorLogbookTab) ? (tab as MentorLogbookTab) : "pending_review";

const errorMessage = (error: unknown, fallback: string | undefined = undefined) =>
  error instanceof ApiError ? error.message : fallback;

export function MentorLogbookReview() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const [tab, setTab] = useState<MentorLogbookTab>(tabFromSearch(search.tab));
  const [internId, setInternId] = useState("");
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);
  const [selected, setSelected] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);

  const interns = useMentorInterns("all", "");
  const list = useMentorLogbooks(internId === "" ? { tab } : { tab, intern_id: Number(internId) });
  const bulk = useApproveLogbooks();

  useEffect(() => {
    setSelected([]);
    setSkipped([]);
  }, [tab, internId]);

  const open = (id: number) => {
    setOpenId(String(id));
    void navigate({ to: "/logbook", search: { open: String(id), tab } });
  };

  const close = () => {
    setOpenId(null);
    void navigate({ to: "/logbook", search: { tab } });
  };

  const toggle = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const approveSelected = () => {
    if (selected.length === 0) return;
    bulk.mutate(selected, {
      onSuccess: (result) => {
        toast.success(result.message);
        setSkipped(result.data.skipped);
        setSelected([]);
      },
      onError: (error) => toast.error(errorMessage(error, "Logbook gagal disetujui.") ?? "-"),
    });
  };

  const counts = list.data?.counts;
  const rows = list.data?.logbooks ?? [];

  return (
    <>
      <PageHeading title="Logbook" subtitle="Setujui atau minta revisi logbook intern bimbingan." />

      <Tabs
        label="Tab logbook"
        value={tab}
        onChange={(next) => {
          setTab(next);
          void navigate({ to: "/logbook", search: { tab: next } });
        }}
        items={[
          {
            value: "pending_review",
            label: `Menunggu Review (${counts?.pending_review ?? 0})`,
          },
          { value: "revision", label: `Revisi (${counts?.revision ?? 0})` },
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

      {skipped.length > 0 && (
        <div className="banner warn">
          Logbook yang dilewati karena sudah tidak menunggu review:{" "}
          {skipped.map((id) => `#${id}`).join(", ")}
        </div>
      )}

      <Panel title="Daftar logbook">
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
          <Empty>Tidak ada logbook pada tab ini.</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th aria-label="Pilih" />
                    <th>Intern</th>
                    <th>Tanggal</th>
                    <th>Ringkasan</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.status === "pending_review" ? (
                          <input
                            type="checkbox"
                            aria-label={`Pilih logbook ${row.intern.name} ${row.date}`}
                            checked={selected.includes(row.id)}
                            onChange={() => toggle(row.id)}
                          />
                        ) : null}
                      </td>
                      <td>{row.intern.name}</td>
                      <td>
                        {formatDate(row.date)}
                        {row.is_corrected && <Tag>Dikoreksi</Tag>}
                      </td>
                      <td className="max-w-md truncate" title={row.work}>
                        {row.work}
                      </td>
                      <td>
                        <Status status={labelOf(LOGBOOK_STATUS_LABEL, row.status, row.status)} />
                        {row.revision_count > 0 && (
                          <Tag tone="orange">{row.revision_count}x revisi</Tag>
                        )}
                      </td>
                      <td>
                        <Button size="sm" variant="outline" onClick={() => open(row.id)}>
                          Buka
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tab === "pending_review" && (
              <div className="flex justify-end px-5 py-4">
                <Button
                  onClick={approveSelected}
                  disabled={selected.length === 0 || bulk.isPending}
                >
                  Setujui yang dipilih ({selected.length})
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>

      <LogbookDialog id={openId} tab={tab} onOpen={open} onClose={close} />
    </>
  );
}

function LogbookDialog({
  id,
  tab,
  onOpen,
  onClose,
}: {
  id: string | null;
  tab: MentorLogbookTab;
  onOpen: (id: number) => void;
  onClose: () => void;
}) {
  const detail = useMentorLogbookDetail(id, tab);
  const approve = useApproveLogbook();
  const revise = useReviseLogbook();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComment("");
    setError(null);
  }, [id]);

  const act = (action: "approve" | "revise") => {
    if (!id) return;
    const numeric = Number(id);
    setError(null);

    if (action === "revise" && comment.trim() === "") {
      setError("Tulis komentar revisi.");
      return;
    }

    const options = {
      onSuccess: (result: { message: string; data: MentorLogbookDetail }) => {
        toast.success(result.message);
        setComment("");
        if (action === "approve" && result.data.next_id !== null) {
          onOpen(result.data.next_id);
        } else {
          onClose();
        }
      },
      onError: (mutationError: unknown) =>
        setError(errorMessage(mutationError, "Logbook gagal diproses.") ?? null),
    };

    if (action === "approve") {
      approve.mutate({ id: numeric, comment: comment.trim() || null }, options);
    } else {
      revise.mutate({ id: numeric, comment: comment.trim() }, options);
    }
  };

  return (
    <Dialog open={id !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {detail.data
            ? `Logbook · ${detail.data.intern.name} · ${formatDate(detail.data.date)}`
            : "Detail logbook"}
        </DialogTitle>
        <DialogDescription>
          Setujui atau minta revisi. Logbook yang disetujui terkunci.
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
            {detail.data.warning && <div className="banner warn">{detail.data.warning}</div>}
            <DetailList
              items={[
                [
                  "Status",
                  <Status
                    key="status"
                    status={labelOf(LOGBOOK_STATUS_LABEL, detail.data.status, detail.data.status)}
                  />,
                ],
                [
                  "Presensi",
                  detail.data.attendance
                    ? `${labelOf(
                        ATTENDANCE_STATUS_LABEL,
                        detail.data.attendance.status,
                        detail.data.attendance.status,
                      )} ${detail.data.attendance.clock_in_at ?? "-"} - ${
                        detail.data.attendance.clock_out_at ?? "-"
                      }`
                    : "-",
                ],
                ["Yang dikerjakan", detail.data.work],
                ["Kendala atau catatan", detail.data.notes || "-"],
                ...(detail.data.is_corrected
                  ? [["Catatan", "Diisi setelah koreksi presensi"] as [string, string]]
                  : []),
                [
                  "Dikirim",
                  detail.data.submitted_at ? formatDateTime(detail.data.submitted_at) : "-",
                ],
              ]}
            />

            <div>
              <h3>Riwayat review</h3>
              {detail.data.reviews.length === 0 ? (
                <p className="text-muted-foreground">Belum ada.</p>
              ) : (
                <ul className="grid gap-2">
                  {detail.data.reviews.map((review, index) => (
                    <li key={`${review.created_at ?? "review"}-${index}`}>
                      <strong>{review.action === "revision" ? "Minta Revisi" : "Disetujui"}</strong>
                      {review.mentor ? ` · ${review.mentor}` : ""}
                      {review.created_at ? ` · ${formatShortTime(review.created_at)}` : ""}
                      <p className="mt-1">{review.comment ?? "Tanpa komentar."}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(detail.data.can_approve || detail.data.can_request_revision) && (
              <div className="grid gap-2">
                <label className="form-field">
                  Komentar revisi
                  <textarea
                    className="!min-h-20"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Wajib diisi bila meminta revisi."
                  />
                </label>
                <FormError text={error} />
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => onOpen(detail.data.previous_id as number)}
                disabled={detail.data.previous_id === null}
              >
                &lt; Sebelumnya
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpen(detail.data.next_id as number)}
                disabled={detail.data.next_id === null}
              >
                Berikutnya &gt;
              </Button>
              {detail.data.can_request_revision && (
                <Button
                  variant="outline"
                  onClick={() => act("revise")}
                  disabled={revise.isPending || approve.isPending}
                >
                  Minta Revisi
                </Button>
              )}
              {detail.data.can_approve && (
                <Button
                  onClick={() => act("approve")}
                  disabled={approve.isPending || revise.isPending}
                >
                  Setujui
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

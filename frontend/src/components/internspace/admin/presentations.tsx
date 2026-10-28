import { useNavigate, useSearch } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
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
import { PRESENTATION_STATUS_LABEL, labelOf } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/mock-rules";
import type { AdminPresentationTab } from "@/lib/endpoints/admin";
import { type PageSearch } from "@/lib/search";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useAdminPresentation,
  useAdminPresentations,
  useDecidePresentation,
} from "@/components/internspace/admin/presentations-data";
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
} from "@/components/internspace/shared/ui";
import { errorText } from "@/components/internspace/admin/utils";

const TABS: { value: AdminPresentationTab; label: string }[] = [
  { value: "pending", label: "Menunggu" },
  { value: "revision", label: "Revisi" },
  { value: "approved", label: "Disetujui" },
  { value: "not_submitted", label: "Belum Kirim" },
];

// ---------- Presentasi akhir admin (design-admin.md Alur 7) ----------
export function AdminPresentations() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const filter = useAirportFilter();
  const tab: AdminPresentationTab =
    search.tab === "revision" || search.tab === "approved" || search.tab === "not_submitted"
      ? search.tab
      : "pending";
  const openId =
    search.open !== undefined && /^\d+$/.test(search.open) ? Number(search.open) : null;
  const list = useAdminPresentations(tab, filter.airportId);
  const detail = useAdminPresentation(openId);
  const decide = useDecidePresentation();
  const [revise, setRevise] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setTab = (value: AdminPresentationTab) =>
    navigate({ to: "/presentasi", search: { tab: value, airport_id: search.airport_id ?? "" } });
  const closeDetail = () =>
    navigate({ to: "/presentasi", search: { tab, airport_id: search.airport_id ?? "" } });

  return (
    <>
      <PageHeading
        title="Presentasi Akhir"
        subtitle="Periksa tautan presentasi sebelum menyetujui atau meminta revisi."
      />
      <div className="toolbar">
        <AirportFilter
          value={filter.airportId}
          onChange={filter.setAirport}
          airports={filter.airports}
          disabled={filter.airportsLoading}
        />
      </div>
      <Tabs
        label="Status presentasi"
        value={tab}
        onChange={(value) => setTab(value as AdminPresentationTab)}
        items={TABS.map((item) => ({
          ...item,
          label: `${item.label} (${list.data?.counts[item.value] ?? 0})`,
        }))}
      />

      {openId !== null ? (
        <Panel
          title="Detail presentasi"
          action={
            <Button size="sm" variant="outline" onClick={closeDetail}>
              Tutup
            </Button>
          }
        >
          {detail.isLoading ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : detail.data ? (
            <div className="grid gap-4 p-5">
              <div>
                <h2 className="text-lg font-semibold">{detail.data.intern.name}</h2>
                <Status status={labelOf(PRESENTATION_STATUS_LABEL, detail.data.status)} />
              </div>
              <DetailList
                items={[
                  ["Mentor", detail.data.mentor.name],
                  ["Bandara", detail.data.airport.name],
                  ["Akhir magang", formatDate(detail.data.end_date)],
                  ["Sisa hari", String(detail.data.days_left)],
                  [
                    "Dikirim",
                    detail.data.submitted_at ? formatDateTime(detail.data.submitted_at) : "-",
                  ],
                  ["Catatan keputusan", detail.data.decision_note ?? "-"],
                  ["Diputuskan oleh", detail.data.decided_by ?? "-"],
                ]}
              />
              {detail.data.evidence_url && (
                <a
                  className="text-action inline-flex items-center gap-1"
                  href={detail.data.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka tautan presentasi <ExternalLink size={12} />
                </a>
              )}
              {detail.data.can_decide && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => {
                      setNote("");
                      setError(null);
                      setRevise(true);
                    }}
                  >
                    Revisi
                  </Button>
                  <Button
                    disabled={decide.isPending}
                    onClick={() => {
                      if (openId === null) return;
                      decide.mutate(
                        { id: openId, decision: "approve" },
                        {
                          onSuccess: (body) => {
                            toast.success(body.message);
                            closeDetail();
                          },
                          onError: (cause) =>
                            toast.error(errorText(cause, "Presentasi gagal disetujui.")),
                        },
                      );
                    }}
                  >
                    Setujui
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Daftar presentasi">
          {list.isLoading ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (list.data?.rows ?? []).length === 0 ? (
            <Empty>Tidak ada data pada tab ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Mentor</th>
                    <th>Bandara</th>
                    <th>Akhir magang</th>
                    <th>Sisa hari</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.rows ?? []).map((row, index) => (
                    <tr key={row.id ?? `missing-${row.intern.id}-${index}`}>
                      <td className="font-semibold">{row.intern.name}</td>
                      <td>{row.mentor.name}</td>
                      <td>{row.airport.name}</td>
                      <td>{formatDate(row.end_date)}</td>
                      <td>{row.days_left}</td>
                      <td>
                        <Status status={labelOf(PRESENTATION_STATUS_LABEL, row.status)} />
                      </td>
                      <td>
                        <span className="flex gap-2">
                          {row.evidence_url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={row.evidence_url} target="_blank" rel="noreferrer">
                                <ExternalLink /> Link
                              </a>
                            </Button>
                          )}
                          {row.id !== null && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate({
                                  to: "/presentasi",
                                  search: {
                                    tab,
                                    open: String(row.id),
                                    airport_id: search.airport_id ?? "",
                                  },
                                })
                              }
                            >
                              Buka
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <Dialog open={revise} onOpenChange={(value) => !value && setRevise(false)}>
        <DialogContent>
          <DialogTitle>Minta revisi presentasi</DialogTitle>
          <DialogDescription>
            Catatan wajib diisi agar intern tahu bagian yang perlu diperbaiki.
          </DialogDescription>
          <label className="grid gap-1 text-sm">
            Catatan *
            <textarea
              className="min-h-24 rounded-md border px-3 py-2"
              maxLength={1000}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setError(null);
              }}
            />
          </label>
          <FormError text={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevise(false)}>
              Batal
            </Button>
            <Button
              disabled={decide.isPending}
              onClick={() => {
                if (openId === null) return;
                if (note.trim() === "") return setError("Catatan wajib diisi.");
                decide.mutate(
                  { id: openId, decision: "revise", note: note.trim() },
                  {
                    onSuccess: (body) => {
                      toast.success(body.message);
                      setRevise(false);
                      closeDetail();
                    },
                    onError: (cause) => setError(errorText(cause, "Revisi gagal dikirim.")),
                  },
                );
              }}
            >
              {decide.isPending ? "Mengirim..." : "Kirim revisi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

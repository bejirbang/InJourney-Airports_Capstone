import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ATTENDANCE_STATUS_LABEL,
  CORRECTION_STATUS_LABEL,
  MISSED_CLOCK_OUT_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatDate, formatDateTime, formatShort, formatShortTime } from "@/lib/utils";
import type { AdminCorrectionTab } from "@/lib/endpoints/admin";
import { type PageSearch } from "@/lib/search";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useAdminCorrection,
  useAdminCorrections,
  useDecideCorrection,
} from "@/components/internspace/admin/corrections-data";
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
import { errorText } from "@/components/internspace/admin/utils";

const TAB_LABEL: Record<AdminCorrectionTab, string> = {
  pending_admin: "Menunggu Admin",
  pending_mentor: "Menunggu Mentor",
  all: "Semua",
};

// ---------- Koreksi (design-admin.md Alur 4) ----------
export function CorrectionsPage() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const filter = useAirportFilter();
  const [internId, setInternId] = useState<number | null>(null);
  const tab: AdminCorrectionTab =
    search.tab === "pending_mentor" || search.tab === "all" ? search.tab : "pending_admin";
  const openId =
    search.open !== undefined && /^\d+$/.test(search.open) ? Number(search.open) : null;
  const list = useAdminCorrections({ tab, internId, airportId: filter.airportId });
  const detail = useAdminCorrection(openId);
  const decide = useDecideCorrection();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setTab = (value: AdminCorrectionTab) =>
    navigate({ to: "/koreksi", search: { tab: value, airport_id: search.airport_id ?? "" } });

  const closeDetail = () =>
    navigate({ to: "/koreksi", search: { tab, airport_id: search.airport_id ?? "" } });

  const submit = (decision: "approve" | "reject") => {
    if (openId === null) return;
    if (note.trim() === "") return setError("Catatan wajib diisi.");
    decide.mutate(
      { id: openId, decision, note: note.trim() },
      {
        onSuccess: (body) => {
          toast.success(body.message);
          setNote("");
          setError(null);
          closeDetail();
        },
        onError: (cause) => setError(errorText(cause, "Koreksi gagal diproses.")),
      },
    );
  };

  const counts = list.data;
  return (
    <>
      <PageHeading
        title="Koreksi Presensi"
        subtitle="Admin hanya memproses pengajuan yang sudah di-ACC mentor."
      />
      <div className="toolbar">
        <AirportFilter
          value={filter.airportId}
          onChange={filter.setAirport}
          airports={filter.airports}
          disabled={filter.airportsLoading}
        />
        <select
          className="role-select"
          aria-label="Filter intern"
          value={internId === null ? "" : String(internId)}
          onChange={(event) =>
            setInternId(event.target.value === "" ? null : Number(event.target.value))
          }
        >
          <option value="">Semua intern</option>
          {(counts?.interns ?? []).map((intern) => (
            <option value={intern.id} key={intern.id}>
              {intern.name}
            </option>
          ))}
        </select>
      </div>
      <Tabs
        label="Status koreksi"
        value={tab}
        onChange={(value) => setTab(value as AdminCorrectionTab)}
        items={[
          { value: "pending_admin", label: `Menunggu Admin (${counts?.pendingAdmin ?? 0})` },
          { value: "pending_mentor", label: `Menunggu Mentor (${counts?.pendingMentor ?? 0})` },
          { value: "all", label: "Semua" },
        ]}
      />

      {openId !== null ? (
        <Panel
          title="Detail koreksi"
          action={
            <Button variant="outline" size="sm" onClick={closeDetail}>
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
                <h2 className="text-lg font-semibold">
                  {detail.data.intern?.name ?? "Intern"} · {formatDate(detail.data.date)}
                </h2>
                <Status status={labelOf(CORRECTION_STATUS_LABEL, detail.data.status)} />
              </div>
              <DetailList
                items={[
                  [
                    "Status tercatat",
                    `${labelOf(ATTENDANCE_STATUS_LABEL, detail.data.recorded_status)}${
                      detail.data.recorded_missed_clock_out ? `, ${MISSED_CLOCK_OUT_LABEL}` : ""
                    }`,
                  ],
                  ["Clock in tercatat", detail.data.recorded?.clock_in_at ?? "-"],
                  ["Clock out tercatat", detail.data.recorded?.clock_out_at ?? "-"],
                  ["Alasan intern", detail.data.reason],
                  ["Mentor", detail.data.mentor?.name ?? "-"],
                  [
                    "ACC mentor",
                    detail.data.mentor_decided_at
                      ? formatDateTime(detail.data.mentor_decided_at)
                      : "-",
                  ],
                  ["Catatan mentor", detail.data.mentor_note ?? "-"],
                  [
                    "Diajukan",
                    detail.data.submitted_at ? formatDateTime(detail.data.submitted_at) : "-",
                  ],
                  [
                    "Hasil jika disetujui",
                    detail.data.result
                      ? `Clock in ${detail.data.result.clock_in_at} · Clock out ${detail.data.result.clock_out_at}`
                      : "-",
                  ],
                  ["Admin", detail.data.admin?.name ?? "-"],
                  ["Catatan admin", detail.data.admin_note ?? "-"],
                ]}
              />
              {detail.data.can_decide ? (
                <>
                  <label className="grid gap-1 text-sm">
                    Catatan admin *
                    <textarea
                      className="min-h-24 rounded-md border px-3 py-2"
                      maxLength={2000}
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        setError(null);
                      }}
                    />
                  </label>
                  <FormError text={error} />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={decide.isPending}
                      onClick={() => submit("reject")}
                    >
                      Tolak
                    </Button>
                    <Button disabled={decide.isPending} onClick={() => submit("approve")}>
                      {decide.isPending ? "Menyimpan..." : "Setujui"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="banner muted">
                  {detail.data.status === "pending_mentor"
                    ? "Menunggu keputusan mentor. Admin tidak bisa memproses dari tahap ini."
                    : "Data ini sudah diproses."}
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Daftar koreksi">
          {list.isLoading ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (list.data?.rows ?? []).length === 0 ? (
            <Empty>Tidak ada koreksi pada filter ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Tanggal</th>
                    <th>Kondisi</th>
                    <th>Mentor</th>
                    <th>ACC mentor</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.rows ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold">{row.intern?.name ?? "-"}</td>
                      <td>{formatShort(row.date, true)}</td>
                      <td>
                        {labelOf(ATTENDANCE_STATUS_LABEL, row.recorded_status)}
                        {row.recorded_missed_clock_out ? `, ${MISSED_CLOCK_OUT_LABEL}` : ""}
                      </td>
                      <td>{row.mentor?.name ?? "-"}</td>
                      <td>{row.mentor_decided_at ? formatDateTime(row.mentor_decided_at) : "-"}</td>
                      <td>
                        <Status status={labelOf(CORRECTION_STATUS_LABEL, row.status)} />
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate({
                              to: "/koreksi",
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

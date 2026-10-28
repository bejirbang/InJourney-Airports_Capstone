import { useNavigate, useSearch } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ASSESSMENT_STATUS_LABEL, PRESENTATION_STATUS_LABEL, labelOf } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { AdminAssessmentFilter } from "@/lib/endpoints/admin";
import { type PageSearch } from "@/lib/search";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useAdminAssessment,
  useAdminAssessments,
} from "@/components/internspace/admin/assessments-data";
import { useExportAssessmentPdf } from "@/components/internspace/admin/reports-data";
import { errorText } from "@/components/internspace/admin/utils";
import {
  DetailList,
  Empty,
  ErrorState,
  LoadingState,
  PageHeading,
  Panel,
  Status,
  Tabs,
} from "@/components/internspace/shared/ui";

const TABS: { value: AdminAssessmentFilter; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "ready", label: "Siap Dinilai" },
  { value: "blocked", label: "Terblokir" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Sudah Dinilai" },
];

// ---------- Penilaian admin (design-admin.md Alur 8) ----------
export function AdminAssessments() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const filter = useAirportFilter();
  const filterValue: AdminAssessmentFilter =
    search.tab === "ready" ||
    search.tab === "blocked" ||
    search.tab === "draft" ||
    search.tab === "submitted"
      ? search.tab
      : "";
  const openId =
    search.open !== undefined && /^\d+$/.test(search.open) ? Number(search.open) : null;
  const list = useAdminAssessments(filterValue, filter.airportId);
  const detail = useAdminAssessment(openId);
  const pdf = useExportAssessmentPdf();

  const setTab = (value: AdminAssessmentFilter) =>
    navigate({ to: "/penilaian", search: { tab: value, airport_id: search.airport_id ?? "" } });
  const closeDetail = () =>
    navigate({
      to: "/penilaian",
      search: { tab: filterValue, airport_id: search.airport_id ?? "" },
    });

  return (
    <>
      <PageHeading
        title="Penilaian"
        subtitle="Rekap penilaian akhir. Admin hanya membaca hasil yang disubmit mentor."
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
        label="Status penilaian"
        value={filterValue}
        onChange={(value) => setTab(value as AdminAssessmentFilter)}
        items={TABS.map((item) => ({
          value: item.value,
          label:
            item.value === ""
              ? item.label
              : `${item.label} (${list.data?.counts[item.value] ?? 0})`,
        }))}
      />

      {openId !== null ? (
        <Panel
          title="Detail penilaian"
          action={
            <div className="flex gap-2">
              {detail.data?.status === "submitted" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pdf.isPending}
                  onClick={() =>
                    pdf.mutate(
                      { intern_id: openId },
                      {
                        onSuccess: (filename) => toast.success(`Berkas diunduh: ${filename}`),
                        onError: (cause) =>
                          toast.error(errorText(cause, "PDF penilaian gagal diunduh.")),
                      },
                    )
                  }
                >
                  <Download /> Unduh PDF Penilaian
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={closeDetail}>
                Tutup
              </Button>
            </div>
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
                <Status status={labelOf(ASSESSMENT_STATUS_LABEL, detail.data.status)} />
              </div>
              <DetailList
                items={[
                  [
                    "Periode",
                    `${formatDate(detail.data.start_date)} – ${formatDate(detail.data.end_date)}`,
                  ],
                  [
                    "Presentasi",
                    detail.data.presentation_status
                      ? labelOf(PRESENTATION_STATUS_LABEL, detail.data.presentation_status)
                      : "-",
                  ],
                  ["Logbook belum disetujui", String(detail.data.unapproved_logbooks)],
                  [
                    "Nilai akhir",
                    detail.data.final_score === null ? "-" : String(detail.data.final_score),
                  ],
                  ["Predikat", detail.data.predicate ?? "-"],
                  ["Dinilai oleh", detail.data.assessed_by ?? "-"],
                  [
                    "Disubmit",
                    detail.data.submitted_at ? formatDateTime(detail.data.submitted_at) : "-",
                  ],
                  ["Catatan", detail.data.notes ?? "-"],
                ]}
              />
              {detail.data.blockers.length > 0 && (
                <div className="banner warn flex-col !items-start">
                  {detail.data.blockers.map((blocker) => (
                    <span key={blocker.code}>{blocker.text}</span>
                  ))}
                </div>
              )}
              {detail.data.indicators.length === 0 ? (
                <Empty>Belum ada indikator penilaian.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Indikator</th>
                        <th>Kategori</th>
                        <th>Bobot</th>
                        <th>Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.indicators.map((indicator) => (
                        <tr key={indicator.id}>
                          <td>{indicator.name}</td>
                          <td>{indicator.category ?? "-"}</td>
                          <td>{indicator.weight ?? "-"}</td>
                          <td>{indicator.score ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Daftar penilaian">
          {list.isLoading ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (list.data?.rows ?? []).length === 0 ? (
            <Empty>Tidak ada penilaian pada filter ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Mentor</th>
                    <th>Bandara</th>
                    <th>Presentasi</th>
                    <th>Logbook belum disetujui</th>
                    <th>Status</th>
                    <th>Nilai</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.rows ?? []).map((row) => (
                    <tr key={row.intern.id}>
                      <td className="font-semibold">{row.intern.name}</td>
                      <td>{row.mentor?.name ?? "-"}</td>
                      <td>{row.airport?.name ?? "-"}</td>
                      <td>
                        {row.presentation_status
                          ? labelOf(PRESENTATION_STATUS_LABEL, row.presentation_status)
                          : "-"}
                      </td>
                      <td>{row.unapproved_logbooks}</td>
                      <td>
                        <Status status={labelOf(ASSESSMENT_STATUS_LABEL, row.status)} />
                      </td>
                      <td>{row.final_score === null ? "-" : row.final_score}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate({
                              to: "/penilaian",
                              search: {
                                tab: filterValue,
                                open: String(row.intern.id),
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

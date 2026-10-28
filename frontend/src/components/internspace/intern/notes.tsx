import { ApiError } from "@/lib/api";
import { formatShortTime } from "@/lib/utils";
import type { ApiAssessment, ApiAssessmentIndicator } from "@/lib/endpoints/intern";
import { useAssessment, useWarnings } from "@/components/internspace/intern/notes-data";
import {
  Empty,
  ErrorState,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Catatan warning dan nilai akhir intern (design-intern.md Alur 11) ----------

/** Kelompokkan indikator per `category` dari server; urutan dipertahankan. */
function groupIndicators(indicators: ApiAssessmentIndicator[]) {
  const groups = new Map<string, ApiAssessmentIndicator[]>();
  for (const indicator of indicators) {
    const key = indicator.category ?? "Umum";
    const list = groups.get(key) ?? [];
    list.push(indicator);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function AssessmentPanel({ assessment }: { assessment: ApiAssessment }) {
  if (!assessment.available) {
    return (
      <Panel title="Nilai akhir">
        <p className="px-5 py-4 text-[11px] text-muted-foreground">{assessment.message}</p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Nilai akhir"
      subtitle={
        assessment.assessed_by
          ? `Dinilai oleh ${assessment.assessed_by}${
              assessment.submitted_at ? ` · ${formatShortTime(assessment.submitted_at)}` : ""
            }`
          : undefined
      }
      action={<Status status={assessment.predicate} />}
    >
      <div className="grid gap-4 px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Nilai akhir
            </span>
            <strong className="block text-3xl font-bold">{assessment.final_score}</strong>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Predikat
            </span>
            <p className="font-semibold">{assessment.predicate}</p>
          </div>
        </div>
        {assessment.notes && (
          <p className="text-[11px] text-muted-foreground">
            <strong>Catatan mentor:</strong> {assessment.notes}
          </p>
        )}
        {groupIndicators(assessment.indicators).map(([category, items]) => (
          <div key={category}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Indikator</th>
                    <th>Bobot</th>
                    <th>Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((indicator) => (
                    <tr key={indicator.id}>
                      <td>
                        <span className="font-medium">{indicator.name}</span>
                        {indicator.description && (
                          <small className="block text-muted-foreground">
                            {indicator.description}
                          </small>
                        )}
                      </td>
                      <td>{indicator.weight ?? "-"}</td>
                      <td>{indicator.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function InternNotes() {
  const warnings = useWarnings();
  const assessment = useAssessment();

  return (
    <>
      <PageHeading
        title="Catatan"
        subtitle="Catatan warning dari admin dan nilai akhir dari mentor. Hanya baca."
      />
      <div className="grid gap-5">
        <Panel title="Catatan dari Admin" subtitle="Ditulis berdasarkan diskusi admin dan mentor.">
          {warnings.isPending ? (
            <LoadingState />
          ) : warnings.isError ? (
            <ErrorState
              message={warnings.error instanceof ApiError ? warnings.error.message : undefined}
              onRetry={() => void warnings.refetch()}
            />
          ) : warnings.data.length === 0 ? (
            <Empty>Tidak ada catatan untuk Anda.</Empty>
          ) : (
            <div className="grid gap-0">
              {warnings.data.map((warning) => (
                <div key={warning.id} className="announcement">
                  <div>
                    <small>
                      {warning.created_at ? formatShortTime(warning.created_at) : "-"} ·{" "}
                      {warning.author ?? "Admin"}
                    </small>
                    <p>{warning.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {assessment.isPending ? (
          <Panel title="Nilai akhir">
            <LoadingState />
          </Panel>
        ) : assessment.isError ? (
          <Panel title="Nilai akhir">
            <div className="px-5 pb-5">
              <ErrorState
                message={
                  assessment.error instanceof ApiError ? assessment.error.message : undefined
                }
                onRetry={() => void assessment.refetch()}
              />
            </div>
          </Panel>
        ) : (
          assessment.data && <AssessmentPanel assessment={assessment.data} />
        )}
      </div>
    </>
  );
}

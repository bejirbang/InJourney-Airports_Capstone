import { useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  ASSESSMENT_STATUS_LABEL,
  LOGBOOK_STATUS_LABEL,
  PRESENTATION_STATUS_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatDate, formatDateTime, formatPeriod } from "@/lib/utils";
import type {
  MentorAssessmentDetail,
  MentorAssessmentIndicator,
  MentorAssessmentInput,
  MentorAssessmentRow,
} from "@/lib/endpoints/mentor";
import { type PageSearch } from "@/lib/search";
import {
  useMentorAssessmentDetail,
  useMentorAssessments,
  useSaveAssessment,
  useSubmitAssessment,
} from "@/components/internspace/mentor/assessments-data";
import {
  Confirm,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Status,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Input Nilai mentor (design-mentor.md Alur 9) ----------

const errorMessage = (error: unknown, fallback: string | undefined = undefined) =>
  error instanceof ApiError ? error.message : fallback;

const presentationLabel = (value: string | null | undefined) =>
  labelOf(PRESENTATION_STATUS_LABEL, value, "-");

export function MentorAssessments() {
  const search = useSearch({ strict: false }) as PageSearch;
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);

  useEffect(() => {
    if (search.open === undefined) return;
    const numeric = Number(search.open);
    if (Number.isInteger(numeric) && numeric > 0) setOpenId(search.open);
  }, [search.open]);

  if (openId !== null) {
    return <AssessmentForm id={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <>
      <PageHeading
        title="Input Nilai"
        subtitle="Nilai hanya bisa diisi setelah presentasi akhir disetujui dan semua logbook disetujui."
      />
      <AssessmentList onOpen={setOpenId} />
    </>
  );
}

function AssessmentList({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useMentorAssessments();

  return (
    <Panel title="Daftar intern">
      {list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(list.error, undefined)}
            onRetry={() => void list.refetch()}
          />
        </div>
      ) : !list.data || list.data.length === 0 ? (
        <Empty>Belum ada intern bimbingan untuk dinilai.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intern</th>
                <th>Selesai magang</th>
                <th>Presentasi</th>
                <th>Logbook</th>
                <th>Status</th>
                <th>Nilai</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <AssessmentRow key={row.intern.id} row={row} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function AssessmentRow({
  row,
  onOpen,
}: {
  row: MentorAssessmentRow;
  onOpen: (id: string) => void;
}) {
  return (
    <tr>
      <td>{row.intern.name}</td>
      <td>{row.end_date ? formatDate(row.end_date) : "-"}</td>
      <td>{presentationLabel(row.presentation_status)}</td>
      <td>
        {row.unapproved_logbooks === 0 ? "Semua ok" : `${row.unapproved_logbooks} belum disetujui`}
      </td>
      <td>
        <Status status={labelOf(ASSESSMENT_STATUS_LABEL, row.status, row.status)} />
        {row.blockers.length > 0 && (
          <div className="text-[10px] text-muted-foreground mt-1">
            {row.blockers.map((blocker) => blocker.text).join(" · ")}
          </div>
        )}
      </td>
      <td>{row.final_score ?? "-"}</td>
      <td>
        <Button size="sm" variant="outline" onClick={() => onOpen(String(row.intern.id))}>
          {row.can_assess ? "Nilai" : "Lihat"}
        </Button>
      </td>
    </tr>
  );
}

function AssessmentForm({ id, onBack }: { id: string; onBack: () => void }) {
  const detail = useMentorAssessmentDetail(id);
  const save = useSaveAssessment();
  const submit = useSubmitAssessment();
  const [scores, setScores] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const data = detail.data;

  useEffect(() => {
    if (!data) return;
    setScores(
      Object.fromEntries(
        data.indicators.map((indicator) => [
          indicator.id,
          indicator.score === null ? "" : String(indicator.score),
        ]),
      ),
    );
    setNotes(data.notes ?? "");
    setError(null);
  }, [data]);

  if (detail.isLoading) {
    return (
      <Panel title="Input Nilai">
        <LoadingState />
      </Panel>
    );
  }
  if (detail.isError) {
    return (
      <Panel title="Input Nilai">
        <div className="px-5 pb-5">
          <ErrorState
            message={errorMessage(detail.error, undefined)}
            onRetry={() => void detail.refetch()}
          />
          <Button variant="link" onClick={onBack}>
            <ArrowLeft /> Kembali
          </Button>
        </div>
      </Panel>
    );
  }
  if (!data) return null;

  const buildInput = (forSubmit: boolean): MentorAssessmentInput | string => {
    if (notes.length > 1000) return "Catatan maksimal 1000 karakter.";

    const values: { indicator_id: number; score: number | null }[] = [];
    for (const indicator of data.indicators) {
      const raw = scores[indicator.id] ?? "";
      if (raw.trim() === "") {
        if (forSubmit) return "Isi semua nilai sebelum submit.";
        values.push({ indicator_id: indicator.id, score: null });
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) return "Nilai harus berupa bilangan bulat.";
      if (!Number.isInteger(value)) return "Nilai harus berupa bilangan bulat.";
      if (value < 0 || value > 100) return "Nilai harus antara 0 dan 100.";
      values.push({ indicator_id: indicator.id, score: value });
    }

    return {
      scores: values,
      notes: notes.trim() === "" ? null : notes.trim(),
    };
  };

  const saveDraft = () => {
    const input = buildInput(false);
    if (typeof input === "string") {
      setError(input);
      return;
    }
    setError(null);
    save.mutate(
      { internId: Number(id), input },
      {
        onSuccess: (result) => toast.success(result.message),
        onError: (mutationError) =>
          setError(errorMessage(mutationError, "Nilai gagal disimpan.") ?? null),
      },
    );
  };

  const requestSubmit = () => {
    const input = buildInput(true);
    if (typeof input === "string") {
      setError(input);
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  const doSubmit = () => {
    const input = buildInput(true);
    if (typeof input === "string") {
      setError(input);
      setConfirmOpen(false);
      return;
    }
    submit.mutate(
      { internId: Number(id), input },
      {
        onSuccess: (result) => {
          toast.success(result.message);
          setConfirmOpen(false);
          onBack();
        },
        onError: (mutationError) => {
          setError(errorMessage(mutationError, "Nilai gagal disubmit.") ?? null);
          setConfirmOpen(false);
        },
      },
    );
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <Button variant="link" className="p-0 h-auto mb-2" onClick={onBack}>
            <ArrowLeft />
            Input Nilai
          </Button>
          <h1>Input Nilai</h1>
          <p className="flex flex-wrap gap-3 items-center">
            <strong>{data.intern.name}</strong>
            <span>Periode: {formatPeriod(data.start_date, data.end_date ?? "")}</span>
            <Status status={labelOf(ASSESSMENT_STATUS_LABEL, data.status, data.status)} />
          </p>
        </div>
      </div>

      <div className="info-line mb-4">
        <span>Presentasi: {presentationLabel(data.presentation_status)}</span>
        <span>Logbook belum disetujui: {data.unapproved_logbooks}</span>
        {data.final_score !== null && <span>Nilai akhir (server): {data.final_score}</span>}
        {data.predicate && <span>Predikat: {data.predicate}</span>}
      </div>

      {data.blockers.length > 0 && (
        <div className="banner warn mb-4">
          <div>
            <strong>Penilaian belum bisa dilakukan.</strong>
            <ul className="list-disc pl-5">
              {data.blockers.map((blocker) => (
                <li key={blocker.code}>{blocker.text}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {data.unapproved_logbook_days.length > 0 && (
        <Panel title="Logbook belum disetujui">
          <ul className="grid gap-1 px-5 py-4">
            {data.unapproved_logbook_days.map((day) => (
              <li key={day.date}>
                {formatDate(day.date)} · {labelOf(LOGBOOK_STATUS_LABEL, day.status, day.status)}{" "}
                {day.logbook_id === null ? (
                  <span className="text-muted-foreground">Belum ada logbook</span>
                ) : (
                  <a className="text-action" href={`/logbook?open=${day.logbook_id}`}>
                    Review logbook
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {data.can_edit ? (
        <Panel
          title="Formulir penilaian"
          subtitle="Nilai bulat 0-100. Nilai akhir dan predikat dihitung server."
        >
          <div className="grid gap-5 p-5">
            {groupIndicators(data.indicators).map(([category, indicators]) => (
              <section key={category} className="grid gap-2">
                <h3 className="section-title">{category}</h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Indikator</th>
                        <th className="w-32">Nilai (0-100)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.map((indicator, index) => (
                        <tr key={indicator.id}>
                          <td>
                            <strong>{indicator.name}</strong>
                            {indicator.description && (
                              <small className="block text-muted-foreground">
                                {indicator.description}
                              </small>
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`Nilai ${indicator.name}`}
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={scores[indicator.id] ?? ""}
                              onChange={(event) =>
                                setScores((current) => ({
                                  ...current,
                                  [indicator.id]: event.target.value,
                                }))
                              }
                              placeholder={String(index + 1)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            <div className="info-line">
              <span>Nilai akhir (server): {data.final_score ?? "-"}</span>
              <span>Predikat: {data.predicate ?? "-"}</span>
            </div>

            <label className="form-field">
              Catatan (opsional, maksimal 1000 karakter)
              <textarea
                className="!min-h-24"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <small className="text-muted-foreground">{notes.length}/1000</small>
            </label>

            <FormError text={error} />
            <p className="text-[11px] text-muted-foreground">
              Setelah submit nilai tidak bisa diubah.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={save.isPending || submit.isPending}
              >
                Simpan Draft
              </Button>
              <Button onClick={requestSubmit} disabled={save.isPending || submit.isPending}>
                Submit
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <ReadOnlyAssessment data={data} />
      )}

      <Confirm
        open={confirmOpen}
        title={`Submit penilaian ${data.intern.name}?`}
        confirmLabel="Submit Penilaian"
        onConfirm={doSubmit}
        onClose={() => setConfirmOpen(false)}
        disabled={submit.isPending}
      >
        <p>Nilai akan dikirim ke admin dan tidak bisa diubah.</p>
        <p className="font-semibold">Penilaian yang sudah disubmit tidak bisa diubah lagi.</p>
      </Confirm>
    </>
  );
}

function groupIndicators(
  indicators: MentorAssessmentIndicator[],
): [string, MentorAssessmentIndicator[]][] {
  const groups = new Map<string, MentorAssessmentIndicator[]>();
  for (const indicator of indicators) {
    const key = indicator.category ?? "Lainnya";
    const list = groups.get(key) ?? [];
    list.push(indicator);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function ReadOnlyAssessment({ data }: { data: MentorAssessmentDetail }) {
  return (
    <Panel title="Penilaian">
      <div className="grid gap-4 p-5">
        {data.status === "submitted" ? (
          <div className="info-line">
            <span>Nilai akhir: {data.final_score ?? "-"}</span>
            <span>Predikat: {data.predicate ?? "-"}</span>
            {data.submitted_at && <span>Disubmit: {formatDateTime(data.submitted_at)}</span>}
            {data.assessed_by && <span>Oleh: {data.assessed_by}</span>}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Penilaian belum bisa diisi sampai semua syarat terpenuhi.
          </p>
        )}

        {data.indicators.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Indikator</th>
                  <th>Bobot</th>
                  <th>Nilai</th>
                </tr>
              </thead>
              <tbody>
                {data.indicators.map((indicator) => (
                  <tr key={indicator.id}>
                    <td>{indicator.category ?? "-"}</td>
                    <td>{indicator.name}</td>
                    <td>{indicator.weight ?? "-"}</td>
                    <td>{indicator.score ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.notes && (
          <div>
            <h3>Catatan mentor</h3>
            <p>{data.notes}</p>
          </div>
        )}

        {data.status === "submitted" && <Tag tone="green">Penilaian terkunci</Tag>}
      </div>
    </Panel>
  );
}

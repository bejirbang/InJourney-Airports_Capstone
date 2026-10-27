import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { PRESENTATION_STATUS_LABEL, labelOf } from "@/lib/labels";
import { formatDate, formatShortTime } from "@/lib/mock-rules";
import {
  usePresentation,
  useSubmitPresentation,
} from "@/components/internspace/intern/presentation-data";
import {
  DetailList,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Presentasi akhir intern (design-intern.md Alur 10) ----------

const SUBMIT_LABEL = {
  not_submitted: "Kirim",
  pending: "Ganti Link",
  revision: "Kirim Ulang",
  not_open: "Kirim",
  approved: "Kirim",
} as const;

export function InternPresentation() {
  const query = usePresentation();
  const submit = useSubmitPresentation();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const data = query.data;

  // Isian mengikuti link terakhir yang tersimpan di server.
  useEffect(() => {
    setUrl(data?.evidence_url ?? "");
  }, [data?.evidence_url]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed === "") {
      setError("Isi link bukti presentasi.");
      return;
    }
    setError(null);
    submit.mutate(trimmed, {
      onSuccess: (result) => toast.success(result.message),
      onError: (err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Link bukti belum terkirim. Isian Anda tidak hilang, coba lagi.",
        ),
    });
  };

  return (
    <>
      <PageHeading
        title="Presentasi Akhir"
        subtitle="Kirim link Google Drive atau Google Docs berisi bukti presentasi di unit Anda."
      />
      <Panel
        title="Presentasi akhir"
        subtitle={
          data
            ? `Magang berakhir: ${formatDate(data.end_date)} · ${data.days_left} hari lagi`
            : undefined
        }
        action={
          data ? <Status status={labelOf(PRESENTATION_STATUS_LABEL, data.state)} /> : undefined
        }
      >
        <div className="grid gap-4 px-5 py-4">
          {query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState
              message={query.error instanceof ApiError ? query.error.message : undefined}
              onRetry={() => void query.refetch()}
            />
          ) : data ? (
            <>
              {data.state === "not_open" && (
                <p className="banner info">
                  {data.message ??
                    `Presentasi akhir dapat dikirim mulai ${formatDate(data.opens_on)}.`}
                </p>
              )}

              {data.state === "not_submitted" && (
                <p className="text-[11px] text-muted-foreground">
                  Lakukan presentasi di unit Anda, lalu kirim link bukti (foto bersama mentor,
                  materi, dan sebagainya).
                </p>
              )}

              {data.state === "pending" && (
                <p className="text-[11px] text-muted-foreground">
                  Bukti presentasi sudah dikirim. Menunggu verifikasi admin. Anda masih bisa
                  mengganti link selama belum diputuskan.
                </p>
              )}

              {data.state === "revision" && (
                <div className="banner warn">
                  <span>
                    <strong>Catatan admin</strong>
                    {data.decided_at ? ` · ${formatShortTime(data.decided_at)}` : ""}:{" "}
                    {data.decision_note ?? "Perbaiki link bukti presentasi."}
                  </span>
                </div>
              )}

              {data.state === "approved" ? (
                <div className="grid gap-3">
                  <p className="banner info">Presentasi akhir sudah disetujui.</p>
                  <DetailList
                    items={[
                      [
                        "Link bukti",
                        data.evidence_url ? (
                          <a
                            key="link"
                            href={data.evidence_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Buka link bukti
                          </a>
                        ) : (
                          "-"
                        ),
                      ],
                      ["Dikirim", data.submitted_at ? formatShortTime(data.submitted_at) : "-"],
                      ["Disetujui pada", data.decided_at ? formatShortTime(data.decided_at) : "-"],
                      ["Catatan admin", data.decision_note ?? "-"],
                    ]}
                  />
                </div>
              ) : (
                data.can_submit && (
                  <form className="form-grid" onSubmit={onSubmit}>
                    {data.evidence_url && data.state !== "not_submitted" && (
                      <p className="text-[11px] text-muted-foreground">
                        Link tersimpan:{" "}
                        <a
                          href={data.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Buka link bukti
                        </a>
                        {data.submitted_at
                          ? ` · dikirim ${formatShortTime(data.submitted_at)}`
                          : ""}
                      </p>
                    )}
                    <label className="form-field">
                      Link bukti *
                      <input
                        type="text"
                        placeholder="https://drive.google.com/..."
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          setError(null);
                        }}
                      />
                      <small className="text-muted-foreground">
                        Pastikan akses link dapat dilihat admin.
                      </small>
                    </label>
                    <FormError text={error} />
                    <div className="form-actions">
                      <Button type="submit" disabled={submit.isPending}>
                        {submit.isPending ? "Mengirim..." : SUBMIT_LABEL[data.state]}
                      </Button>
                    </div>
                  </form>
                )
              )}
            </>
          ) : null}
        </div>
      </Panel>
    </>
  );
}

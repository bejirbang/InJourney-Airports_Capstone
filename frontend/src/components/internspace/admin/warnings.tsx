import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { type PageSearch } from "@/lib/search";
import {
  useAdminWarningInterns,
  useAdminWarnings,
  useSaveWarning,
} from "@/components/internspace/admin/warnings-data";
import { errorText } from "@/components/internspace/admin/utils";
import {
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Warning (design-admin.md Alur 13) ----------
export function WarningsPage() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const internId =
    search.open !== undefined && /^\d+$/.test(search.open) ? Number(search.open) : null;
  const list = useAdminWarningInterns(query);
  const detail = useAdminWarnings(internId);
  const save = useSaveWarning();
  const [body, setBody] = useState("");
  const [editId, setEditId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBody("");
    setEditId(undefined);
    setError(null);
  }, [internId]);

  const close = () => navigate({ to: "/warning", search: {} });

  return (
    <>
      <PageHeading
        title="Warning"
        subtitle="Catatan dikirim sebagai notifikasi ke intern dan mentor. Tidak ada hapus catatan."
      />
      {internId === null ? (
        <>
          <div className="toolbar">
            <label className="search-field">
              <Search size={15} className="text-muted-foreground" />
              <input
                aria-label="Cari intern"
                placeholder="Cari nama intern"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <Panel title="Daftar intern">
            {list.isLoading ? (
              <LoadingState />
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => void list.refetch()} />
            ) : (list.data ?? []).length === 0 ? (
              <Empty>Tidak ada intern yang sesuai.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Jumlah warning</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(list.data ?? []).map((intern) => (
                      <tr key={intern.id}>
                        <td className="font-semibold">{intern.name}</td>
                        <td>{intern.warnings}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate({ to: "/warning", search: { open: String(intern.id) } })
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
        </>
      ) : (
        <>
          <div className="mb-3">
            <Button variant="link" className="h-auto p-0" onClick={close}>
              <ArrowLeft /> Warning
            </Button>
          </div>
          {detail.isLoading ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : detail.data ? (
            <>
              <Panel
                title="Ringkasan"
                subtitle={detail.data.mentor ? `Mentor: ${detail.data.mentor.name}` : undefined}
              >
                <div className="recap-grid three">
                  <div className="metric st-red">
                    <span>Terlambat bulan ini</span>
                    <strong>{detail.data.late_this_month}</strong>
                  </div>
                  <div className="metric st-blue">
                    <span>Kuota izin</span>
                    <strong>
                      {detail.data.leave_quota
                        ? `${detail.data.leave_quota.used} dari ${detail.data.leave_quota.limit}`
                        : "-"}
                    </strong>
                  </div>
                  <div className="metric st-light">
                    <span>Jumlah warning</span>
                    <strong>{detail.data.warnings.length}</strong>
                  </div>
                </div>
              </Panel>
              <Panel title="Catatan">
                <div className="grid gap-4 p-5">
                  {detail.data.warnings.length === 0 ? (
                    <Empty>Belum ada catatan.</Empty>
                  ) : (
                    detail.data.warnings.map((warning) => (
                      <div className="rounded-lg border p-4" key={warning.id}>
                        <p className="whitespace-pre-wrap">{warning.body}</p>
                        <small className="text-muted-foreground">
                          {warning.author?.name ?? "-"} ·{" "}
                          {warning.created_at ? formatDateTime(warning.created_at) : "-"}
                        </small>
                        {warning.can_edit && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditId(warning.id);
                                setBody(warning.body);
                                setError(null);
                              }}
                            >
                              Ubah
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <label className="grid gap-1 text-sm">
                    {editId === undefined ? "Tambah catatan" : "Ubah catatan"}
                    <textarea
                      className="min-h-24 rounded-md border px-3 py-2"
                      maxLength={2000}
                      value={body}
                      onChange={(event) => {
                        setBody(event.target.value);
                        setError(null);
                      }}
                    />
                  </label>
                  <FormError text={error} />
                  <div className="flex gap-2">
                    <Button
                      disabled={save.isPending}
                      onClick={() => {
                        if (body.trim() === "") return setError("Catatan wajib diisi.");
                        save.mutate(
                          { internId, warningId: editId, body: body.trim() },
                          {
                            onSuccess: (body) => {
                              toast.success(body.message);
                              setBody("");
                              setEditId(undefined);
                            },
                            onError: (cause) =>
                              setError(errorText(cause, "Catatan gagal disimpan.")),
                          },
                        );
                      }}
                    >
                      {save.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                    {editId !== undefined && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditId(undefined);
                          setBody("");
                          setError(null);
                        }}
                      >
                        Batal
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

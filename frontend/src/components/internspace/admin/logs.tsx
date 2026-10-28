import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { AdminAuditLogFilters } from "@/lib/endpoints/admin";
import {
  useAdminAuditLogOptions,
  useAdminAuditLogs,
} from "@/components/internspace/admin/logs-data";
import {
  Empty,
  ErrorState,
  LoadingState,
  PageHeading,
  Panel,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Log Aktivitas (design-admin.md Alur 14) ----------
export function LogsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adminId, setAdminId] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const options = useAdminAuditLogOptions();
  const filters: AdminAuditLogFilters = {
    ...(from === "" ? {} : { from }),
    ...(to === "" ? {} : { to }),
    ...(adminId === "" ? {} : { admin_id: Number(adminId) }),
    ...(action === "" ? {} : { action }),
    page,
  };
  const list = useAdminAuditLogs(filters);
  const meta = list.data?.meta;
  const rows = list.data?.rows ?? [];

  return (
    <>
      <PageHeading
        title="Log Aktivitas"
        subtitle="Jejak tindakan admin. Hanya baca, tidak dapat diubah atau dihapus siapa pun."
      />
      <div className="toolbar">
        <span className="flex flex-wrap items-center gap-1 text-[11px]">
          Tanggal
          <input
            className="role-select"
            type="date"
            aria-label="Dari tanggal"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          s/d
          <input
            className="role-select"
            type="date"
            aria-label="Sampai tanggal"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </span>
        <select
          className="role-select"
          aria-label="Filter admin"
          value={adminId}
          onChange={(event) => {
            setAdminId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Admin: Semua</option>
          {(options.data?.admins ?? []).map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>
        <select
          className="role-select"
          aria-label="Filter jenis aksi"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Jenis aksi: Semua</option>
          {(options.data?.actions ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <Panel
        title={
          meta === undefined
            ? "Log aktivitas"
            : `${meta.total} catatan${meta.last_page > 1 ? ` · halaman ${meta.current_page} dari ${meta.last_page}` : ""}`
        }
      >
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <Empty>Tidak ada aktivitas pada filter ini.</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Admin</th>
                    <th>Jenis</th>
                    <th>Objek</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {log.created_at ? formatDateTime(log.created_at) : "-"}
                      </td>
                      <td className="font-semibold">{log.admin.name}</td>
                      <td>
                        <Tag>{log.action}</Tag>
                      </td>
                      <td>{log.object}</td>
                      <td className="whitespace-normal">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && meta.last_page > 1 && (
              <div className="flex flex-wrap items-center justify-end gap-2 p-4">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm">
                  Halaman {meta.current_page} dari {meta.last_page}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= meta.last_page}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

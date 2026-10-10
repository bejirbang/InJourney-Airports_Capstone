import { useState } from "react";
import { formatShortTime } from "@/lib/mock-rules";
import { shortName, useMock } from "@/components/internspace/shared/model";
import { PageHeading, Panel, SimpleTable } from "@/components/internspace/shared/ui";

// ---------- Log Aktivitas (design-admin.md Alur 11) ----------
export function LogsPage() {
  const m = useMock();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [admin, setAdmin] = useState("Semua");
  const [action, setAction] = useState("Semua");
  const admins = [...new Set(m.logs.map((l) => l.admin))];
  const actions = [...new Set(m.logs.map((l) => l.action))];
  const list = m.logs
    .filter((l) => (!from || l.time.slice(0, 10) >= from) && (!to || l.time.slice(0, 10) <= to))
    .filter((l) => admin === "Semua" || l.admin === admin)
    .filter((l) => action === "Semua" || l.action === action)
    .sort((a, b) => b.time.localeCompare(a.time));
  return (
    <>
      <PageHeading
        title="Log Aktivitas"
        subtitle="Jejak tindakan admin. Hanya baca, tidak dapat diubah atau dihapus siapa pun."
      />
      <div className="toolbar">
        <span className="flex items-center gap-1 text-[11px]">
          Tanggal
          <input
            className="role-select"
            type="date"
            aria-label="Dari tanggal"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          s/d
          <input
            className="role-select"
            type="date"
            aria-label="Sampai tanggal"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </span>
        <div className="flex gap-2">
          <select
            className="role-select"
            aria-label="Filter admin"
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
          >
            <option value="Semua">Admin: Semua</option>
            {admins.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            className="role-select"
            aria-label="Filter jenis aksi"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="Semua">Jenis aksi: Semua</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>
      <Panel title={`${list.length} catatan`}>
        <SimpleTable
          empty="Tidak ada aktivitas pada filter ini."
          head={["Waktu", "Admin", "Jenis", "Objek", "Detail"]}
          rows={list.map((l) => [
            formatShortTime(l.time),
            shortName(l.admin),
            l.action,
            l.object,
            <span key="d" className="whitespace-normal">
              {l.detail}
            </span>,
          ])}
        />
      </Panel>
    </>
  );
}

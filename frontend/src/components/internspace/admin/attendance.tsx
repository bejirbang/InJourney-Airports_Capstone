import { CalendarDays, Search } from "lucide-react";
import { useState } from "react";
import { TODAY, formatDateLong, formatMonth } from "@/lib/mock-rules";
import { DayDetail } from "@/components/internspace/shared/attendance-parts";
import { type Report, type Row, recap, useMock } from "@/components/internspace/shared/model";
import {
  Empty,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Admin ----------
export function AdminAttendance() {
  const m = useMock();
  const [tab, setTab] = useState<"harian" | "rekap">("harian");
  const [date, setDate] = useState(TODAY);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [mentor, setMentor] = useState("Semua");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Aktif");
  const [detail, setDetail] = useState<Row | null>(null);
  const interns = m.people
    .filter((p) => p.role === "Intern" && p.start)
    .filter((p) => mentor === "Semua" || p.mentor === mentor)
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const mentors = m.people.filter((p) => p.role === "Mentor");
  const daily = interns
    .map((p) => ({ p, row: m.rowsFor(p.name, date, date)[0] }))
    .filter((x): x is { p: (typeof interns)[number]; row: Row } => !!x.row);
  return (
    <>
      <PageHeading
        title="Absensi"
        subtitle="Data absensi seluruh intern dan rekap bulanan. Perubahan hanya lewat permintaan koreksi."
      />
      <Tabs
        label="Tampilan absensi"
        value={tab}
        onChange={setTab}
        items={[
          { value: "harian", label: "Harian" },
          { value: "rekap", label: "Rekap Bulanan" },
        ]}
      />
      <div className="toolbar">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="search-field">
            <Search size={15} className="text-muted-foreground" />
            <input
              aria-label="Cari intern"
              placeholder="Cari intern"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            className="role-select"
            aria-label="Filter mentor"
            value={mentor}
            onChange={(e) => setMentor(e.target.value)}
          >
            <option value="Semua">Semua mentor</option>
            {mentors.map((x) => (
              <option key={x.id}>{x.name}</option>
            ))}
          </select>
          {tab === "rekap" && (
            <select
              className="role-select"
              aria-label="Filter status akun"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>Aktif</option>
              <option>Nonaktif</option>
              <option>Semua</option>
            </select>
          )}
        </div>
        {tab === "harian" ? (
          <label className="date-chip">
            <CalendarDays size={14} />
            <input
              type="date"
              aria-label="Tanggal"
              value={date}
              max={TODAY}
              onChange={(e) => setDate(e.target.value || TODAY)}
            />
          </label>
        ) : (
          <MonthNav value={month} onChange={setMonth} min="2026-07" max={TODAY.slice(0, 7)} />
        )}
      </div>
      {tab === "harian" ? (
        <Panel
          title={formatDateLong(date)}
          subtitle={
            date === TODAY
              ? "Hari berjalan: yang belum clock in tampil Belum Clock In sampai 23:59."
              : "Status final."
          }
        >
          {daily.length === 0 ? (
            <Empty>Tidak ada intern dalam periode magang pada tanggal ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table clickable">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Mentor</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Status</th>
                    <th>Daily Report</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map(({ p, row }) => (
                    <tr
                      key={p.id}
                      onClick={() => setDetail(row)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setDetail(row)}
                    >
                      <td>{p.name}</td>
                      <td>{p.mentor}</td>
                      <td>{row.clockIn || "-"}</td>
                      <td>{row.clockOut || "-"}</td>
                      <td>
                        <span className="flex gap-2">
                          <Status status={row.status} />
                          {row.corrected && <Tag>Dikoreksi admin</Tag>}
                        </span>
                      </td>
                      <td>
                        {row.report ? (
                          <Status status="Terkirim" />
                        ) : row.status === "Libur" || row.status === "Izin" ? (
                          "-"
                        ) : (
                          <span className="text-muted-foreground">Belum ada laporan</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel
          title={`Rekap ${formatMonth(month)}`}
          subtitle="Sabtu, Minggu, dan hari libur tidak dihitung hari kerja."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Mentor</th>
                  <th>Hadir</th>
                  <th>Izin</th>
                  <th>Tidak Hadir</th>
                  <th>Lupa Clock Out</th>
                  <th>Hari kerja</th>
                  <th>Akun</th>
                </tr>
              </thead>
              <tbody>
                {interns
                  .filter((p) => status === "Semua" || (status === "Aktif") === m.isActive(p))
                  .map((p) => {
                    const r = recap(m.rowsFor(p.name, `${month}-01`, `${month}-31`));
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.mentor}</td>
                        <td>{r.hadir}</td>
                        <td>{r.izin}</td>
                        <td>{r.tidakHadir}</td>
                        <td>{r.lupa}</td>
                        <td>{r.hariKerja}</td>
                        <td>
                          <Status status={m.isActive(p) ? "Aktif" : "Nonaktif"} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <DayDetail row={detail} name={detail?.intern} onClose={() => setDetail(null)} />
      <p className="text-[11px] text-muted-foreground mt-3">
        Admin tidak mengubah absensi langsung. Perubahan hanya lewat menu Koreksi.
      </p>
    </>
  );
}

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ATTENDANCE_STATUS_LABEL,
  CORRECTED_LABEL,
  LEAVE_TYPE_LABEL,
  MISSED_CLOCK_OUT_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatDate, formatShortTime } from "@/lib/utils";
import { AirportFilter, useAirportFilter } from "@/components/internspace/admin/airport-filter";
import {
  useAdminAttendanceDaily,
  useAdminAttendanceMonth,
} from "@/components/internspace/admin/attendance-data";
import {
  Empty,
  ErrorState,
  LoadingState,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";
import { todayIso } from "@/components/internspace/admin/utils";

type View = "month" | "day";

// ---------- Presensi admin (design-admin.md Alur 4) ----------
export function AdminAttendance() {
  const filter = useAirportFilter();
  const [view, setView] = useState<View>("month");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [date, setDate] = useState(todayIso());
  const monthly = useAdminAttendanceMonth({ month, airportId: filter.airportId, q });
  const daily = useAdminAttendanceDaily({ date, airportId: filter.airportId, q });

  return (
    <>
      <PageHeading
        title="Presensi"
        subtitle="Rekap kehadiran semua intern per bandara. Status dan angka berasal dari server."
      />
      <div className="toolbar">
        <AirportFilter
          value={filter.airportId}
          onChange={filter.setAirport}
          airports={filter.airports}
          disabled={filter.airportsLoading}
        />
        <label className="search-field">
          <input
            aria-label="Cari intern"
            placeholder="Cari nama intern"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        {view === "month" ? (
          monthly.data?.selectable_months ? (
            <MonthNav
              value={month}
              onChange={setMonth}
              min={monthly.data.selectable_months.first}
              max={monthly.data.selectable_months.last}
            />
          ) : null
        ) : (
          <label className="inline-flex items-center gap-2 text-sm">
            Tanggal
            <input
              type="date"
              className="role-select"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        )}
      </div>
      <Tabs
        label="Tampilan presensi"
        value={view}
        onChange={setView}
        items={[
          { value: "month", label: "Rekap Bulanan" },
          { value: "day", label: "Presensi Harian" },
        ]}
      />

      {view === "month" ? (
        <Panel title="Rekap bulanan">
          {monthly.isLoading ? (
            <LoadingState />
          ) : monthly.isError ? (
            <ErrorState error={monthly.error} onRetry={() => void monthly.refetch()} />
          ) : (monthly.data?.interns ?? []).length === 0 ? (
            <Empty>Tidak ada intern pada bulan dan filter ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Bandara</th>
                    <th>Mentor</th>
                    <th>Hadir</th>
                    <th>Terlambat</th>
                    <th>Lupa Clock In</th>
                    <th>Izin</th>
                    <th>Tidak Hadir</th>
                    <th>Lupa Clock Out</th>
                    <th>Hari kerja</th>
                    <th>Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.data?.interns.map((row) => (
                    <tr key={row.intern.id}>
                      <td>
                        <Link
                          to="/users"
                          search={{ open: String(row.intern.id), tab: "attendance" }}
                          className="font-semibold hover:underline"
                        >
                          {row.intern.name}
                        </Link>
                      </td>
                      <td>{row.airport?.name ?? "-"}</td>
                      <td>{row.mentor?.name ?? "-"}</td>
                      <td>{row.recap.present}</td>
                      <td>{row.recap.late}</td>
                      <td>{row.recap.missed_clock_in}</td>
                      <td>{row.recap.leave}</td>
                      <td>{row.recap.absent}</td>
                      <td>{row.recap.missed_clock_out}</td>
                      <td>{row.recap.working_days}</td>
                      <td>{row.attendance_rate === null ? "-" : `${row.attendance_rate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel title={`Presensi harian ${daily.data ? formatDate(daily.data.date) : ""}`}>
          {daily.isLoading ? (
            <LoadingState />
          ) : daily.isError ? (
            <ErrorState error={daily.error} onRetry={() => void daily.refetch()} />
          ) : (daily.data?.interns ?? []).length === 0 ? (
            <Empty>Tidak ada intern pada tanggal dan filter ini.</Empty>
          ) : (
            <>
              <div className="recap-strip">
                {Object.entries(daily.data?.counts ?? {}).map(([key, value]) => (
                  <span key={key}>
                    {labelOf(ATTENDANCE_STATUS_LABEL, key)} <strong>{value}</strong>
                  </span>
                ))}
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Intern</th>
                      <th>Bandara</th>
                      <th>Status</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Keterangan</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.data?.interns.map((row) => (
                      <tr key={row.intern.id}>
                        <td className="font-semibold">{row.intern.name}</td>
                        <td>{row.airport?.name ?? "-"}</td>
                        <td>
                          <Status status={labelOf(ATTENDANCE_STATUS_LABEL, row.status)} />
                        </td>
                        <td>{row.clock_in_at ? formatShortTime(row.clock_in_at) : "-"}</td>
                        <td>{row.clock_out_at ? formatShortTime(row.clock_out_at) : "-"}</td>
                        <td>
                          <span className="flex flex-wrap gap-2">
                            {row.leave_type && (
                              <Tag>{labelOf(LEAVE_TYPE_LABEL, row.leave_type)}</Tag>
                            )}
                            {row.missed_clock_out && <Tag>{MISSED_CLOCK_OUT_LABEL}</Tag>}
                            {row.is_corrected && <Tag>{CORRECTED_LABEL}</Tag>}
                            {row.late_minutes !== null && <Tag>{row.late_minutes} menit</Tag>}
                          </span>
                        </td>
                        <td>
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to="/users"
                              search={{ open: String(row.intern.id), tab: "attendance" }}
                            >
                              Buka
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      )}
    </>
  );
}

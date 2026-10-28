import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { TODAY, addMonths, formatDate, formatMonth, formatPercent } from "@/lib/utils";
import type { MentorPerformanceDates, MentorPerformanceIntern } from "@/lib/endpoints/mentor";
import { useMentorPerformance } from "@/components/internspace/mentor/performance-data";
import { useMentorInterns } from "@/components/internspace/mentor/interns-data";
import {
  Empty,
  ErrorState,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Performa Intern (design-mentor.md Alur 8) ----------

type DateDialog = { title: string; dates: string[] };

const monthsBetween = (first: string, last: string) => {
  const months: string[] = [];
  let current = first;
  while (current <= last && months.length < 60) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
};

function DateButton({
  value,
  title,
  dates,
  onOpen,
}: {
  value: string | number;
  title: string;
  dates: string[];
  onOpen: (dialog: DateDialog) => void;
}) {
  return (
    <button type="button" className="text-action" onClick={() => onOpen({ title, dates })}>
      {value}
    </button>
  );
}

function KpiCell({
  value,
  dates,
  title,
  onOpen,
}: {
  value: string;
  dates: string[];
  title: string;
  onOpen: (dialog: DateDialog) => void;
}) {
  return <DateButton value={value} title={title} dates={dates} onOpen={onOpen} />;
}

export function PerformancePage() {
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [internId, setInternId] = useState("");
  const [dates, setDates] = useState<DateDialog | null>(null);

  const interns = useMentorInterns("all", "");
  const performance = useMentorPerformance(month, internId === "" ? undefined : Number(internId));
  const data = performance.data;
  const bounds = data?.selectable_months;

  useEffect(() => {
    if (!bounds) return;
    if (month < bounds.first || month > bounds.last) setMonth(bounds.last);
  }, [bounds, month]);

  const months = bounds
    ? monthsBetween(bounds.first, bounds.last)
    : [0, -1, -2, -3].map((offset) => addMonths(TODAY.slice(0, 7), offset));

  return (
    <>
      <PageHeading
        title="Performa Intern"
        subtitle="Rekap kehadiran dan KPI intern bimbingan. Tidak ada penilaian atau export."
      />
      <div className="toolbar">
        <select
          className="role-select"
          aria-label="Periode"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          {months.map((value) => (
            <option key={value} value={value}>
              Periode: {formatMonth(value)}
            </option>
          ))}
        </select>
        <select
          className="role-select"
          aria-label="Intern"
          value={internId}
          onChange={(event) => setInternId(event.target.value)}
        >
          <option value="">Semua intern saya</option>
          {(interns.data?.interns ?? []).map((intern) => (
            <option key={intern.id} value={intern.id}>
              {intern.name}
            </option>
          ))}
        </select>
      </div>

      {performance.isLoading ? (
        <Panel title="Performa">
          <LoadingState />
        </Panel>
      ) : performance.isError ? (
        <Panel title="Performa">
          <div className="px-5 pb-5">
            <ErrorState
              message={
                performance.error instanceof ApiError ? performance.error.message : undefined
              }
              onRetry={() => void performance.refetch()}
            />
          </div>
        </Panel>
      ) : !data || data.interns_total === 0 ? (
        <Empty>Belum ada data. Hubungi admin untuk penugasan intern.</Empty>
      ) : data.interns.length === 0 ? (
        <Empty>Belum ada data pada periode ini.</Empty>
      ) : (
        <div className="grid gap-5">
          <div className="stats-grid !grid-cols-3">
            {(
              [
                ["Kehadiran", data.summary.attendance_rate],
                ["Tepat waktu", data.summary.on_time_rate],
                ["Logbook disetujui", data.summary.logbook_approved_rate],
              ] as [string, number | null][]
            ).map(([label, value]) => (
              <section className="stat" key={label}>
                <div className="stat-top">{label}</div>
                <div className="stat-value">
                  {value === null ? "Data belum cukup" : formatPercent(value)}
                </div>
                <div className="stat-foot">Rata-rata intern dengan data cukup</div>
              </section>
            ))}
          </div>

          <Panel
            title="Rekap kehadiran"
            subtitle="Sabtu, Minggu, dan hari libur tidak dihitung. Klik angka untuk melihat tanggal."
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Hadir</th>
                    <th>Terlambat</th>
                    <th>Lupa Clock In</th>
                    <th>Lupa Clock Out</th>
                    <th>Izin</th>
                    <th>Tidak Hadir</th>
                    <th>Hari kerja</th>
                  </tr>
                </thead>
                <tbody>
                  {data.interns.map((row) => (
                    <RecapRow key={row.intern.id} row={row} onOpen={setDates} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="KPI per intern"
            subtitle="KPI hanya untuk pemantauan dan bukan nilai intern."
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Kehadiran</th>
                    <th>Tepat waktu</th>
                    <th>Logbook disetujui</th>
                    <th>Revisi logbook</th>
                  </tr>
                </thead>
                <tbody>
                  {data.interns.map((row) => (
                    <KpiRow key={row.intern.id} row={row} onOpen={setDates} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 text-[11px] text-muted-foreground grid gap-1">
              <span>Kehadiran = (Hadir + Terlambat + Lupa Clock In) / (hari kerja - Izin).</span>
              <span>Tepat waktu = Hadir / (Hadir + Terlambat).</span>
              <span>
                Logbook disetujui = logbook disetujui / hari wajib berlogbook. Angka diambil dari
                server.
              </span>
            </div>
          </Panel>
        </div>
      )}

      <Dialog open={dates !== null} onOpenChange={(open) => !open && setDates(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>{dates?.title}</DialogTitle>
          <DialogDescription>Daftar tanggal dari server.</DialogDescription>
          {dates && dates.dates.length === 0 ? (
            <Empty>Tidak ada tanggal.</Empty>
          ) : (
            <ul className="grid gap-1">
              {dates?.dates.map((date) => (
                <li key={date}>{formatDate(date)}</li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InternName({ row }: { row: MentorPerformanceIntern }) {
  return (
    <td>
      {row.intern.name} {!row.is_active && <Status status="Nonaktif" />}
    </td>
  );
}

function RecapRow({
  row,
  onOpen,
}: {
  row: MentorPerformanceIntern;
  onOpen: (dialog: DateDialog) => void;
}) {
  const d: MentorPerformanceDates = row.dates;
  return (
    <tr>
      <InternName row={row} />
      <td>
        <DateButton
          value={row.recap.present}
          title={`Hadir · ${row.intern.name}`}
          dates={d.present}
          onOpen={onOpen}
        />
      </td>
      <td>
        <DateButton
          value={row.recap.late}
          title={`Terlambat · ${row.intern.name}`}
          dates={d.late}
          onOpen={onOpen}
        />
      </td>
      <td>
        <DateButton
          value={row.recap.missed_clock_in}
          title={`Lupa Clock In · ${row.intern.name}`}
          dates={d.missed_clock_in}
          onOpen={onOpen}
        />
      </td>
      <td>
        <DateButton
          value={row.recap.missed_clock_out}
          title={`Lupa Clock Out · ${row.intern.name}`}
          dates={d.missed_clock_out}
          onOpen={onOpen}
        />
      </td>
      <td>
        <DateButton
          value={row.recap.leave}
          title={`Izin · ${row.intern.name}`}
          dates={d.leave}
          onOpen={onOpen}
        />
      </td>
      <td>
        <DateButton
          value={row.recap.absent}
          title={`Tidak Hadir · ${row.intern.name}`}
          dates={d.absent}
          onOpen={onOpen}
        />
      </td>
      <td>{row.recap.working_days}</td>
    </tr>
  );
}

function KpiRow({
  row,
  onOpen,
}: {
  row: MentorPerformanceIntern;
  onOpen: (dialog: DateDialog) => void;
}) {
  if (!row.kpi.enough_data) {
    return (
      <tr>
        <InternName row={row} />
        <td colSpan={4} className="text-muted-foreground">
          Data belum cukup
        </td>
      </tr>
    );
  }

  const d = row.dates;
  const attended = [...d.present, ...d.late, ...d.missed_clock_in].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <tr>
      <InternName row={row} />
      <td>
        <KpiCell
          value={formatPercent(row.kpi.attendance_rate)}
          title={`Kehadiran · ${row.intern.name}`}
          dates={attended}
          onOpen={onOpen}
        />
      </td>
      <td>
        <KpiCell
          value={formatPercent(row.kpi.on_time_rate)}
          title={`Tepat waktu · ${row.intern.name}`}
          dates={d.present}
          onOpen={onOpen}
        />
      </td>
      <td>
        <KpiCell
          value={formatPercent(row.kpi.logbook_approved_rate)}
          title={`Logbook belum disetujui · ${row.intern.name}`}
          dates={d.logbook_not_approved}
          onOpen={onOpen}
        />
      </td>
      <td>
        <DateButton
          value={row.kpi.logbook_revisions}
          title={`Revisi logbook · ${row.intern.name}`}
          dates={d.logbook_revisions}
          onOpen={onOpen}
        />
      </td>
    </tr>
  );
}

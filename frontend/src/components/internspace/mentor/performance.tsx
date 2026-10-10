import { useState } from "react";
import {
  MIN_KPI_DAYS,
  TODAY,
  addMonths,
  attendanceRate,
  formatMonth,
  formatPercent,
  ratio,
  taskIsLate,
} from "@/lib/mock-rules";
import { ME, type Report, type Task, recap, useMock } from "@/components/internspace/shared/model";
import { Empty, PageHeading, Panel, Status } from "@/components/internspace/shared/ui";

// ---------- Performa Intern (design-mentor.md Alur 9) ----------
export function PerformancePage() {
  const m = useMock();
  const interns = m.internsOf(ME.Mentor);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [intern, setIntern] = useState("Semua");
  const months = [0, -1, -2, -3].map((n) => addMonths(TODAY.slice(0, 7), n));
  const data = interns
    .filter((p) => intern === "Semua" || p.name === intern)
    .map((p) => {
      const rows = m.rowsFor(p.name, `${month}-01`, `${month}-31`);
      const r = recap(rows);
      const due = m.tasks.filter((t) => t.intern === p.name && t.due.slice(0, 7) === month);
      const onTime = due.filter(
        (t) => t.status === "Done" && !!t.submittedAt && t.submittedAt <= t.due,
      ).length;
      return {
        p,
        r,
        enough: r.hariKerja >= MIN_KPI_DAYS,
        hadirRate: attendanceRate(r.hadir, r.hariKerja, r.izin),
        onTime,
        dueCount: due.length,
        onTimeRate: ratio(onTime, due.length),
        reportRate: ratio(r.laporan, r.hadir),
        revise: due.reduce((n, t) => n + t.revisions, 0),
        late: m.tasks.filter(
          (t) => t.intern === p.name && taskIsLate(t.due, t.status, t.submittedAt),
        ).length,
      };
    })
    .filter((d) => d.r.hariKerja > 0 || d.dueCount > 0);
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const enough = data.filter((d) => d.enough);
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
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.map((ym) => (
            <option key={ym} value={ym}>
              Periode: {formatMonth(ym)}
            </option>
          ))}
        </select>
        <select
          className="role-select"
          aria-label="Intern"
          value={intern}
          onChange={(e) => setIntern(e.target.value)}
        >
          <option value="Semua">Semua intern saya</option>
          {interns.map((p) => (
            <option key={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {interns.length === 0 ? (
        <Empty>Belum ada data. Hubungi admin untuk penugasan intern.</Empty>
      ) : data.length === 0 ? (
        <Empty>Belum ada data pada periode ini.</Empty>
      ) : (
        <div className="grid gap-5">
          <div className="stats-grid !grid-cols-3">
            {[
              ["Kehadiran", avg(enough.map((d) => d.hadirRate))],
              ["Task tepat waktu", avg(enough.map((d) => d.onTimeRate))],
              ["Daily Report", avg(enough.map((d) => d.reportRate))],
            ].map(([label, value]) => (
              <section className="stat" key={label as string}>
                <div className="stat-top">{label as string}</div>
                <div className="stat-value">{formatPercent(value as number | null)}</div>
                <div className="stat-foot">Rata-rata intern dengan data cukup</div>
              </section>
            ))}
          </div>
          <Panel title="Rekap kehadiran" subtitle="Sabtu, Minggu, dan hari libur tidak dihitung.">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Hadir</th>
                    <th>Izin</th>
                    <th>Tidak Hadir</th>
                    <th>Lupa Clock Out</th>
                    <th>Hari kerja</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.p.id}>
                      <td>
                        {d.p.name} {!m.isActive(d.p) && <Status status="Nonaktif" />}
                      </td>
                      <td>{d.r.hadir}</td>
                      <td>{d.r.izin}</td>
                      <td>{d.r.tidakHadir}</td>
                      <td>{d.r.lupa}</td>
                      <td>{d.r.hariKerja}</td>
                    </tr>
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
                    <th>Task tepat waktu</th>
                    <th>Daily Report</th>
                    <th>Task Revise</th>
                    <th>Task terlambat saat ini</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) =>
                    d.enough ? (
                      <tr key={d.p.id}>
                        <td>{d.p.name}</td>
                        <td>{formatPercent(d.hadirRate)}</td>
                        <td>
                          {formatPercent(d.onTimeRate)}{" "}
                          {d.dueCount > 0 && (
                            <span className="text-muted-foreground">
                              ({d.onTime}/{d.dueCount})
                            </span>
                          )}
                        </td>
                        <td>{formatPercent(d.reportRate)}</td>
                        <td>{d.revise}</td>
                        <td>{d.late}</td>
                      </tr>
                    ) : (
                      <tr key={d.p.id}>
                        <td>{d.p.name}</td>
                        <td colSpan={5} className="text-muted-foreground">
                          Data belum cukup
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 text-[11px] text-muted-foreground grid gap-1">
              <span>
                Kehadiran = Hadir / (hari kerja - Izin). Izin yang disetujui tidak dihitung sebagai
                ketidakhadiran.
              </span>
              <span>
                Task tepat waktu = Task Done yang dikumpulkan sebelum tenggat / Task bertenggat pada
                periode.
              </span>
              <span>
                Daily Report = hari Hadir dengan laporan / hari Hadir. Jumlah Revise hanya
                informasi.
              </span>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  MIN_KPI_DAYS,
  TODAY,
  addMonths,
  attendanceRate,
  endsWithin,
  formatDate,
  formatMonth,
  formatPercent,
  formatPeriod,
  formatRange,
  formatShort,
  hoursBetween,
  ratio,
  taskIsLate,
} from "@/lib/mock-rules";
import type { PageSearch } from "@/lib/search";
import { ME, recap, useMock, type Person, type Row } from "./model";
import { DetailList, Empty, MonthNav, PageHeading, Panel, Status, Tabs, Tag } from "./shared";
import { DayDetail, RecapStrip } from "./attendance";

// ---------- Intern Saya (design-mentor.md Alur 3) ----------

type Filter = "Aktif" | "Nonaktif" | "Pernah dibimbing" | "Semua";

export function MyInternsPage() {
  const m = useMock();
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("Aktif");
  const [query, setQuery] = useState("");
  const current = m.internsOf(ME.Mentor);
  const former = m.people.filter(
    (p) => p.role === "Intern" && p.formerMentors?.includes(ME.Mentor),
  );
  const list = (
    filter === "Pernah dibimbing"
      ? former
      : current.filter((p) => filter === "Semua" || (filter === "Aktif") === m.isActive(p))
  ).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const selected = [...current, ...former].find((p) => p.name === search.open);
  if (selected)
    return (
      <InternDetail
        person={selected}
        readOnlyFormer={!current.includes(selected)}
        onBack={() => void navigate({ to: "/intern-saya" })}
      />
    );
  return (
    <>
      <PageHeading
        title="Intern Saya"
        subtitle="Absensi dan Daily Report hanya dapat dilihat. Perubahan data intern dikelola admin."
      />
      <div className="toolbar">
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
          aria-label="Filter status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          {(["Aktif", "Nonaktif", "Pernah dibimbing", "Semua"] as const).map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <Panel title={`${list.length} intern`}>
        {current.length === 0 && former.length === 0 ? (
          <Empty>Belum ada intern bimbingan. Hubungi admin untuk penugasan.</Empty>
        ) : list.length === 0 ? (
          <Empty>Tidak ada intern pada filter ini.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Hari ini</th>
                  <th>Periode magang</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const active = m.isActive(p);
                  const ending = active && endsWithin(p.end, 7);
                  const days = Math.round(hoursBetween(`${TODAY}T00:00`, `${p.end}T00:00`) / 24);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="block text-muted-foreground">{p.title}</small>
                      </td>
                      <td>
                        {active && filter !== "Pernah dibimbing" ? (
                          <Status status={m.today(p.name).state} />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {p.start && formatPeriod(p.start, p.end)}
                        {ending && (
                          <div className="text-[10px] text-warning font-semibold">
                            ! berakhir {days} hari lagi
                          </div>
                        )}
                      </td>
                      <td>
                        <Status status={active ? "Aktif" : "Nonaktif"} />
                        {filter === "Pernah dibimbing" && <Tag tone="light">Pernah dibimbing</Tag>}
                      </td>
                      <td>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/intern-saya" search={{ open: p.name }}>
                            Buka
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

type DetailTab = "absensi" | "laporan" | "task" | "izin";

function InternDetail({
  person,
  readOnlyFormer,
  onBack,
}: {
  person: Person;
  readOnlyFormer: boolean;
  onBack: () => void;
}) {
  const m = useMock();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DetailTab>("absensi");
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [detail, setDetail] = useState<Row | null>(null);
  const [report, setReport] = useState<Row | null>(null);
  useEffect(() => setTab("absensi"), [person.name]);
  const rows = m.rowsFor(person.name, `${month}-01`, `${month}-31`);
  const working = rows.filter((r) => r.status !== "Libur");
  const active = m.isActive(person);
  const tasks = m.tasks.filter(
    (t) => t.intern === person.name && (!readOnlyFormer || t.mentor === ME.Mentor),
  );
  const leaves = m.leaves
    .filter((l) => l.intern === person.name)
    .sort((a, b) => b.submitted.localeCompare(a.submitted));
  const start = person.start ?? TODAY;
  return (
    <>
      <div className="page-heading">
        <div>
          <Button variant="link" className="p-0 h-auto mb-2" onClick={onBack}>
            <ArrowLeft />
            Intern Saya
          </Button>
          <h1>{person.name}</h1>
          <p className="flex flex-wrap gap-3 items-center">
            <Status status={active ? "Aktif" : "Nonaktif"} />
            <span>Periode: {person.start && formatPeriod(person.start, person.end)}</span>
            <span>{person.title}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void navigate({ to: "/chat", search: { to: person.name } })}
        >
          <MessageSquare />
          Chat dengan intern
        </Button>
      </div>
      {!active && (
        <div className="banner muted mb-4">
          Intern ini sudah nonaktif. Data hanya dapat dilihat.
        </div>
      )}
      {readOnlyFormer && (
        <div className="banner muted mb-4">
          Intern ini sekarang dibimbing {person.mentor}. Anda hanya dapat melihat riwayat.
        </div>
      )}
      <Tabs
        label="Detail intern"
        value={tab}
        onChange={setTab}
        items={[
          { value: "absensi", label: "Rekap Absensi" },
          { value: "laporan", label: "Daily Report" },
          { value: "task", label: "Task" },
          { value: "izin", label: "Izin" },
        ]}
      />
      {(tab === "absensi" || tab === "laporan") && (
        <Panel
          title={tab === "absensi" ? "Rekap Absensi" : "Daily Report"}
          subtitle="Hanya baca."
          action={
            <MonthNav
              value={month}
              onChange={setMonth}
              min={start.slice(0, 7)}
              max={TODAY.slice(0, 7)}
            />
          }
        >
          {tab === "absensi" && <RecapStrip r={recap(rows)} />}
          {working.length === 0 ? (
            <Empty>Belum ada data absensi pada bulan ini.</Empty>
          ) : tab === "absensi" ? (
            <div className="table-wrap">
              <table className="data-table clickable">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {working.map((r) => {
                    const leave = m.leaveOn(person.name, r.date);
                    return (
                      <tr key={r.date} onClick={() => setDetail(r)}>
                        <td>{formatDate(r.date)}</td>
                        <td>{r.clockIn || "-"}</td>
                        <td>{r.clockOut || "-"}</td>
                        <td>
                          <Status status={r.status} />
                        </td>
                        <td>
                          {r.corrected ? (
                            <Tag>Dikoreksi admin</Tag>
                          ) : r.status === "Izin" && leave ? (
                            leave.type
                          ) : (
                            ""
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table clickable">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Ringkasan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {working.map((r) => (
                    <tr key={r.date} onClick={() => r.report && setReport(r)}>
                      <td>{formatDate(r.date)}</td>
                      <td className="max-w-md truncate">
                        {r.report ? (
                          `"${r.report.work}"`
                        ) : r.status === "Hadir" ||
                          r.status === "Lupa Clock Out" ||
                          r.status === "Berjalan" ? (
                          <span className="text-muted-foreground">Belum ada laporan</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {r.report ? <Status status="Terkirim" /> : <Status status={r.status} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "laporan" && (
            <p className="px-5 py-3 text-[11px] text-muted-foreground">
              Klik baris untuk membaca laporan lengkap. Mentor tidak dapat mengedit atau
              mengomentari Daily Report.
            </p>
          )}
        </Panel>
      )}
      {tab === "task" && (
        <Panel
          title="Task"
          action={
            !readOnlyFormer && active ? (
              <Link className="text-action" to="/task">
                Ke halaman Task
              </Link>
            ) : undefined
          }
        >
          {tasks.length === 0 ? (
            <Empty>Belum ada Task untuk intern ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Judul</th>
                    <th>Status</th>
                    <th>Tenggat</th>
                    <th>Tanda</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>
                        <Status status={t.status} />
                      </td>
                      <td>{formatShort(t.due)}</td>
                      <td>
                        {taskIsLate(t.due, t.status, t.submittedAt) && (
                          <Status status="Terlambat" />
                        )}
                      </td>
                      <td>
                        {!readOnlyFormer && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/task" search={{ open: t.id }}>
                              Buka
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      {tab === "izin" && (
        <Panel title="Izin">
          {leaves.length === 0 ? (
            <Empty>Belum ada pengajuan izin.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>Tanggal</th>
                    <th>Status</th>
                    <th>Diproses oleh</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td>{l.type}</td>
                      <td>{formatRange(l.start, l.end)}</td>
                      <td>
                        <Status status={l.status} />
                      </td>
                      <td>{l.by ?? "-"}</td>
                      <td>
                        {!readOnlyFormer && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/izin" search={{ open: String(l.id) }}>
                              {l.status === "Pending" ? "Buka" : "Lihat"}
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <DayDetail row={detail} name={person.name} onClose={() => setDetail(null)} />
      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent>
          <DialogTitle>
            Daily Report · {person.name} · {report && formatDate(report.date)}
          </DialogTitle>
          <DialogDescription>Hanya baca.</DialogDescription>
          {report?.report && (
            <DetailList
              items={[
                ["Yang dikerjakan", report.report.work],
                ["Kendala atau catatan", report.report.notes || "-"],
                ["Dikirim", report.report.sentAt.slice(11, 16)],
              ]}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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

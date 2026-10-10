import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  TODAY,
  endsWithin,
  formatDate,
  formatPeriod,
  formatRange,
  formatShort,
  hoursBetween,
  taskIsLate,
} from "@/lib/mock-rules";
import { type PageSearch } from "@/lib/search";
import { DayDetail, RecapStrip } from "@/components/internspace/shared/attendance-parts";
import {
  ME,
  type Person,
  type Report,
  type Row,
  type Task,
  recap,
  useMock,
} from "@/components/internspace/shared/model";
import {
  DetailList,
  Empty,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

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

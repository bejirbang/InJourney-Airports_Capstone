import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CalendarOff, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TODAY,
  addDays,
  canExtend,
  endsWithin,
  formatDate,
  formatMonth,
  formatPeriod,
  formatShort,
  formatShortTime,
  isOverduePending,
  isWorkingDay,
  lateLabel,
  pendingHours,
  taskIsLate,
} from "@/lib/mock-rules";
import { ME, recap, shortName, useMock, type Person } from "./model";
import { Empty, FormError, PageHeading, Panel, Status } from "./shared";
import { TodayCard } from "./attendance";
import airport from "@/assets/airport-banner.jpg";

export function Dashboard() {
  const m = useMock();
  return (
    <>
      <PageHeading title="Dashboard" />
      <section className="welcome-banner compact">
        <img src={airport} width={1600} height={608} alt="Terminal dan apron bandara" />
        <div className="welcome-copy">
          <span className="eyebrow">INJOURNEY AIRPORTS · {m.role.toUpperCase()}</span>
          <h2>Selamat datang, {m.me.name.split(" ")[0]}</h2>
          <p>
            {m.role === "Intern"
              ? "Cek status hari ini dan Task yang perlu dikerjakan."
              : "Berikut hal yang perlu ditindak hari ini."}
          </p>
        </div>
      </section>
      {m.role === "Intern" ? (
        <InternDashboard />
      ) : m.role === "Mentor" ? (
        <MentorDashboard />
      ) : (
        <AdminDashboard />
      )}
    </>
  );
}

function HolidayBanner() {
  const m = useMock();
  if (isWorkingDay(TODAY, m.holidayDates)) return null;
  return (
    <div className="banner info">
      <CalendarOff size={16} />
      Hari ini hari libur: {m.holidayName(TODAY) ?? "akhir pekan"}.
    </div>
  );
}

// ---------- Intern (design-intern.md Alur 2) ----------

function InternDashboard() {
  const m = useMock();
  const navigate = useNavigate();
  const { state, rec } = m.today(ME.Intern);
  const month = TODAY.slice(0, 7);
  const r = recap(m.rowsFor(ME.Intern, `${month}-01`, `${month}-31`));
  const tasks = m.tasks.filter((t) => t.intern === ME.Intern);
  const active = tasks
    .filter((t) => t.status !== "Done")
    .sort((a, b) => a.due.localeCompare(b.due));
  const late = active.filter((t) => taskIsLate(t.due, t.status, t.submittedAt));
  const nearest = active.find((t) => t.due >= m.nowIso()) ?? active[0];
  return (
    <div className="grid gap-5">
      {state === "Sudah Clock In" && !rec?.report && (
        <div className="banner warn">
          <AlertTriangle size={16} />
          <span className="mr-auto">Daily Report hari ini belum dikirim.</span>
          <Button
            size="sm"
            onClick={() =>
              void navigate({ to: "/absensi", search: { tab: "hari-ini", open: "report" } })
            }
          >
            Isi Daily Report
          </Button>
        </div>
      )}
      <div className="dashboard-grid">
        <TodayCard />
        <Panel
          title={`Rekap bulan ini (${formatMonth(month)})`}
          subtitle="Status final. Hari berjalan belum dihitung sampai lewat 23:59."
        >
          <div className="recap-grid">
            <Metric label="Hadir" value={r.hadir} tone="green" />
            <Metric label="Izin" value={r.izin} tone="blue" />
            <Metric label="Tidak Hadir" value={r.tidakHadir} tone="red" />
            <Metric label="Lupa Clock Out" value={r.lupa} tone="orange" />
          </div>
          <p className="px-5 pb-5 text-[11px] text-muted-foreground">
            Hari kerja berjalan: {r.hariKerja}
          </p>
        </Panel>
      </div>
      <Panel
        title="Task aktif"
        action={
          <Link className="text-action" to="/task">
            Lihat Task <ArrowRight size={12} />
          </Link>
        }
      >
        {tasks.length === 0 ? (
          <Empty>Belum ada Task dari mentor.</Empty>
        ) : (
          <div className="px-5 pb-5 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {(["To Do", "In Progress", "In Review"] as const).map((s) => (
                <span key={s} className="count-chip">
                  <Status status={s} /> {tasks.filter((t) => t.status === s).length}
                </span>
              ))}
              {late.length > 0 && (
                <span className="count-chip">
                  <Status status="Terlambat" /> {late.length}
                </span>
              )}
            </div>
            {nearest && (
              <p className="text-xs">
                Tenggat terdekat:{" "}
                <Link
                  className="font-semibold text-primary"
                  to="/task"
                  search={{ open: nearest.id }}
                >
                  {nearest.title}
                </Link>{" "}
                - {formatShortTime(nearest.due)}
              </p>
            )}
          </div>
        )}
      </Panel>
      <div className="info-line">
        <span>Periode magang: {m.me.start ? formatPeriod(m.me.start, m.me.end) : "-"}</span>
        <span>Mentor: {m.me.mentor}</span>
      </div>
      <AnnouncementList />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={`metric st-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AnnouncementList() {
  const m = useMock();
  const list = m.announcements.filter((a) => a.audience.includes(m.role)).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <Panel title="Pengumuman" subtitle="Dari admin untuk role Anda.">
      {list.map((a) => (
        <div className="announcement" key={a.id}>
          <div>
            <h3>{a.title}</h3>
            <p>{a.text}</p>
            <small>
              {a.author} · {formatShort(a.date, true)}
            </small>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function TodayCounts({ interns }: { interns: Person[] }) {
  const m = useMock();
  const states = interns.map((p) => m.today(p.name).state);
  const sudah = states.filter((s) => s === "Sudah Clock In" || s === "Sudah Clock Out").length;
  return (
    <>
      <div className="recap-grid three">
        <Metric label="Sudah Clock In" value={sudah} tone="teal" />
        <Metric label="Izin" value={states.filter((s) => s === "Izin").length} tone="blue" />
        <Metric
          label="Belum Clock In"
          value={states.filter((s) => s === "Belum Clock In").length}
          tone="light"
        />
      </div>
      <p className="px-5 pb-4 text-[11px] text-muted-foreground">
        Status final ditetapkan sistem setelah 23:59.
      </p>
    </>
  );
}

function ActionBox({
  title,
  count,
  children,
  all,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  all: React.ReactNode;
}) {
  return (
    <Panel
      title={`${title} (${count})`}
      action={count > 5 ? all : undefined}
      className="action-box"
    >
      {count === 0 ? (
        <Empty>Tidak ada yang perlu ditindak hari ini.</Empty>
      ) : (
        <div className="action-list">{children}</div>
      )}
    </Panel>
  );
}

// ---------- Mentor (design-mentor.md Alur 2) ----------

function MentorDashboard() {
  const m = useMock();
  const interns = m.internsOf(ME.Mentor);
  const names = interns.map((p) => p.name);
  const active = interns.filter((p) => m.isActive(p));
  if (interns.length === 0)
    return <Empty>Belum ada intern bimbingan. Hubungi admin untuk penugasan.</Empty>;
  const tasks = m.tasks.filter((t) => names.includes(t.intern));
  const review = tasks
    .filter((t) => t.status === "In Review")
    .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const leaves = m.leaves
    .filter((l) => l.status === "Pending" && names.includes(l.intern))
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
  const comments = tasks.filter((t) => t.unread.Mentor > 0);
  const late = tasks
    .filter((t) => taskIsLate(t.due, t.status, t.submittedAt))
    .sort((a, b) => a.due.localeCompare(b.due));
  const holiday = !isWorkingDay(TODAY, m.holidayDates);
  return (
    <div className="grid gap-5">
      <HolidayBanner />
      {!holiday && (
        <Panel title={`Intern saya hari ini (${active.length} intern)`}>
          <TodayCounts interns={active} />
        </Panel>
      )}
      <h2 className="section-title">Perlu tindakan</h2>
      <div className="action-grid">
        <ActionBox
          title="Task menunggu review"
          count={review.length}
          all={
            <Link className="text-action" to="/task">
              Lihat semua
            </Link>
          }
        >
          {review.slice(0, 5).map((t) => (
            <ActionRow
              key={t.id}
              who={t.intern}
              what={t.title}
              meta={t.submittedAt ? `dikumpulkan ${formatShortTime(t.submittedAt)}` : ""}
              to="/task"
              open={t.id}
            />
          ))}
        </ActionBox>
        <ActionBox
          title="Izin pending"
          count={leaves.length}
          all={
            <Link className="text-action" to="/izin">
              Lihat semua
            </Link>
          }
        >
          {leaves.slice(0, 5).map((l) => (
            <ActionRow
              key={l.id}
              who={l.intern}
              what={l.type.replace("Izin ", "")}
              meta={`${pendingHours(l.submitted)} jam`}
              warn={isOverduePending(l.status, l.submitted)}
              to="/izin"
              open={String(l.id)}
            />
          ))}
        </ActionBox>
        <ActionBox
          title="Komentar baru dari intern"
          count={comments.length}
          all={
            <Link className="text-action" to="/task">
              Lihat semua
            </Link>
          }
        >
          {comments.slice(0, 5).map((t) => (
            <ActionRow
              key={t.id}
              who={t.intern}
              what={`Task "${t.title}"`}
              meta={`${t.unread.Mentor} baru`}
              to="/task"
              open={t.id}
            />
          ))}
        </ActionBox>
        <ActionBox
          title="Task terlambat"
          count={late.length}
          all={
            <Link className="text-action" to="/task">
              Lihat semua
            </Link>
          }
        >
          {late.slice(0, 5).map((t) => (
            <ActionRow
              key={t.id}
              who={t.intern}
              what={`Task "${t.title}"`}
              meta={lateLabel(t.due).toLowerCase()}
              warn
              to="/task"
              open={t.id}
            />
          ))}
        </ActionBox>
      </div>
      <AnnouncementList />
    </div>
  );
}

function ActionRow({
  who,
  what,
  meta,
  warn = false,
  to,
  open,
}: {
  who: string;
  what: string;
  meta: string;
  warn?: boolean;
  to: "/task" | "/izin" | "/koreksi";
  open: string;
}) {
  return (
    <div className="action-row">
      <strong>{shortName(who)}</strong>
      <span className="truncate">{what}</span>
      <span className={`meta ${warn ? "warn" : ""}`}>
        {warn && "! "}
        {meta}
      </span>
      <Button size="sm" variant="outline" asChild>
        <Link to={to} search={{ open }}>
          Buka
        </Link>
      </Button>
    </div>
  );
}

// ---------- Admin (design-admin.md Alur 3) ----------

function AdminDashboard() {
  const m = useMock();
  const navigate = useNavigate();
  const [extend, setExtend] = useState<Person | null>(null);
  const inPeriod = m.people.filter((p) => p.role === "Intern" && m.isActive(p));
  let yesterday = addDays(TODAY, -1);
  while (!isWorkingDay(yesterday, m.holidayDates)) yesterday = addDays(yesterday, -1);
  const yRows = inPeriod.flatMap((p) => m.rowsFor(p.name, yesterday, yesterday));
  const y = (s: string) => yRows.filter((r) => r.status === s).length;
  const overdue = m.leaves
    .filter((l) => isOverduePending(l.status, l.submitted))
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
  const corrections = m.corrections
    .filter((c) => c.status === "Pending")
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
  const ending = inPeriod
    .filter((p) => endsWithin(p.end, 7))
    .sort((a, b) => a.end.localeCompare(b.end));
  const holiday = !isWorkingDay(TODAY, m.holidayDates);
  return (
    <div className="grid gap-5">
      <HolidayBanner />
      {!holiday && (
        <Panel title={`Hari ini (${inPeriod.length} intern aktif)`}>
          <TodayCounts interns={inPeriod} />
          <p className="px-5 pb-5 text-[11px]">
            Kemarin ({formatDate(yesterday)}): Hadir {y("Hadir")} | Izin {y("Izin")} | Tidak Hadir{" "}
            {y("Tidak Hadir")} | Lupa Clock Out {y("Lupa Clock Out")}
          </p>
        </Panel>
      )}
      <h2 className="section-title">Perlu tindakan</h2>
      <div className="action-grid">
        <ActionBox
          title="Izin pending > 24 jam"
          count={overdue.length}
          all={
            <Link className="text-action" to="/izin">
              Lihat semua
            </Link>
          }
        >
          {overdue.slice(0, 5).map((l) => (
            <ActionRow
              key={l.id}
              who={l.intern}
              what={l.type.replace("Izin ", "")}
              meta={`${pendingHours(l.submitted)} jam`}
              warn
              to="/izin"
              open={String(l.id)}
            />
          ))}
        </ActionBox>
        <ActionBox
          title="Permintaan koreksi"
          count={corrections.length}
          all={
            <Link className="text-action" to="/koreksi">
              Lihat semua
            </Link>
          }
        >
          {corrections.slice(0, 5).map((c) => (
            <ActionRow
              key={c.id}
              who={c.intern}
              what={formatShort(c.date)}
              meta={`diajukan ${formatShortTime(c.submitted)}`}
              to="/koreksi"
              open={String(c.id)}
            />
          ))}
        </ActionBox>
      </div>
      <Panel title={`Magang berakhir dalam 7 hari (${ending.length})`}>
        {ending.length === 0 ? (
          <Empty>Tidak ada yang perlu ditindak hari ini.</Empty>
        ) : (
          <div className="action-list">
            {ending.map((p) => (
              <div className="action-row" key={p.id}>
                <strong>{shortName(p.name)}</strong>
                <span>Selesai {formatShort(p.end)}</span>
                <span className="meta">Mentor: {p.mentor}</span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      m.setChatDraft({
                        to: p.mentor,
                        text: `Halo ${p.mentor}, masa magang ${p.name} berakhir ${formatShort(p.end, true)}. Apakah akan diperpanjang? Mohon konfirmasinya. Terima kasih.`,
                      });
                      void navigate({ to: "/chat", search: { to: p.mentor } });
                    }}
                  >
                    <MessageSquare />
                    Tanya mentor
                  </Button>
                  <Button size="sm" onClick={() => setExtend(p)}>
                    Perpanjang
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <ExtendDialog person={extend} onClose={() => setExtend(null)} />
    </div>
  );
}

export function ExtendDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const m = useMock();
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={!!person}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setDate("");
          setError(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>Perpanjang Magang - {person?.name}</DialogTitle>
        <DialogDescription>
          Tanggal selesai saat ini: {person && formatShort(person.end, true)}
        </DialogDescription>
        <label className="form-field">
          Tanggal selesai baru *
          <input
            type="date"
            value={date}
            min={person ? addDays(person.end, 1) : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <FormError text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              if (!person) return;
              if (!canExtend(person.end, date))
                return setError("Tanggal baru harus setelah tanggal selesai saat ini.");
              m.setPeople((old) =>
                old.map((p) => (p.id === person.id ? { ...p, end: date, active: true } : p)),
              );
              m.log(
                "Akun",
                person.name,
                `Perpanjang magang dari ${formatShort(person.end, true)} ke ${formatShort(date, true)}.`,
              );
              toast.success("Perubahan tersimpan.");
              setDate("");
              setError(null);
              onClose();
            }}
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

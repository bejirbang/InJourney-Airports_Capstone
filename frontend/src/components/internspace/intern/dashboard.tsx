import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TODAY, formatMonth, formatPeriod, formatShortTime, taskIsLate } from "@/lib/mock-rules";
import { TodayCard } from "@/components/internspace/intern/attendance";
import { AnnouncementList, Metric } from "@/components/internspace/shared/dashboard-parts";
import { ME, type Report, type Task, recap, useMock } from "@/components/internspace/shared/model";
import { Empty, Panel, Status } from "@/components/internspace/shared/ui";

// ---------- Intern (design-intern.md Alur 2) ----------
export function InternDashboard() {
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

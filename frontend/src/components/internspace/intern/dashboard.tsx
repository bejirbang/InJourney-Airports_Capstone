import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TODAY, formatMonth, formatPeriod } from "@/lib/mock-rules";
import { TodayCard, useTodayStatus } from "@/components/internspace/intern/attendance";
import { AnnouncementList, Metric } from "@/components/internspace/shared/dashboard-parts";
import { ME, recap, useMock } from "@/components/internspace/shared/model";
import { Panel } from "@/components/internspace/shared/ui";

// ---------- Intern (design-intern.md Alur 2) ----------
export function InternDashboard() {
  const m = useMock();
  const navigate = useNavigate();
  const todayQuery = useTodayStatus();
  const reminder = todayQuery.data?.logbook_reminder === true;
  const month = TODAY.slice(0, 7);
  const r = recap(m.rowsFor(ME.Intern, `${month}-01`, `${month}-31`));
  return (
    <div className="grid gap-5">
      {reminder && (
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
      <div className="info-line">
        <span>Periode magang: {m.me.start ? formatPeriod(m.me.start, m.me.end) : "-"}</span>
        <span>Mentor: {m.me.mentor}</span>
      </div>
      <AnnouncementList />
    </div>
  );
}

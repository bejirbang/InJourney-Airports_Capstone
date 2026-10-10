import { Link } from "@tanstack/react-router";
import { useState } from "react";
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
  formatMonth,
  formatRange,
  formatShort,
  isWorkingDay,
  monthEnd,
  weekdayIndex,
} from "@/lib/mock-rules";
import { type Leave, ME, useMock, typeShort } from "@/components/internspace/shared/model";
import { MonthNav, PageHeading, Panel, Status } from "@/components/internspace/shared/ui";

// ---------- Kalender Izin mentor (design-mentor.md Alur 8) ----------
export function LeaveCalendarPage() {
  const m = useMock();
  const interns = m.internsOf(ME.Mentor);
  const names = interns.map((p) => p.name);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [intern, setIntern] = useState("Semua");
  const [pick, setPick] = useState<Leave | null>(null);
  const [more, setMore] = useState<string | null>(null);
  const visible = m.leaves.filter(
    (l) =>
      names.includes(l.intern) &&
      (l.status === "Pending" || l.status === "Disetujui") &&
      (intern === "Semua" || l.intern === intern),
  );
  const first = `${month}-01`;
  const last = monthEnd(month);
  const cells: (string | null)[] = [...Array<null>(weekdayIndex(first)).fill(null)];
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  const inMonth = visible.filter((l) => l.start <= last && l.end >= first);
  return (
    <>
      <PageHeading
        title="Kalender Izin"
        subtitle="Izin terdeteksi otomatis. Pending bergaris tepi, Disetujui berwarna penuh."
      />
      <div className="toolbar">
        <MonthNav value={month} onChange={setMonth} min="2026-07" max="2027-01" />
        <select
          className="role-select"
          aria-label="Filter intern"
          value={intern}
          onChange={(e) => setIntern(e.target.value)}
        >
          <option value="Semua">Intern: Semua</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <Panel
        title={formatMonth(month)}
        subtitle={
          inMonth.length === 0 ? "Tidak ada izin pada bulan ini." : `${inMonth.length} pengajuan`
        }
      >
        <div className="calendar">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div key={d} className="calendar-head">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="calendar-cell empty" />;
            const off = !isWorkingDay(d, m.holidayDates);
            const entries = off ? [] : visible.filter((l) => l.start <= d && l.end >= d);
            return (
              <div
                key={d}
                className={`calendar-cell ${off ? "off" : ""} ${d === TODAY ? "today" : ""}`}
              >
                <span className="calendar-day">{Number(d.slice(8))}</span>
                {off && <span className="text-[9px]">{m.holidayName(d) ?? "libur"}</span>}
                {entries.slice(0, 3).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`leave-chip ${l.status === "Pending" ? "pending" : "approved"}`}
                    onClick={() => setPick(l)}
                  >
                    {l.intern.split(" ")[0]} ({typeShort(l.type)[0]})
                  </button>
                ))}
                {entries.length > 3 && (
                  <button
                    type="button"
                    className="text-[9px] text-primary"
                    onClick={() => setMore(d)}
                  >
                    +{entries.length - 3} lagi
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="leave-chip approved">Penuh</i> Izin Disetujui
          </span>
          <span>
            <i className="leave-chip pending">Garis tepi</i> Izin Pending
          </span>
          <span>(S) = Sakit · (U) = Urgent</span>
        </div>
      </Panel>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{pick?.intern}</DialogTitle>
          <DialogDescription>
            {pick?.type} · {pick && formatRange(pick.start, pick.end)}
          </DialogDescription>
          {pick && <Status status={pick.status} />}
          <DialogFooter>
            <Button asChild>
              <Link to="/izin" search={{ open: String(pick?.id ?? "") }}>
                Buka izin
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!more} onOpenChange={(o) => !o && setMore(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Izin {more && formatShort(more, true)}</DialogTitle>
          <DialogDescription>Semua intern yang izin pada tanggal ini.</DialogDescription>
          {visible
            .filter((l) => more && l.start <= more && l.end >= more)
            .map((l) => (
              <button
                key={l.id}
                type="button"
                className="text-left text-xs"
                onClick={() => setPick(l)}
              >
                {l.intern} · {l.type} · <Status status={l.status} />
              </button>
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

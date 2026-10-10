import { Link } from "@tanstack/react-router";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TODAY, formatShort, isWorkingDay } from "@/lib/mock-rules";
import { type Person, shortName, useMock } from "@/components/internspace/shared/model";
import { Empty, Panel, Status } from "@/components/internspace/shared/ui";

export function HolidayBanner() {
  const m = useMock();
  if (isWorkingDay(TODAY, m.holidayDates)) return null;
  return (
    <div className="banner info">
      <CalendarOff size={16} />
      Hari ini hari libur: {m.holidayName(TODAY) ?? "akhir pekan"}.
    </div>
  );
}

export function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className={`metric st-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AnnouncementList() {
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

export function TodayCounts({ interns }: { interns: Person[] }) {
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

export function ActionBox({
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

export function ActionRow({
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

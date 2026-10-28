import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatShort, shortName } from "@/lib/utils";
import type { AdminTodayRow } from "@/lib/endpoints/admin";
import { Empty, Panel } from "@/components/internspace/shared/ui";

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

/** Satu pengumuman dari API; bentuknya sama dengan yang dipakai halaman intern. */
export interface AnnouncementItem {
  id: number;
  title: string;
  body: string;
  author_name: string | null;
  created_at: string | null;
}

/** Daftar pengumuman dari `GET /api/{role}/dashboard`. */
export function AnnouncementList({ items }: { items: AnnouncementItem[] }) {
  if (items.length === 0) return null;
  return (
    <Panel title="Pengumuman" subtitle="Dari admin untuk role Anda.">
      {items.map((a) => (
        <div className="announcement" key={a.id}>
          <div>
            <h3>{a.title}</h3>
            <p>{a.body}</p>
            <small>
              {a.author_name ?? "-"} · {formatShort(a.created_at ?? "", true)}
            </small>
          </div>
        </div>
      ))}
    </Panel>
  );
}

const attended = ["present", "late", "missed_clock_out"];

export function TodayCounts({
  interns,
  clockedIn,
  late,
  onLeave,
  notClockedIn,
  rows,
  onClick,
}: {
  interns: number;
  clockedIn: number;
  late: number;
  onLeave: number;
  notClockedIn: number;
  rows: AdminTodayRow[];
  onClick: (label: string, rows: AdminTodayRow[]) => void;
}) {
  const groups = [
    {
      label: `Sudah Presensi (${interns})`,
      value: clockedIn,
      tone: "teal",
      rows: rows.filter((row) => attended.includes(row.status)),
    },
    {
      label: "Terlambat",
      value: late,
      tone: "red",
      rows: rows.filter((row) => row.status === "late"),
    },
    {
      label: "Izin",
      value: onLeave,
      tone: "blue",
      rows: rows.filter((row) => row.status === "leave"),
    },
    {
      label: "Belum Clock In",
      value: notClockedIn,
      tone: "light",
      rows: rows.filter((row) => row.status === "not_clocked_in"),
    },
  ];

  return (
    <>
      <div className="recap-grid four">
        {groups.map((group) => (
          <button
            type="button"
            key={group.label}
            className={`metric st-${group.tone}`}
            onClick={() => onClick(group.label, group.rows)}
          >
            <span>{group.label}</span>
            <strong>{group.value}</strong>
          </button>
        ))}
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
  to: "/izin" | "/koreksi" | "/warning" | "/penilaian" | "/presentasi" | "/users";
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

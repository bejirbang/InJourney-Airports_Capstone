import { Link } from "@tanstack/react-router";
import { CalendarOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  ASSESSMENT_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatDate, formatRange } from "@/lib/utils";
import type {
  MentorDashboard as MentorDashboardData,
  MentorTodayRow,
} from "@/lib/endpoints/mentor";
import { useMentorDashboard } from "@/components/internspace/mentor/dashboard-data";
import { useApproveLogbook } from "@/components/internspace/mentor/logbook-data";
import {
  ActionBox,
  ActionRow,
  AnnouncementList,
} from "@/components/internspace/shared/dashboard-parts";
import {
  Empty,
  ErrorState,
  LoadingState,
  Panel,
  Status,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Mentor (design-mentor.md Alur 2) ----------

type CountFilter = "clocked_in" | "late" | "on_leave" | "not_clocked_in" | null;

const countOf = (rows: MentorTodayRow[], filter: Exclude<CountFilter, null>) => {
  switch (filter) {
    case "clocked_in":
      return rows.filter((row) => ["present", "late", "missed_clock_in"].includes(row.status))
        .length;
    case "late":
      return rows.filter((row) => row.status === "late").length;
    case "on_leave":
      return rows.filter((row) => row.status === "leave").length;
    case "not_clocked_in":
      return rows.filter((row) => row.status === "not_clocked_in").length;
  }
};

/** Kartu angka dashboard; klik untuk memfilter daftar intern di bawahnya. */
function CountCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`metric st-${tone} ${active ? "ring-2 ring-primary" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function TodayPanel({ data }: { data: MentorDashboardData }) {
  const [filter, setFilter] = useState<CountFilter>(null);
  const today = data.today;
  if (!today) return null;

  const visible = today.rows.filter((row) => {
    if (filter === null) return true;
    switch (filter) {
      case "clocked_in":
        return ["present", "late", "missed_clock_in"].includes(row.status);
      case "late":
        return row.status === "late";
      case "on_leave":
        return row.status === "leave";
      case "not_clocked_in":
        return row.status === "not_clocked_in";
    }
  });

  const toggle = (next: Exclude<CountFilter, null>) =>
    setFilter((current) => (current === next ? null : next));

  return (
    <Panel
      title={`Intern saya hari ini (${today.interns} intern)`}
      subtitle="Klik kotak untuk melihat nama."
      action={
        filter === null ? undefined : (
          <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
            Tampilkan semua
          </Button>
        )
      }
    >
      <div className="recap-grid three">
        <CountCard
          label="Sudah Presensi"
          value={countOf(today.rows, "clocked_in")}
          tone="teal"
          active={filter === "clocked_in"}
          onClick={() => toggle("clocked_in")}
        />
        <CountCard
          label="Terlambat"
          value={countOf(today.rows, "late")}
          tone="red"
          active={filter === "late"}
          onClick={() => toggle("late")}
        />
        <CountCard
          label="Izin"
          value={countOf(today.rows, "on_leave")}
          tone="blue"
          active={filter === "on_leave"}
          onClick={() => toggle("on_leave")}
        />
        <CountCard
          label="Belum Clock In"
          value={countOf(today.rows, "not_clocked_in")}
          tone="light"
          active={filter === "not_clocked_in"}
          onClick={() => toggle("not_clocked_in")}
        />
      </div>
      {visible.length === 0 ? (
        <Empty>Tidak ada intern dengan status ini hari ini.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Intern</th>
                <th>Clock In</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.intern.id}>
                  <td>
                    <Link to="/intern-saya" search={{ open: String(row.intern.id) }}>
                      {row.intern.short_name}
                    </Link>
                  </td>
                  <td>{row.clock_in_at ?? "-"}</td>
                  <td>
                    <Status status={labelOf(ATTENDANCE_STATUS_LABEL, row.status, row.status)} />
                    {row.status === "leave" && row.leave_type && (
                      <Tag tone="blue">{labelOf(LEAVE_TYPE_LABEL, row.leave_type)}</Tag>
                    )}
                    {row.missed_clock_out && <Tag tone="orange">Lupa Clock Out</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-5 pb-4 text-[11px] text-muted-foreground">
        Status final ditetapkan sistem setelah 23:59.
      </p>
    </Panel>
  );
}

export function MentorDashboard() {
  const query = useMentorDashboard();
  const approve = useApproveLogbook();

  if (query.isLoading) {
    return (
      <Panel title="Dashboard">
        <LoadingState />
      </Panel>
    );
  }
  if (query.isError) {
    return (
      <Panel title="Dashboard">
        <div className="px-5 pb-5">
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        </div>
      </Panel>
    );
  }

  const data = query.data;
  if (!data) return null;
  if (data.interns_total === 0) {
    return <Empty>Belum ada intern bimbingan. Hubungi admin untuk penugasan.</Empty>;
  }

  const logbooks = data.pending_logbooks;
  const corrections = data.pending_corrections;
  const leaves = data.pending_leaves;
  const ready = data.ready_to_assess;
  const hasAction =
    logbooks.total > 0 || corrections.total > 0 || leaves.total > 0 || ready.total > 0;

  const approveOne = (id: number) => {
    approve.mutate(
      { id, comment: null },
      {
        onSuccess: (result) => toast.success(result.message),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Logbook gagal disetujui."),
      },
    );
  };

  return (
    <div className="grid gap-5">
      {data.holiday && (
        <div className="banner info">
          <CalendarOff size={16} />
          Hari ini hari libur: {data.holiday.name ?? "akhir pekan"}.
        </div>
      )}

      <TodayPanel data={data} />

      <h2 className="section-title">Perlu tindakan</h2>
      {!hasAction ? (
        <Panel title="Perlu tindakan">
          <Empty>Tidak ada yang perlu ditindak hari ini.</Empty>
        </Panel>
      ) : (
        <div className="action-grid">
          {logbooks.total > 0 && (
            <ActionBox
              title="Logbook menunggu"
              count={logbooks.total}
              all={
                <Link className="text-action" to="/logbook">
                  Lihat semua
                </Link>
              }
            >
              {logbooks.items.map((item) => (
                <div className="action-row" key={item.id}>
                  <strong>{item.intern.short_name}</strong>
                  <span className="truncate" title={item.work}>
                    {formatDate(item.date)} · {item.work}
                  </span>
                  {item.is_corrected && <Tag>Dikoreksi</Tag>}
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/logbook" search={{ open: String(item.id) }}>
                      Buka
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveOne(item.id)}
                    disabled={approve.isPending}
                  >
                    Setujui
                  </Button>
                </div>
              ))}
            </ActionBox>
          )}

          {corrections.total > 0 && (
            <ActionBox
              title="Koreksi menunggu"
              count={corrections.total}
              all={
                <Link className="text-action" to="/koreksi">
                  Lihat semua
                </Link>
              }
            >
              {corrections.items.map((item) => (
                <ActionRow
                  key={item.id}
                  who={item.intern.name}
                  what={`${formatDate(item.date)} · ${labelOf(
                    ATTENDANCE_STATUS_LABEL,
                    item.recorded_status,
                    item.recorded_status,
                  )}`}
                  meta={item.reason}
                  to="/koreksi"
                  open={String(item.id)}
                />
              ))}
            </ActionBox>
          )}

          {leaves.total > 0 && (
            <ActionBox
              title="Izin menunggu"
              count={leaves.total}
              all={
                <Link className="text-action" to="/izin">
                  Lihat semua
                </Link>
              }
            >
              {leaves.items.map((item) => (
                <ActionRow
                  key={item.id}
                  who={item.intern.name}
                  what={`${labelOf(LEAVE_TYPE_LABEL, item.type)} · ${formatRange(
                    item.start_date,
                    item.end_date,
                  )}`}
                  meta={`${item.pending_hours} jam`}
                  warn={item.is_overdue}
                  to="/izin"
                  open={String(item.id)}
                />
              ))}
            </ActionBox>
          )}

          {ready.total > 0 && (
            <ActionBox
              title="Siap dinilai"
              count={ready.total}
              all={
                <Link className="text-action" to="/penilaian">
                  Lihat semua
                </Link>
              }
            >
              {ready.items.map((item) => (
                <div className="action-row" key={item.intern.id}>
                  <strong>{item.intern.short_name}</strong>
                  <span>{item.end_date ? formatDate(item.end_date) : "-"}</span>
                  <Status status={labelOf(ASSESSMENT_STATUS_LABEL, item.status, item.status)} />
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/penilaian" search={{ open: String(item.intern.id) }}>
                      Nilai
                    </Link>
                  </Button>
                </div>
              ))}
            </ActionBox>
          )}
        </div>
      )}

      <AnnouncementList items={data.announcements} />
    </div>
  );
}

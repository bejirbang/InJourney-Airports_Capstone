import { Link } from "@tanstack/react-router";
import {
  TODAY,
  formatShortTime,
  isOverduePending,
  isWorkingDay,
  lateLabel,
  pendingHours,
  taskIsLate,
} from "@/lib/mock-rules";
import {
  ActionBox,
  ActionRow,
  AnnouncementList,
  HolidayBanner,
  TodayCounts,
} from "@/components/internspace/shared/dashboard-parts";
import { ME, type Task, useMock } from "@/components/internspace/shared/model";
import { Empty, Panel } from "@/components/internspace/shared/ui";

// ---------- Mentor (design-mentor.md Alur 2) ----------
export function MentorDashboard() {
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

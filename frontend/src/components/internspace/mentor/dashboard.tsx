import { Link } from "@tanstack/react-router";
import { TODAY, isOverduePending, isWorkingDay, pendingHours } from "@/lib/mock-rules";
import {
  ActionBox,
  ActionRow,
  AnnouncementList,
  HolidayBanner,
  TodayCounts,
} from "@/components/internspace/shared/dashboard-parts";
import { ME, useMock } from "@/components/internspace/shared/model";
import { Empty, Panel } from "@/components/internspace/shared/ui";

// ---------- Mentor (design-mentor.md Alur 2) ----------
export function MentorDashboard() {
  const m = useMock();
  const interns = m.internsOf(ME.Mentor);
  const names = interns.map((p) => p.name);
  const active = interns.filter((p) => m.isActive(p));
  if (interns.length === 0)
    return <Empty>Belum ada intern bimbingan. Hubungi admin untuk penugasan.</Empty>;
  const leaves = m.leaves
    .filter((l) => l.status === "Pending" && names.includes(l.intern))
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
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
      </div>
      <AnnouncementList />
    </div>
  );
}

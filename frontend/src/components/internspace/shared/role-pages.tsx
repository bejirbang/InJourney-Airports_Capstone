import airport from "@/assets/airport-banner.jpg";
import { AdminAttendance } from "@/components/internspace/admin/attendance";
import { AdminDashboard } from "@/components/internspace/admin/dashboard";
import { InternAttendance } from "@/components/internspace/intern/attendance";
import { InternDashboard } from "@/components/internspace/intern/dashboard";
import { InternLeave } from "@/components/internspace/intern/leave";
import { MentorDashboard } from "@/components/internspace/mentor/dashboard";
import { ReviewerLeave } from "@/components/internspace/shared/leave-review";
import { useMock } from "@/components/internspace/shared/model";
import { PageHeading } from "@/components/internspace/shared/ui";

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

export function AttendancePage() {
  const m = useMock();
  return m.role === "Admin" ? <AdminAttendance /> : <InternAttendance />;
}

export function LeavePage() {
  const m = useMock();
  return m.role === "Intern" ? <InternLeave /> : <ReviewerLeave />;
}

import airport from "@/assets/airport-banner.jpg";
import { AdminAttendance } from "@/components/internspace/admin/attendance";
import { AdminAssessments } from "@/components/internspace/admin/assessments";
import { AdminDashboard } from "@/components/internspace/admin/dashboard";
import { CorrectionsPage as AdminCorrections } from "@/components/internspace/admin/corrections";
import { AdminPresentations } from "@/components/internspace/admin/presentations";
import { InternAttendance } from "@/components/internspace/intern/attendance";
import { InternDashboard } from "@/components/internspace/intern/dashboard";
import { InternLeave } from "@/components/internspace/intern/leave";
import { InternLogbook } from "@/components/internspace/intern/logbook";
import { InternNotes } from "@/components/internspace/intern/notes";
import { InternPresentation } from "@/components/internspace/intern/presentation";
import { MentorAssessments } from "@/components/internspace/mentor/assessments";
import { MentorCorrections } from "@/components/internspace/mentor/corrections";
import { MentorDashboard } from "@/components/internspace/mentor/dashboard";
import { MentorLogbookReview } from "@/components/internspace/mentor/logbook-review";
import { ReviewerLeave } from "@/components/internspace/shared/leave-review";
import { NoAccess, PageHeading } from "@/components/internspace/shared/ui";
import { useAuth } from "@/lib/auth";

export function Dashboard() {
  const auth = useAuth();
  const role = auth.user?.role;
  return (
    <>
      <PageHeading title="Dashboard" />
      <section className="welcome-banner compact">
        <img src={airport} width={1600} height={608} alt="Terminal dan apron bandara" />
        <div className="welcome-copy">
          <span className="eyebrow">INJOURNEY AIRPORTS · {(role ?? "").toUpperCase()}</span>
          <h2>Selamat datang, {auth.user?.name.split(" ")[0] ?? ""}</h2>
          <p>
            {role === "intern"
              ? "Cek status hari ini dan logbook yang perlu diisi."
              : "Berikut hal yang perlu ditindak hari ini."}
          </p>
        </div>
      </section>
      {role === "intern" ? (
        <InternDashboard />
      ) : role === "mentor" ? (
        <MentorDashboard />
      ) : (
        <AdminDashboard />
      )}
    </>
  );
}

export function AttendancePage() {
  return useAuth().user?.role === "admin" ? <AdminAttendance /> : <InternAttendance />;
}

export function LeavePage() {
  return useAuth().user?.role === "intern" ? <InternLeave /> : <ReviewerLeave />;
}

export function LogbookPage() {
  const role = useAuth().user?.role;
  return role === "intern" ? (
    <InternLogbook />
  ) : role === "mentor" ? (
    <MentorLogbookReview />
  ) : (
    <NoAccess />
  );
}

export function PresentationPage() {
  const role = useAuth().user?.role;
  return role === "intern" ? (
    <InternPresentation />
  ) : role === "admin" ? (
    <AdminPresentations />
  ) : (
    <NoAccess />
  );
}

export function NotesPage() {
  return useAuth().user?.role === "intern" ? <InternNotes /> : <NoAccess />;
}

export function AssessmentPage() {
  const role = useAuth().user?.role;
  return role === "mentor" ? (
    <MentorAssessments />
  ) : role === "admin" ? (
    <AdminAssessments />
  ) : (
    <NoAccess />
  );
}

/** Admin memakai admin/corrections; mentor memakai mentor/corrections. */
export function CorrectionsPage() {
  const role = useAuth().user?.role;
  return role === "admin" ? (
    <AdminCorrections />
  ) : role === "mentor" ? (
    <MentorCorrections />
  ) : (
    <NoAccess />
  );
}

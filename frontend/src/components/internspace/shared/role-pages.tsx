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
import { useMock } from "@/components/internspace/shared/model";
import { NoAccess, PageHeading, Panel } from "@/components/internspace/shared/ui";
import { useAuth } from "@/lib/auth";

export function Dashboard() {
  const m = useMock();
  const auth = useAuth();
  return (
    <>
      <PageHeading title="Dashboard" />
      <section className="welcome-banner compact">
        <img src={airport} width={1600} height={608} alt="Terminal dan apron bandara" />
        <div className="welcome-copy">
          <span className="eyebrow">INJOURNEY AIRPORTS · {m.role.toUpperCase()}</span>
          <h2>Selamat datang, {(auth.user?.name ?? m.me.name).split(" ")[0]}</h2>
          <p>
            {m.role === "Intern"
              ? "Cek status hari ini dan logbook yang perlu diisi."
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

/** Isi sementara route baru; diganti komponen asli pada fase berikutnya (progress.md 5.2). */
function PendingPage({ title }: { title: string }) {
  return (
    <>
      <PageHeading title={title} />
      <Panel title={title}>
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          Bagian ini sedang disiapkan pada fase berikutnya.
        </p>
      </Panel>
    </>
  );
}

/** Fase 2 (intern) dan Fase 3 (mentor) mengisi halaman ini. */
export function LogbookPage() {
  const m = useMock();
  return m.role === "Intern" ? (
    <InternLogbook />
  ) : m.role === "Mentor" ? (
    <MentorLogbookReview />
  ) : (
    <NoAccess />
  );
}

/** Fase 2 (intern) dan Fase 4 (admin) mengisi halaman ini. */
export function PresentationPage() {
  const m = useMock();
  return m.role === "Intern" ? (
    <InternPresentation />
  ) : m.role === "Admin" ? (
    <AdminPresentations />
  ) : (
    <PendingPage title="Presentasi Akhir" />
  );
}

/** Fase 2 (intern) mengisi halaman ini. */
export function NotesPage() {
  const m = useMock();
  return m.role === "Intern" ? <InternNotes /> : <PendingPage title="Catatan" />;
}

/** Fase 3 (mentor, "Input Nilai") dan Fase 4 (admin, "Penilaian"). */
export function AssessmentPage() {
  const m = useMock();
  return m.role === "Mentor" ? (
    <MentorAssessments />
  ) : m.role === "Admin" ? (
    <AdminAssessments />
  ) : (
    <PendingPage title="Input Nilai" />
  );
}

/** Admin memakai admin/corrections; mentor memakai mentor/corrections. */
export function CorrectionsPage() {
  const m = useMock();
  return m.role === "Admin" ? (
    <AdminCorrections />
  ) : m.role === "Mentor" ? (
    <MentorCorrections />
  ) : (
    <PendingPage title="Koreksi Presensi" />
  );
}

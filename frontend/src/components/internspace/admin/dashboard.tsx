import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TODAY,
  addDays,
  endsWithin,
  formatDate,
  formatShort,
  formatShortTime,
  isOverduePending,
  isWorkingDay,
  pendingHours,
} from "@/lib/mock-rules";
import { ExtendDialog } from "@/components/internspace/admin/extend-dialog";
import { NoActiveOfficeBanner } from "@/components/internspace/admin/offices";
import {
  ActionBox,
  ActionRow,
  HolidayBanner,
  TodayCounts,
} from "@/components/internspace/shared/dashboard-parts";
import { type Person, shortName, useMock } from "@/components/internspace/shared/model";
import { Empty, Panel } from "@/components/internspace/shared/ui";

// ---------- Admin (design-admin.md Alur 3) ----------
export function AdminDashboard() {
  const m = useMock();
  const navigate = useNavigate();
  const [extend, setExtend] = useState<Person | null>(null);
  const inPeriod = m.people.filter((p) => p.role === "Intern" && m.isActive(p));
  let yesterday = addDays(TODAY, -1);
  while (!isWorkingDay(yesterday, m.holidayDates)) yesterday = addDays(yesterday, -1);
  const yRows = inPeriod.flatMap((p) => m.rowsFor(p.name, yesterday, yesterday));
  const y = (s: string) => yRows.filter((r) => r.status === s).length;
  const overdue = m.leaves
    .filter((l) => isOverduePending(l.status, l.submitted))
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
  const corrections = m.corrections
    .filter((c) => c.status === "Pending")
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
  const ending = inPeriod
    .filter((p) => endsWithin(p.end, 7))
    .sort((a, b) => a.end.localeCompare(b.end));
  const holiday = !isWorkingDay(TODAY, m.holidayDates);
  return (
    <div className="grid gap-5">
      <HolidayBanner />
      {!m.offices.some((o) => o.active) && <NoActiveOfficeBanner link />}
      {!holiday && (
        <Panel title={`Hari ini (${inPeriod.length} intern aktif)`}>
          <TodayCounts interns={inPeriod} />
          <p className="px-5 pb-5 text-[11px]">
            Kemarin ({formatDate(yesterday)}): Hadir {y("Hadir")} | Izin {y("Izin")} | Tidak Hadir{" "}
            {y("Tidak Hadir")} | Lupa Clock Out {y("Lupa Clock Out")}
          </p>
        </Panel>
      )}
      <h2 className="section-title">Perlu tindakan</h2>
      <div className="action-grid">
        <ActionBox
          title="Izin pending > 24 jam"
          count={overdue.length}
          all={
            <Link className="text-action" to="/izin">
              Lihat semua
            </Link>
          }
        >
          {overdue.slice(0, 5).map((l) => (
            <ActionRow
              key={l.id}
              who={l.intern}
              what={l.type.replace("Izin ", "")}
              meta={`${pendingHours(l.submitted)} jam`}
              warn
              to="/izin"
              open={String(l.id)}
            />
          ))}
        </ActionBox>
        <ActionBox
          title="Permintaan koreksi"
          count={corrections.length}
          all={
            <Link className="text-action" to="/koreksi">
              Lihat semua
            </Link>
          }
        >
          {corrections.slice(0, 5).map((c) => (
            <ActionRow
              key={c.id}
              who={c.intern}
              what={formatShort(c.date)}
              meta={`diajukan ${formatShortTime(c.submitted)}`}
              to="/koreksi"
              open={String(c.id)}
            />
          ))}
        </ActionBox>
      </div>
      <Panel title={`Magang berakhir dalam 7 hari (${ending.length})`}>
        {ending.length === 0 ? (
          <Empty>Tidak ada yang perlu ditindak hari ini.</Empty>
        ) : (
          <div className="action-list">
            {ending.map((p) => (
              <div className="action-row" key={p.id}>
                <strong>{shortName(p.name)}</strong>
                <span>Selesai {formatShort(p.end)}</span>
                <span className="meta">Mentor: {p.mentor}</span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      m.setChatDraft({
                        to: p.mentor,
                        text: `Halo ${p.mentor}, masa magang ${p.name} berakhir ${formatShort(p.end, true)}. Apakah akan diperpanjang? Mohon konfirmasinya. Terima kasih.`,
                      });
                      void navigate({ to: "/chat", search: { to: p.mentor } });
                    }}
                  >
                    <MessageSquare />
                    Tanya mentor
                  </Button>
                  <Button size="sm" onClick={() => setExtend(p)}>
                    Perpanjang
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <ExtendDialog person={extend} onClose={() => setExtend(null)} />
    </div>
  );
}

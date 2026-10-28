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
import { ApiError } from "@/lib/api";
import { LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL, labelOf } from "@/lib/labels";
import { TODAY, formatMonth, formatRange } from "@/lib/utils";
import type { MentorLeaveCalendarDay, MentorLeaveCalendarEntry } from "@/lib/endpoints/mentor";
import { useMentorLeaveCalendar } from "@/components/internspace/mentor/leave-calendar-data";
import { useMentorInterns } from "@/components/internspace/mentor/interns-data";
import {
  Empty,
  ErrorState,
  LoadingState,
  MonthNav,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// ---------- Kalender Izin mentor (design-mentor.md Alur 7) ----------

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const typeShort = (entry: MentorLeaveCalendarEntry) => (entry.type === "sick" ? "S" : "U");

export function LeaveCalendarPage() {
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [internId, setInternId] = useState("");
  const [pick, setPick] = useState<{
    entry: MentorLeaveCalendarEntry;
    day: string;
  } | null>(null);
  const [more, setMore] = useState<MentorLeaveCalendarDay | null>(null);

  const interns = useMentorInterns("all", "");
  const calendar = useMentorLeaveCalendar(month, internId === "" ? undefined : Number(internId));

  const data = calendar.data;
  const days = data?.days ?? [];
  const padding = days[0] ? days[0].weekday - 1 : 0;
  const pickLeave = pick
    ? data?.leaves.find((leave) => leave.id === pick.entry.leave_id)
    : undefined;

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
          value={internId}
          onChange={(event) => setInternId(event.target.value)}
        >
          <option value="">Intern: Semua</option>
          {(interns.data?.interns ?? []).map((intern) => (
            <option key={intern.id} value={intern.id}>
              {intern.name}
            </option>
          ))}
        </select>
      </div>

      <Panel
        title={formatMonth(month)}
        subtitle={
          data
            ? data.leaves.length === 0
              ? "Tidak ada izin pada bulan ini."
              : `${data.leaves.length} pengajuan`
            : undefined
        }
      >
        {calendar.isLoading ? (
          <LoadingState />
        ) : calendar.isError ? (
          <div className="px-5 pb-5">
            <ErrorState
              message={calendar.error instanceof ApiError ? calendar.error.message : undefined}
              onRetry={() => void calendar.refetch()}
            />
          </div>
        ) : days.length === 0 ? (
          <Empty>Tidak ada data kalender pada bulan ini.</Empty>
        ) : (
          <>
            <div className="calendar">
              {WEEKDAYS.map((day) => (
                <div key={day} className="calendar-head">
                  {day}
                </div>
              ))}
              {Array.from({ length: padding }, (_, index) => (
                <div key={`empty-${index}`} className="calendar-cell empty" />
              ))}
              {days.map((day) => (
                <div
                  key={day.date}
                  className={`calendar-cell ${day.is_off ? "off" : ""} ${
                    day.is_today ? "today" : ""
                  }`}
                >
                  <span className="calendar-day">{Number(day.date.slice(8))}</span>
                  {day.is_off && <span className="text-[9px]">{day.holiday_name ?? "libur"}</span>}
                  {!day.is_off &&
                    day.entries.slice(0, 3).map((entry) => (
                      <button
                        key={`${entry.leave_id}-${entry.intern_id}`}
                        type="button"
                        className={`leave-chip ${
                          entry.status === "pending" ? "pending" : "approved"
                        }`}
                        onClick={() => setPick({ entry, day: day.date })}
                      >
                        {entry.short_name} ({typeShort(entry)})
                      </button>
                    ))}
                  {!day.is_off && day.entries.length > 3 && (
                    <button
                      type="button"
                      className="text-[9px] text-primary"
                      onClick={() => setMore(day)}
                    >
                      +{day.entries.length - 3} lagi
                    </button>
                  )}
                </div>
              ))}
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
          </>
        )}
      </Panel>

      <Dialog open={pick !== null} onOpenChange={(open) => !open && setPick(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{pickLeave?.intern.name ?? pick?.entry.short_name ?? "Izin"}</DialogTitle>
          <DialogDescription>
            {labelOf(LEAVE_TYPE_LABEL, pickLeave?.type ?? pick?.entry.type)}
            {pickLeave
              ? ` · ${formatRange(pickLeave.start_date, pickLeave.end_date)}`
              : pick
                ? ` · ${pick.day}`
                : ""}
          </DialogDescription>
          {(pickLeave?.status ?? pick?.entry.status) && (
            <Status status={labelOf(LEAVE_STATUS_LABEL, pickLeave?.status ?? pick?.entry.status)} />
          )}
          <DialogFooter>
            <Button asChild>
              <Link
                to="/izin"
                search={{ open: String(pickLeave?.id ?? pick?.entry.leave_id ?? "") }}
              >
                Buka izin
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={more !== null} onOpenChange={(open) => !open && setMore(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Izin {more?.date}</DialogTitle>
          <DialogDescription>Semua intern yang izin pada tanggal ini.</DialogDescription>
          {more?.entries.map((entry) => (
            <button
              key={`${entry.leave_id}-${entry.intern_id}`}
              type="button"
              className="text-left text-xs"
              onClick={() => {
                setPick({ entry, day: more.date });
                setMore(null);
              }}
            >
              {entry.short_name} · {labelOf(LEAVE_TYPE_LABEL, entry.type)} ·{" "}
              <Status status={labelOf(LEAVE_STATUS_LABEL, entry.status, entry.status)} />
            </button>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ATTENDANCE_STATUS_LABEL,
  CORRECTED_LABEL,
  LEAVE_TYPE_LABEL,
  LOGBOOK_STATUS_LABEL,
  MISSED_CLOCK_OUT_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { ApiAttendanceDayDetail, ApiAttendanceRecap } from "@/lib/endpoints/intern";
import {
  DetailList,
  ErrorState,
  LoadingState,
  Status,
  Tag,
} from "@/components/internspace/shared/ui";

// Bagian presensi bersama. Semua data berasal dari respons API.

/** Rekap bulanan dari `GET /api/intern/attendance` (angka dihitung server). */
export function ApiRecapStrip({ recap: r }: { recap: ApiAttendanceRecap }) {
  return (
    <div className="recap-strip">
      <span>
        Hadir <strong>{r.present}</strong>
      </span>
      <span>
        Terlambat <strong>{r.late}</strong>
      </span>
      <span>
        Lupa Clock In <strong>{r.missed_clock_in}</strong>
      </span>
      <span>
        Izin <strong>{r.leave}</strong>
      </span>
      <span>
        Tidak Hadir <strong>{r.absent}</strong>
      </span>
      <span>
        Lupa Clock Out <strong>{r.missed_clock_out}</strong>
      </span>
      <span>
        Hari kerja <strong>{r.working_days}</strong>
      </span>
    </div>
  );
}

/** Tanda pada satu baris presensi: Dikoreksi dan Lupa Clock Out (bukan status). */
export function AttendanceTags({ day }: { day: ApiAttendanceDayDetail }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Status status={labelOf(ATTENDANCE_STATUS_LABEL, day.status)} />
      {day.is_corrected && <Tag>{CORRECTED_LABEL}</Tag>}
      {day.missed_clock_out && <Tag tone="orange">{MISSED_CLOCK_OUT_LABEL}</Tag>}
    </span>
  );
}

/** Detail satu hari dari `GET /api/intern/attendance/days/{date}`. */
export function ApiDayDetail({
  date,
  day,
  loading,
  error,
  onRetry,
  onClose,
}: {
  date: string | null;
  day: ApiAttendanceDayDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const items: [string, ReactNode][] = [];
  if (day) {
    items.push(["Status", <AttendanceTags key="status" day={day} />]);
    items.push(["Jadwal", day.scheduled ? `${day.scheduled.start} - ${day.scheduled.end}` : "-"]);
    items.push([
      "Clock in",
      day.clock_in_at
        ? `${day.clock_in_at}${day.clock_in_office ? ` · ${day.clock_in_office.name}` : ""}`
        : "-",
    ]);
    items.push([
      "Clock out",
      day.clock_out_at
        ? `${day.clock_out_at}${day.clock_out_office ? ` · ${day.clock_out_office.name}` : ""}`
        : "-",
    ]);
    if (day.leave_type) items.push(["Izin", labelOf(LEAVE_TYPE_LABEL, day.leave_type)]);
    if (day.holiday_name) items.push(["Libur", day.holiday_name]);
    items.push([
      "Logbook",
      day.logbook
        ? labelOf(LOGBOOK_STATUS_LABEL, day.logbook.status)
        : labelOf(LOGBOOK_STATUS_LABEL, day.logbook_state, "Belum ada logbook"),
    ]);
    if (day.logbook) {
      items.push(["Yang saya kerjakan", day.logbook.work]);
      items.push(["Kendala atau catatan", day.logbook.notes || "-"]);
    }
  }

  return (
    <Dialog open={date !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{date ? formatDate(date) : "Detail presensi"}</DialogTitle>
        <DialogDescription>Detail presensi dan logbook. Hanya baca.</DialogDescription>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : day ? (
          <DetailList items={items} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

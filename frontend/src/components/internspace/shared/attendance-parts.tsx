import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/mock-rules";
import { type Report, type Row, recap } from "@/components/internspace/shared/model";
import { DetailList, Status, Tag } from "@/components/internspace/shared/ui";

export function RecapStrip({ r }: { r: ReturnType<typeof recap> }) {
  return (
    <div className="recap-strip">
      <span>
        Hadir <strong>{r.hadir}</strong>
      </span>
      <span>
        Izin <strong>{r.izin}</strong>
      </span>
      <span>
        Tidak Hadir <strong>{r.tidakHadir}</strong>
      </span>
      <span>
        Lupa Clock Out <strong>{r.lupa}</strong>
      </span>
      <span>
        Hari kerja <strong>{r.hariKerja}</strong>
      </span>
    </div>
  );
}

export function DayDetail({
  row,
  onClose,
  name,
}: {
  row: Row | null;
  onClose: () => void;
  name?: string | undefined;
}) {
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {name ? `${name} · ` : ""}
          {row && formatDate(row.date)}
        </DialogTitle>
        <DialogDescription>Detail absensi dan Daily Report. Hanya baca.</DialogDescription>
        {row && (
          <DetailList
            items={[
              ["Clock in", row.clockIn || "-"],
              ["Clock out", row.clockOut || "-"],
              [
                "Status",
                <span key="s" className="flex gap-2">
                  <Status status={row.status} />
                  {row.corrected && <Tag>Dikoreksi admin</Tag>}
                </span>,
              ],
              ["Daily Report", row.report?.work ?? "Belum ada laporan"],
              ["Kendala atau catatan", row.report?.notes || "-"],
            ]}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  CORRECTION_STATUS_LABEL,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  labelOf,
} from "@/lib/labels";
import { formatMonth, formatPeriod, formatShort } from "@/lib/utils";
import type { ApiPresentationBanner } from "@/lib/endpoints/intern";
import { TodayCard } from "@/components/internspace/intern/attendance";
import { useInternDashboard } from "@/components/internspace/intern/dashboard-data";
import { AnnouncementList, Metric } from "@/components/internspace/shared/dashboard-parts";
import { ErrorState, LoadingState, Panel } from "@/components/internspace/shared/ui";

// ---------- Intern (design-intern.md Alur 2) ----------

/** Banner presentasi: muncul sejak formulir terbuka sampai disetujui (design-intern.md 4.2). */
function PresentationBanner({ banner }: { banner: ApiPresentationBanner }) {
  const text =
    banner.state === "pending"
      ? "Bukti presentasi sudah dikirim. Menunggu verifikasi admin."
      : banner.state === "revision"
        ? "Bukti presentasi perlu diperbaiki."
        : `Presentasi akhir: kirim bukti sebelum ${formatShort(banner.end_date, true)}.`;
  const action =
    banner.state === "pending" ? "Lihat" : banner.state === "revision" ? "Perbaiki" : "Kirim";
  return (
    <div className="banner warn">
      <AlertTriangle size={16} />
      <span className="mr-auto">
        {text} Tersisa {banner.days_left} hari.
      </span>
      <Link
        to="/presentasi"
        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
      >
        {action}
      </Link>
    </div>
  );
}

/** Kelas baris "Perlu ditindak": seluruh baris bisa diklik langsung ke itemnya. */
const actionRowClass = "action-row hover:bg-muted/40";

export function InternDashboard() {
  const query = useInternDashboard();
  const data = query.data;
  const action = data?.action_needed;
  const totalAction =
    (action?.logbooks.length ?? 0) +
    (action?.warnings.length ?? 0) +
    (action?.corrections.length ?? 0) +
    (action?.leaves.length ?? 0);
  const recap = data?.monthly_recap;
  const quota = data?.leave_quota;

  const panelError = (title: string) =>
    query.isError && (
      <Panel title={title}>
        <div className="px-5 pb-5">
          <ErrorState
            message={query.error instanceof ApiError ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        </div>
      </Panel>
    );

  return (
    <div className="grid gap-5">
      {data?.presentation_banner && <PresentationBanner banner={data.presentation_banner} />}
      {data?.logbook_reminder && (
        <div className="banner info">
          <AlertTriangle size={16} />
          Logbook hari ini belum diisi. Isi di kartu Hari Ini; terkirim otomatis saat clock out.
        </div>
      )}
      <div className="dashboard-grid">
        <TodayCard />
        <div className="grid gap-5 content-start">
          {query.isPending ? (
            <Panel title="Perlu ditindak">
              <LoadingState />
            </Panel>
          ) : query.isError ? (
            panelError("Perlu ditindak")
          ) : (
            totalAction > 0 && (
              <Panel
                title={`Perlu ditindak (${totalAction})`}
                subtitle="Klik baris untuk membuka itemnya."
                className="action-box"
              >
                <div className="action-list">
                  {action?.logbooks.map((item) => (
                    <Link
                      key={`logbook-${item.date}`}
                      to="/logbook"
                      search={{ date: item.date }}
                      className={actionRowClass}
                    >
                      <strong>Logbook</strong>
                      <span className="truncate">
                        {item.logbook_state === "revision" ? "Perlu revisi" : "Belum diisi"}
                      </span>
                      <span className={`meta ${item.logbook_state === "revision" ? "warn" : ""}`}>
                        {formatShort(item.date)}
                      </span>
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                  {action?.warnings.map((item) => (
                    <Link key={`warning-${item.id}`} to="/catatan" className={actionRowClass}>
                      <strong>Warning</strong>
                      <span className="truncate">Catatan baru dari admin</span>
                      <span className="meta warn">
                        {item.created_at ? formatShort(item.created_at) : ""}
                      </span>
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                  {action?.corrections.map((item) => (
                    <Link
                      key={`correction-${item.id}`}
                      to="/absensi"
                      search={{ tab: "koreksi", open: String(item.id) }}
                      className={actionRowClass}
                    >
                      <strong>Koreksi</strong>
                      <span className="truncate">
                        {labelOf(CORRECTION_STATUS_LABEL, item.status)}
                      </span>
                      <span className="meta">{formatShort(item.date)}</span>
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                  {action?.leaves.map((item) => (
                    <Link
                      key={`leave-${item.id}`}
                      to="/izin"
                      search={{ open: String(item.id) }}
                      className={actionRowClass}
                    >
                      <strong>Izin</strong>
                      <span className="truncate">
                        {labelOf(LEAVE_TYPE_LABEL, item.type)} ·{" "}
                        {labelOf(LEAVE_STATUS_LABEL, item.status)}
                      </span>
                      <span className="meta">{formatShort(item.start_date)}</span>
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                </div>
              </Panel>
            )
          )}

          {query.isPending ? (
            <Panel title="Rekap bulan ini">
              <LoadingState />
            </Panel>
          ) : query.isError ? (
            panelError("Rekap bulan ini")
          ) : (
            data &&
            recap && (
              <Panel
                title={`Rekap bulan ini (${formatMonth(recap.month)})`}
                subtitle="Status final. Hari berjalan belum dihitung sampai lewat 23:59."
              >
                <div className="recap-grid">
                  <Link
                    to="/absensi"
                    search={{ tab: "riwayat", status: "present" }}
                    className="contents"
                  >
                    <Metric label="Hadir" value={recap.present} tone="green" />
                  </Link>
                  <Link
                    to="/absensi"
                    search={{ tab: "riwayat", status: "late" }}
                    className="contents"
                  >
                    <Metric label="Terlambat" value={recap.late} tone="red" />
                  </Link>
                  <Link
                    to="/absensi"
                    search={{ tab: "riwayat", status: "missed_clock_in" }}
                    className="contents"
                  >
                    <Metric label="Lupa Clock In" value={recap.missed_clock_in} tone="orange" />
                  </Link>
                  <Link
                    to="/absensi"
                    search={{ tab: "riwayat", status: "leave" }}
                    className="contents"
                  >
                    <Metric label="Izin" value={recap.leave} tone="blue" />
                  </Link>
                  <Link
                    to="/absensi"
                    search={{ tab: "riwayat", status: "absent" }}
                    className="contents"
                  >
                    <Metric label="Tidak Hadir" value={recap.absent} tone="red" />
                  </Link>
                  <Link
                    to="/absensi"
                    search={{ tab: "riwayat", status: "missed_clock_out" }}
                    className="contents"
                  >
                    <Metric label="Lupa Clock Out" value={recap.missed_clock_out} tone="orange" />
                  </Link>
                </div>
                <div className="info-line px-5 py-4">
                  <span>Hari kerja berjalan: {recap.working_days}</span>
                  {quota && (
                    <span>
                      Sisa kuota izin: {quota.remaining} dari {quota.limit}
                      {quota.exhausted ? " · Kuota habis" : ""}
                    </span>
                  )}
                </div>
              </Panel>
            )
          )}

          {data && (
            <div className="info-line">
              <span>
                Periode magang:{" "}
                {data.internship
                  ? formatPeriod(data.internship.start_date, data.internship.end_date)
                  : "-"}
              </span>
              <span>Mentor: {data.internship?.mentor.name ?? "-"}</span>
            </div>
          )}
          {data && <AnnouncementList items={data.announcements} />}
        </div>
      </div>
    </div>
  );
}

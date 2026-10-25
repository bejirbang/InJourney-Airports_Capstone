import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, MapPin, Pencil, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TODAY,
  distanceMeters,
  formatDate,
  formatDateLong,
  formatShortTime,
  locationMessage,
  validateReport,
} from "@/lib/mock-rules";
import {
  ApiError,
  attendanceApi,
  getToken,
  type ApiTodayState,
  type DailyReportData,
  type GeoPosition,
  type OfficeInfo,
} from "@/lib/api";
import { type PageSearch } from "@/lib/search";
import { CorrectionTab } from "@/components/internspace/intern/correction";
import { AttendanceMap } from "@/components/internspace/intern/attendance-map";
import { DayDetail, RecapStrip } from "@/components/internspace/shared/attendance-parts";
import { ME, type Row, recap, useMock } from "@/components/internspace/shared/model";
import {
  DetailList,
  Empty,
  FormError,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Intern ----------
type InternTab = "hari-ini" | "riwayat" | "koreksi";

export function InternAttendance() {
  const search = useSearch({ strict: false }) as PageSearch;
  const [tab, setTab] = useState<InternTab>("hari-ini");
  const [correctionDate, setCorrectionDate] = useState<string | null>(null);
  useEffect(() => {
    if (search.tab === "riwayat" || search.tab === "koreksi" || search.tab === "hari-ini")
      setTab(search.tab);
  }, [search.tab]);
  return (
    <>
      <PageHeading
        title="Presensi"
        subtitle="Clock in, Daily Report, clock out, riwayat, dan koreksi presensi."
      />
      <Tabs
        label="Bagian presensi"
        value={tab}
        onChange={setTab}
        items={[
          { value: "hari-ini", label: "Hari Ini" },
          { value: "riwayat", label: "Riwayat" },
          { value: "koreksi", label: "Koreksi" },
        ]}
      />
      {tab === "hari-ini" && (
        <div className="grid gap-5 max-w-3xl">
          <TodayCard large />
          <DailyReportCard focus={search.open === "report"} />
        </div>
      )}
      {tab === "riwayat" && (
        <History
          onCorrect={(date) => {
            setCorrectionDate(date);
            setTab("koreksi");
          }}
        />
      )}
      {tab === "koreksi" && (
        <CorrectionTab presetDate={correctionDate} onPresetUsed={() => setCorrectionDate(null)} />
      )}
    </>
  );
}

function useLiveClock() {
  // Dimulai setelah mount agar teks server dan browser sama saat hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return "--:--:--";
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

const internToken = (): string => {
  const token = getToken();
  if (!token) throw new ApiError("Sesi Anda sudah berakhir. Silakan masuk lagi.", 401);
  return token;
};

const EMPTY_OFFICES: OfficeInfo[] = [];

/** Status hari ini dari API: dipakai kartu Hari Ini, Daily Report, dan banner dashboard intern. */
export function useTodayStatus() {
  return useQuery({
    queryKey: ["intern", "today"],
    queryFn: () => attendanceApi.dashboard(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

function useOffices() {
  return useQuery({
    queryKey: ["intern", "offices"],
    queryFn: () => attendanceApi.offices(internToken()),
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

function useDailyReport() {
  return useQuery({
    queryKey: ["intern", "daily-report"],
    queryFn: () => attendanceApi.dailyReport(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

const STATE_LABEL: Record<ApiTodayState, string> = {
  not_clocked_in: "Belum Clock In",
  clocked_in: "Sudah Clock In",
  clocked_out: "Sudah Clock Out",
  holiday: "Libur",
  on_leave: "Izin",
  outside_period: "Di luar periode",
};

type GeoState = "idle" | "membaca" | "siap" | "ditolak" | "gagal";

const nearestOffice = (list: OfficeInfo[], p: GeoPosition): OfficeInfo =>
  [...list].sort(
    (a, b) =>
      distanceMeters(p, { lat: a.latitude, lng: a.longitude }) -
      distanceMeters(p, { lat: b.latitude, lng: b.longitude }),
  )[0] ?? list[0]!;

const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

/**
 * Kotak lokasi untuk tombol Clock In/Clock Out: pilih kantor, lihat peta radius dan
 * perkiraan jarak dari GPS browser. Angka di sini hanya perkiraan; server yang memutuskan.
 */
function GeoBox({
  kind,
  offices,
  officeId,
  onOfficeChange,
  position,
  geo,
  onRetry,
}: {
  kind: "in" | "out";
  offices: OfficeInfo[];
  officeId: number | null;
  onOfficeChange: (id: number) => void;
  position: GeoPosition | null;
  geo: GeoState;
  onRetry: () => void;
}) {
  const selected = offices.find((o) => o.id === officeId) ?? offices[0] ?? null;
  const radius = selected
    ? kind === "in"
      ? selected.clock_in_radius_meters
      : selected.clock_out_radius_meters
    : 0;
  const officePoint = useMemo(
    () => (selected ? { lat: selected.latitude, lng: selected.longitude } : null),
    [selected],
  );
  const distance =
    position && selected
      ? Math.round(distanceMeters(position, { lat: selected.latitude, lng: selected.longitude }))
      : null;
  return (
    <div className="geo-box">
      <label className="form-field">
        Kantor
        <select
          aria-label="Kantor untuk presensi"
          value={selected?.id ?? ""}
          onChange={(e) => onOfficeChange(Number(e.target.value))}
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <AttendanceMap office={officePoint} radius={radius} user={position} />
      {geo === "ditolak" ? (
        <div className="geo-denied" role="alert">
          <strong>{locationMessage("ditolak", kind)}</strong>
          <p>
            Cara mengaktifkan: klik ikon gembok di bilah alamat, pilih Setelan situs, ubah Lokasi
            menjadi Izinkan, lalu tekan Coba lagi. Firefox: Pengaturan → Privasi &amp; Keamanan →
            Setelan Situs → Lokasi.
          </p>
          <div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCw />
              Coba lagi
            </Button>
          </div>
        </div>
      ) : geo === "gagal" ? (
        <div className="loc-error" role="alert">
          <span>{locationMessage("gagal", kind)}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      ) : geo === "siap" && distance !== null && selected ? (
        <div className="geo-distance">
          <span>
            Jarak ke {selected.name}: <strong>{formatDistance(distance)}</strong> · radius clock{" "}
            {kind} {radius} m
          </span>
          <Status
            status={distance <= radius ? "Aktif" : "Ditolak"}
            label={distance <= radius ? "Perkiraan dalam radius" : "Perkiraan di luar radius"}
          />
        </div>
      ) : (
        <p className="attendance-note">
          <MapPin size={11} />
          Membaca lokasi dari browser...
        </p>
      )}
      <p className="attendance-note">
        <MapPin size={11} />
        Perkiraan di atas dihitung di browser; keputusan lokasi ada di server.
      </p>
    </div>
  );
}

/** Kartu Hari Ini (dipakai di Dashboard dan tab Hari Ini). Tabel kondisi: design-intern.md 4.3. */
export function TodayCard({ large = false }: { large?: boolean }) {
  const navigate = useNavigate();
  const clockText = useLiveClock();
  const queryClient = useQueryClient();
  const todayQuery = useTodayStatus();
  const officesQuery = useOffices();
  const today = todayQuery.data?.today;
  const date = todayQuery.data?.date ?? TODAY;
  const offices = officesQuery.data ?? EMPTY_OFFICES;
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [locError, setLocError] = useState<{ kind: "in" | "out"; text: string } | null>(null);
  const [needReport, setNeedReport] = useState(false);
  const [officeId, setOfficeId] = useState<number | null>(null);
  const locatingRef = useRef(false);

  const kind: "in" | "out" = today?.state === "clocked_in" ? "out" : "in";
  const actionable = today?.state === "not_clocked_in" || today?.state === "clocked_in";

  /** Baca GPS browser. `after` dipanggil dengan posisi bila berhasil. */
  const readLocation = useCallback((after?: (p: GeoPosition) => void) => {
    if (locatingRef.current) return;
    if (!("geolocation" in navigator)) {
      setGeo("gagal");
      return;
    }
    locatingRef.current = true;
    setGeo("membaca");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        locatingRef.current = false;
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosition(next);
        setGeo("siap");
        after?.(next);
      },
      (err) => {
        locatingRef.current = false;
        setGeo(err.code === err.PERMISSION_DENIED ? "ditolak" : "gagal");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, []);

  // Minta izin lokasi begitu kartu aksi tampil, supaya peta langsung menunjukkan posisi Anda.
  useEffect(() => {
    if (actionable) readLocation();
  }, [actionable, readLocation]);

  // Kantor terdekat dari posisi Anda; kantor pertama bila posisi belum terbaca.
  useEffect(() => {
    if (offices.length === 0) return;
    setOfficeId((prev) => {
      if (prev !== null && offices.some((o) => o.id === prev)) return prev;
      const first = offices[0];
      if (!first) return prev;
      return position ? nearestOffice(offices, position).id : first.id;
    });
  }, [offices, position]);

  const submit = (action: "in" | "out", p: GeoPosition) => {
    if (busy) return;
    setLocError(null);
    setBusy(action);
    const call = action === "in" ? attendanceApi.clockIn : attendanceApi.clockOut;
    // Token diambil di dalam rantai promise: kalau sesi sudah habis, error-nya
    // masuk ke catch dan tombol tidak menggantung di keadaan "Memeriksa lokasi...".
    void Promise.resolve()
      .then(() => call(internToken(), p))
      .then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: ["intern"] });
        if (action === "in") {
          toast.success(result.message, { description: "Jangan lupa mengisi Daily Report." });
        } else {
          toast.success(result.message);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.reason === "daily_report_missing") setNeedReport(true);
          setLocError({ kind: action, text: err.message });
        } else {
          setLocError({
            kind: action,
            text: "Tidak bisa menghubungi server. Periksa koneksi dan API.",
          });
        }
      })
      .finally(() => setBusy(null));
  };

  const doAction = (action: "in" | "out") => {
    if (busy || locatingRef.current) return;
    setLocError(null);
    readLocation((p) => submit(action, p));
  };

  const errorBox = (action: "in" | "out") =>
    locError?.kind === action && (
      <div className="loc-error" role="alert">
        <span>{locError.text}</span>
        <Button size="sm" variant="outline" onClick={() => doAction(action)}>
          Coba lagi
        </Button>
      </div>
    );

  const statusLine = !today
    ? "Memuat status hari ini..."
    : today.state === "clocked_out"
      ? `Hadir, clock out ${today.clock_out_at ?? ""}`
      : today.state === "holiday"
        ? `Hari ini libur: ${today.holiday_name ?? "akhir pekan"}`
        : today.state === "on_leave"
          ? `Izin hari ini (${today.leave_type === "sick" ? "sakit" : "urgent"})`
          : today.state === "outside_period"
            ? "Di luar periode magang."
            : STATE_LABEL[today.state];

  return (
    <section className={`panel today-card ${large ? "large" : ""}`}>
      <header className="panel-head">
        <div>
          <h2>Hari Ini</h2>
          <p>{formatDateLong(date)}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Jam kerja:{" "}
          {today?.work_hours ? `${today.work_hours.start} - ${today.work_hours.end}` : "Belum diatur"}
        </span>
      </header>
      <div className="attendance-body">
        {large && <div className="time-display">{clockText}</div>}
        {todayQuery.isPending && (
          <p className="attendance-note">Memuat status hari ini dari server...</p>
        )}
        {todayQuery.isError && (
          <div className="loc-error" role="alert">
            <span>
              {todayQuery.error instanceof ApiError
                ? todayQuery.error.message
                : "Tidak bisa memuat status hari ini."}
            </span>
            <Button size="sm" variant="outline" onClick={() => void todayQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        )}
        {today && (
          <>
            <div className="attendance-state">
              <span>Status</span>
              <Status
                status={today.state === "clocked_out" ? "Hadir" : STATE_LABEL[today.state]}
                label={statusLine}
              />
            </div>
            {(today.clock_in_at || today.clock_out_at) && (
              <div className="clock-times">
                <div>
                  <small>Clock in</small>
                  <strong>{today.clock_in_at ?? "--:--"}</strong>
                </div>
                <div>
                  <small>Clock out</small>
                  <strong>{today.clock_out_at ?? "--:--"}</strong>
                </div>
              </div>
            )}
            {officesQuery.isError &&
              (today.state === "not_clocked_in" || today.state === "clocked_in") && (
                <div className="loc-error" role="alert">
                  <span>
                    {officesQuery.error instanceof ApiError
                      ? officesQuery.error.message
                      : "Gagal memuat daftar kantor."}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void officesQuery.refetch()}>
                    Coba lagi
                  </Button>
                </div>
              )}
            {today.state === "not_clocked_in" && (
              <>
                {offices.length > 0 && (
                  <GeoBox
                    kind="in"
                    offices={offices}
                    officeId={officeId}
                    onOfficeChange={setOfficeId}
                    position={position}
                    geo={geo}
                    onRetry={() => readLocation()}
                  />
                )}
                <Button
                  className="clock-button"
                  onClick={() => doAction("in")}
                  disabled={
                    !!busy ||
                    geo === "membaca" ||
                    !today.has_active_office ||
                    officesQuery.isPending
                  }
                >
                  <LogIn />
                  {busy === "in"
                    ? "Memeriksa lokasi..."
                    : geo === "membaca"
                      ? "Membaca lokasi..."
                      : "Clock In"}
                </Button>
                {!today.has_active_office ? (
                  <div className="loc-error" role="alert">
                    <span>{locationMessage("tanpa-kantor", "in")}</span>
                  </div>
                ) : (
                  errorBox("in") || (
                    <p className="attendance-note">
                      <MapPin size={11} />
                      Lokasi Anda diperiksa server saat tombol ditekan.
                    </p>
                  )
                )}
              </>
            )}
            {today.state === "clocked_in" && (
              <>
                {!today.daily_report_sent ? (
                  <>
                    <Button className="clock-button" disabled>
                      <LogOut />
                      Clock Out
                    </Button>
                    <div className="banner warn">
                      <span className="mr-auto">Isi Daily Report dulu sebelum clock out.</span>
                      <Button
                        size="sm"
                        onClick={() =>
                          void navigate({
                            to: "/absensi",
                            search: { tab: "hari-ini", open: "report" },
                          })
                        }
                      >
                        Isi Daily Report
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {offices.length > 0 && (
                      <GeoBox
                        kind="out"
                        offices={offices}
                        officeId={officeId}
                        onOfficeChange={setOfficeId}
                        position={position}
                        geo={geo}
                        onRetry={() => readLocation()}
                      />
                    )}
                    <Button
                      className="clock-button"
                      onClick={() => doAction("out")}
                      disabled={
                        !!busy ||
                        geo === "membaca" ||
                        !today.has_active_office ||
                        officesQuery.isPending
                      }
                    >
                      <LogOut />
                      {busy === "out"
                        ? "Memeriksa lokasi..."
                        : geo === "membaca"
                          ? "Membaca lokasi..."
                          : "Clock Out"}
                    </Button>
                    {!today.has_active_office ? (
                      <div className="loc-error" role="alert">
                        <span>{locationMessage("tanpa-kantor", "out")}</span>
                      </div>
                    ) : (
                      errorBox("out") || (
                        <p className="attendance-note">
                          <MapPin size={11} />
                          Lokasi diperiksa lagi saat clock out (radius clock out).
                        </p>
                      )
                    )}
                  </>
                )}
              </>
            )}
            {(today.state === "holiday" ||
              today.state === "on_leave" ||
              today.state === "outside_period") && <p className="attendance-note">{statusLine}</p>}
          </>
        )}
      </div>
      <Dialog open={needReport} onOpenChange={setNeedReport}>
        <DialogContent className="max-w-md">
          <DialogTitle>Daily Report belum dikirim</DialogTitle>
          <DialogDescription>Isi Daily Report dulu sebelum clock out.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeedReport(false)}>
              Nanti
            </Button>
            <Button
              onClick={() => {
                setNeedReport(false);
                void navigate({ to: "/absensi", search: { tab: "hari-ini", open: "report" } });
              }}
            >
              Isi Daily Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DailyReportCard({ focus }: { focus: boolean }) {
  const queryClient = useQueryClient();
  const todayQuery = useTodayStatus();
  const reportQuery = useDailyReport();
  const today = todayQuery.data?.today;
  const date = todayQuery.data?.date ?? TODAY;
  const report: DailyReportData | null = reportQuery.data ?? null;
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [work, setWork] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  // Form mengikuti laporan terbaru dari server (struktur identik dijaga react-query).
  useEffect(() => {
    if (report) {
      setWork(report.work);
      setNotes(report.notes ?? "");
    }
  }, [report]);

  const state = today?.state;
  const sent = report !== null;
  const locked = report !== null && !report.editable;
  const save = (e: FormEvent) => {
    e.preventDefault();
    const err = validateReport(work);
    setError(err);
    if (err) return;
    setBusy(true);
    attendanceApi
      .saveDailyReport(internToken(), { work: work.trim(), notes: notes.trim() })
      .then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: ["intern"] });
        setEditing(false);
        toast.success(result.message);
      })
      .catch((saveErr: unknown) => {
        setError(
          saveErr instanceof ApiError
            ? saveErr.message
            : "Tidak bisa menghubungi server. Periksa koneksi dan API.",
        );
      })
      .finally(() => setBusy(false));
  };
  return (
    <section className="panel" ref={ref}>
      <header className="panel-head">
        <div>
          <h2>Daily Report - {formatDate(date)}</h2>
          <p>Laporan tentang apa yang Anda kerjakan hari ini. Berbeda dari Task.</p>
        </div>
        {(state === "clocked_in" || state === "clocked_out") && (
          <Status status={sent ? "Terkirim" : "Belum dikirim"} />
        )}
      </header>
      <div className="px-5 pb-5">
        {todayQuery.isPending || reportQuery.isPending ? (
          <p className="text-[11px] text-muted-foreground">Memuat laporan hari ini...</p>
        ) : state === "not_clocked_in" ? (
          <Empty>Clock in dulu untuk mengisi Daily Report.</Empty>
        ) : state === "holiday" || state === "on_leave" || state === "outside_period" ? (
          <Empty>Tidak ada Daily Report hari ini.</Empty>
        ) : (state === "clocked_in" || state === "clocked_out") && sent && !editing ? (
          <div className="grid gap-3">
            <DetailList
              items={[
                ["Yang saya kerjakan", report?.work],
                ["Kendala atau catatan", report?.notes || "-"],
                ["Terakhir disimpan", formatShortTime(report?.sent_at ?? "")],
              ]}
            />
            {locked ? (
              <p className="text-[11px] text-muted-foreground">
                Laporan terkunci setelah clock out.
              </p>
            ) : (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil />
                  Ubah
                </Button>
              </div>
            )}
          </div>
        ) : (state === "clocked_in" || state === "clocked_out") && !reportQuery.isError ? (
          <form className="form-grid" onSubmit={save}>
            <label className="form-field">
              Yang saya kerjakan hari ini *
              <textarea value={work} onChange={(e) => setWork(e.target.value)} />
            </label>
            <label className="form-field">
              Kendala atau catatan (opsional)
              <textarea
                className="!min-h-16"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <FormError text={error} />
            <div className="form-actions">
              <span className="text-[11px] text-muted-foreground mr-auto">
                Dapat diubah sampai Anda clock out.
              </span>
              {editing && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Batal
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan Laporan"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {reportQuery.error instanceof ApiError
              ? reportQuery.error.message
              : "Tidak bisa memuat Daily Report."}
          </p>
        )}
      </div>
    </section>
  );
}

export function History({ onCorrect }: { onCorrect: (date: string) => void }) {
  const m = useMock();
  const start = m.me.start ?? TODAY;
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [detail, setDetail] = useState<Row | null>(null);
  const rows = m.rowsFor(ME.Intern, `${month}-01`, `${month}-31`);
  const r = recap(rows);
  return (
    <Panel
      title="Riwayat presensi"
      subtitle="Status ditetapkan otomatis setelah 23:59. Hari ini masih berjalan."
      action={
        <MonthNav
          value={month}
          onChange={setMonth}
          min={start.slice(0, 7)}
          max={TODAY.slice(0, 7)}
        />
      }
    >
      <RecapStrip r={r} />
      {rows.length === 0 ? (
        <Empty>Belum ada data presensi pada bulan ini.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table clickable">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
                <th>Daily Report</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.status === "Libur" ? (
                  <tr key={row.date} className="muted-row">
                    <td>{formatDate(row.date)}</td>
                    <td colSpan={5}>
                      <Status status="Libur" />{" "}
                      <span className="ml-2">{row.holiday ?? "Akhir pekan"}</span>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.date}
                    onClick={() => setDetail(row)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setDetail(row)}
                  >
                    <td>{formatDate(row.date)}</td>
                    <td>{row.clockIn || "-"}</td>
                    <td>{row.clockOut || "-"}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <Status status={row.status} />
                        {row.corrected && <Tag>Dikoreksi admin</Tag>}
                      </div>
                    </td>
                    <td>{row.report ? <Status status="Terkirim" /> : "-"}</td>
                    <td>
                      {row.date < TODAY && row.status !== "Izin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCorrect(row.date);
                          }}
                        >
                          Koreksi
                        </Button>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      <DayDetail row={detail} onClose={() => setDetail(null)} />
    </Panel>
  );
}

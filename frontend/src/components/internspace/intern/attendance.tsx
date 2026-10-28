import { useSearch } from "@tanstack/react-router";
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
import { ApiError } from "@/lib/api";
import {
  ATTENDANCE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  LOGBOOK_STATUS_LABEL,
  labelOf,
} from "@/lib/labels";
import { TODAY, distanceMeters, formatDate, formatDateLong, locationMessage } from "@/lib/utils";
import type {
  ApiAttendanceDay,
  ApiAttendanceFilter,
  ApiTodayState,
  GeoPosition,
  OfficeInfo,
} from "@/lib/endpoints/intern";
import { type PageSearch } from "@/lib/search";
import { CorrectionTab } from "@/components/internspace/intern/correction";
import { AttendanceMap } from "@/components/internspace/intern/attendance-map";
import {
  useAttendanceDay,
  useAttendanceHistory,
  useClockIn,
  useClockOut,
  useOffices,
  useTodayStatus,
} from "@/components/internspace/intern/attendance-data";
import { useSaveLogbook } from "@/components/internspace/intern/logbook-data";
import { ApiDayDetail, ApiRecapStrip } from "@/components/internspace/shared/attendance-parts";
import {
  DetailList,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  MonthNav,
  PageHeading,
  Panel,
  Status,
  Tabs,
  Tag,
} from "@/components/internspace/shared/ui";

// ---------- Intern (design-intern.md Alur 3-6) ----------
type InternTab = "hari-ini" | "riwayat" | "koreksi";

export function InternAttendance() {
  const search = useSearch({ strict: false }) as PageSearch;
  const [tab, setTab] = useState<InternTab>("hari-ini");
  const [correctionDate, setCorrectionDate] = useState<string | null>(
    search.tab === "koreksi" ? (search.date ?? null) : null,
  );
  useEffect(() => {
    if (search.tab === "riwayat" || search.tab === "koreksi" || search.tab === "hari-ini")
      setTab(search.tab);
  }, [search.tab]);
  // Tautan dari halaman Logbook membawa ?tab=koreksi&date=YYYY-MM-DD untuk mengisi tanggal.
  useEffect(() => {
    if (search.tab === "koreksi" && search.date) setCorrectionDate(search.date);
  }, [search.tab, search.date]);
  return (
    <>
      <PageHeading
        title="Presensi"
        subtitle="Clock in, logbook, clock out, riwayat, dan koreksi presensi."
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

const EMPTY_OFFICES: OfficeInfo[] = [];

const STATE_LABEL: Record<ApiTodayState, string> = {
  not_clocked_in: "Belum Clock In",
  clocked_in: "Sudah Clock In",
  clocked_out: "Sudah Clock Out",
  missed_clock_in: "Lupa Clock In",
  holiday: "Libur",
  on_leave: "Izin",
  outside_period: "Di luar periode",
};

type GeoState = "idle" | "membaca" | "siap" | "ditolak" | "gagal";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

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
  const clockText = useLiveClock();
  const todayQuery = useTodayStatus();
  const officesQuery = useOffices();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const saveLogbook = useSaveLogbook();
  const today = todayQuery.data?.today;
  const date = todayQuery.data?.date ?? TODAY;
  const offices = officesQuery.data ?? EMPTY_OFFICES;
  const [geo, setGeo] = useState<GeoState>("idle");
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [locError, setLocError] = useState<{ kind: "in" | "out"; text: string } | null>(null);
  const [officeId, setOfficeId] = useState<number | null>(null);
  const [work, setWork] = useState("");
  const [notes, setNotes] = useState("");
  const [editingLogbook, setEditingLogbook] = useState(false);
  const [logbookError, setLogbookError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogWork, setDialogWork] = useState("");
  const [dialogNotes, setDialogNotes] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const locatingRef = useRef(false);

  const kind: "in" | "out" =
    today?.state === "clocked_in" || today?.state === "missed_clock_in" ? "out" : "in";
  const actionable =
    today?.state === "not_clocked_in" ||
    today?.state === "clocked_in" ||
    today?.state === "missed_clock_in";

  /**
   * Baca GPS browser. `after` dipanggil dengan posisi bila berhasil; `onFail` menerima
   * keadaan gagal agar dialog logbook bisa menampilkan pesannya sendiri.
   */
  const readLocation = useCallback(
    (after?: (p: GeoPosition) => void, onFail?: (state: "ditolak" | "gagal") => void) => {
      if (locatingRef.current) return;
      if (!("geolocation" in navigator)) {
        setGeo("gagal");
        onFail?.("gagal");
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
          const state = err.code === err.PERMISSION_DENIED ? "ditolak" : "gagal";
          setGeo(state);
          onFail?.(state);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    },
    [],
  );

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

  // Isian mengikuti logbook terbaru dari server (draft hari ini).
  useEffect(() => {
    if (!today?.logbook) return;
    setWork(today.logbook.work);
    setNotes(today.logbook.notes ?? "");
  }, [today?.logbook]);

  const doClockIn = () => {
    if (clockIn.isPending || locatingRef.current) return;
    setLocError(null);
    readLocation((p) => {
      clockIn.mutate(p, {
        onSuccess: (result) => toast.success(result.message),
        onError: (err) =>
          setLocError({
            kind: "in",
            text: errorText(err, "Clock in belum tercatat. Periksa koneksi lalu coba lagi."),
          }),
      });
    });
  };

  const clockOutNow = (p: GeoPosition, input?: { work?: string; notes?: string | null }) => {
    const fromDialog = dialogOpen;
    clockOut.mutate(
      {
        position: p,
        ...(input?.work === undefined ? {} : { work: input.work }),
        ...(input?.notes === undefined ? {} : { notes: input.notes }),
      },
      {
        onSuccess: (result) => {
          setLocError(null);
          setDialogError(null);
          setDialogOpen(false);
          toast.success(result.message);
        },
        onError: (err) => {
          const text = errorText(err, "Clock out belum tercatat. Periksa koneksi lalu coba lagi.");
          // Server menolak karena logbook belum ada: buka dialog isian logbook.
          const needsLogbook = err instanceof ApiError && err.reason === "logbook_missing";
          if (fromDialog || needsLogbook) setDialogError(text);
          else setLocError({ kind: "out", text });
          if (needsLogbook) {
            setDialogWork((current) => current || work);
            setDialogNotes((current) => current || notes);
            setDialogOpen(true);
          }
        },
      },
    );
  };

  const startClockOut = () => {
    if (!today || clockOut.isPending || locatingRef.current) return;
    setLocError(null);
    // Sudah ada isian logbook (draft) → server mengirimkannya otomatis saat clock out.
    if (today.logbook !== null) {
      readLocation((p) => clockOutNow(p));
      return;
    }
    setDialogError(null);
    setDialogWork(work);
    setDialogNotes(notes);
    setDialogOpen(true);
  };

  const submitDialog = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = dialogWork.trim();
    if (!trimmed) {
      setDialogError("Isi apa yang Anda kerjakan hari ini.");
      return;
    }
    setDialogError(null);
    readLocation(
      (p) => clockOutNow(p, { work: trimmed, notes: dialogNotes.trim() || null }),
      (state) => setDialogError(locationMessage(state, "out")),
    );
  };

  const submitLogbook = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = work.trim();
    if (!trimmed) {
      setLogbookError("Isi apa yang Anda kerjakan hari ini.");
      return;
    }
    setLogbookError(null);
    saveLogbook.mutate(
      { date, work: trimmed, notes: notes.trim() || null },
      {
        onSuccess: (result) => {
          setEditingLogbook(false);
          toast.success(result.message);
        },
        onError: (err) =>
          setLogbookError(
            errorText(err, "Logbook belum tersimpan. Isian Anda tidak hilang, coba lagi."),
          ),
      },
    );
  };

  const errorBox = (action: "in" | "out") =>
    locError?.kind === action && (
      <div className="loc-error" role="alert">
        <span>{locError.text}</span>
        <Button size="sm" variant="outline" onClick={action === "in" ? doClockIn : startClockOut}>
          Coba lagi
        </Button>
      </div>
    );

  const statusLine = !today
    ? "Memuat status hari ini..."
    : today.state === "clocked_out"
      ? today.status === "missed_clock_in"
        ? `Selesai. Clock out ${today.clock_out_at ?? "-"} (Lupa Clock In).`
        : `Selesai. Clock out ${today.clock_out_at ?? "-"}.${
            today.logbook?.status === "pending_review" ? " Logbook menunggu review mentor." : ""
          }`
      : today.state === "clocked_in"
        ? `Hadir sejak ${today.clock_in_at ?? "-"}.${
            today.can_clock_out
              ? " Silakan clock out."
              : today.clock_out_from
                ? ` Clock out mulai ${today.clock_out_from}.`
                : ""
          }`
        : today.state === "missed_clock_in"
          ? "Anda belum clock in hari ini. Hari ini akan tercatat Lupa Clock In."
          : today.state === "holiday"
            ? `Hari ini libur: ${today.holiday_name ?? "akhir pekan"}.`
            : today.state === "on_leave"
              ? `Izin hari ini (${labelOf(LEAVE_TYPE_LABEL, today.leave_type)}).`
              : today.state === "outside_period"
                ? "Di luar periode magang."
                : STATE_LABEL[today.state];

  const badge = today
    ? today.status
      ? labelOf(ATTENDANCE_STATUS_LABEL, today.status)
      : STATE_LABEL[today.state]
    : "";
  const hasLogbook = today?.logbook !== null && today?.logbook !== undefined;

  return (
    <section className={`panel today-card ${large ? "large" : ""}`}>
      <header className="panel-head">
        <div>
          <h2>Hari Ini</h2>
          <p>{formatDateLong(date)}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Jam kerja:{" "}
          {today?.schedule ? `${today.schedule.start} - ${today.schedule.end}` : "Belum diatur"}
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
              <Status status={badge} label={statusLine} />
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
            {today.state === "clocked_in" && today.late_minutes !== null && (
              <p className="attendance-note">Terlambat {today.late_minutes} menit.</p>
            )}
            {officesQuery.isError &&
              (today.state === "not_clocked_in" ||
                today.state === "clocked_in" ||
                today.state === "missed_clock_in") && (
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
                  onClick={doClockIn}
                  disabled={
                    clockIn.isPending ||
                    geo === "membaca" ||
                    !today.has_active_office ||
                    officesQuery.isPending
                  }
                >
                  <LogIn />
                  {clockIn.isPending
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
              <div className="grid gap-3">
                {hasLogbook && !editingLogbook ? (
                  <>
                    <DetailList
                      items={[
                        ["Yang saya kerjakan", today.logbook?.work],
                        ["Kendala atau catatan", today.logbook?.notes || "-"],
                        [
                          "Status",
                          <Status
                            key="logbook-status"
                            status={labelOf(LOGBOOK_STATUS_LABEL, today.logbook?.status)}
                          />,
                        ],
                      ]}
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => setEditingLogbook(true)}>
                        <Pencil />
                        Ubah Logbook
                      </Button>
                    </div>
                  </>
                ) : (
                  <form className="form-grid" onSubmit={submitLogbook}>
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
                    <FormError text={logbookError} />
                    <div className="form-actions">
                      <span className="text-[11px] text-muted-foreground mr-auto">
                        Terkirim otomatis ke mentor saat clock out.
                      </span>
                      {editingLogbook && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingLogbook(false);
                            setLogbookError(null);
                          }}
                        >
                          Batal
                        </Button>
                      )}
                      <Button type="submit" disabled={saveLogbook.isPending}>
                        {saveLogbook.isPending ? "Menyimpan..." : "Simpan Logbook"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {(today.state === "clocked_in" || today.state === "missed_clock_in") && (
              <>
                {today.state === "missed_clock_in" && (
                  <div className="banner warn">
                    Anda belum clock in hari ini. Hari ini akan tercatat Lupa Clock In. Ajukan
                    koreksi presensi jika perlu.
                  </div>
                )}
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
                  onClick={startClockOut}
                  disabled={
                    clockOut.isPending ||
                    geo === "membaca" ||
                    !today.has_active_office ||
                    !today.can_clock_out ||
                    officesQuery.isPending
                  }
                >
                  <LogOut />
                  {clockOut.isPending
                    ? "Memproses..."
                    : geo === "membaca"
                      ? "Membaca lokasi..."
                      : "Clock Out"}
                </Button>
                {!today.has_active_office ? (
                  <div className="loc-error" role="alert">
                    <span>{locationMessage("tanpa-kantor", "out")}</span>
                  </div>
                ) : !today.can_clock_out ? (
                  // Server menolak clock out sebelum jam pulang; tunjukkan jam acuannya.
                  <p className="attendance-note">
                    <MapPin size={11} />
                    Clock out bisa dilakukan mulai {today.clock_out_from ?? "jam pulang"}.
                  </p>
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
            {(today.state === "holiday" ||
              today.state === "on_leave" ||
              today.state === "outside_period") && <p className="attendance-note">{statusLine}</p>}
          </>
        )}
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o && !clockOut.isPending) setDialogOpen(false);
        }}
      >
        <DialogContent>
          <DialogTitle>Isi Logbook Sebelum Clock Out</DialogTitle>
          <DialogDescription>
            Logbook terkirim otomatis ke mentor saat clock out. Satu logbook per hari.
          </DialogDescription>
          <form className="form-grid" onSubmit={submitDialog}>
            <label className="form-field">
              Yang saya kerjakan hari ini *
              <textarea
                value={dialogWork}
                onChange={(e) => setDialogWork(e.target.value)}
                autoFocus
              />
            </label>
            <label className="form-field">
              Kendala atau catatan (opsional)
              <textarea
                className="!min-h-16"
                value={dialogNotes}
                onChange={(e) => setDialogNotes(e.target.value)}
              />
            </label>
            {today?.state === "missed_clock_in" && (
              <p className="banner warn">
                Anda belum clock in hari ini. Hari ini akan tercatat Lupa Clock In.
              </p>
            )}
            <FormError text={dialogError} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={clockOut.isPending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={clockOut.isPending}>
                {clockOut.isPending ? "Mengirim..." : "Kirim & Clock Out"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

const FILTER_OPTIONS: { value: "Semua" | ApiAttendanceFilter; label: string }[] = [
  { value: "Semua", label: "Semua" },
  { value: "present", label: "Hadir" },
  { value: "late", label: "Terlambat" },
  { value: "missed_clock_in", label: "Lupa Clock In" },
  { value: "leave", label: "Izin" },
  { value: "absent", label: "Tidak Hadir" },
  { value: "holiday", label: "Libur" },
  { value: "missed_clock_out", label: "Lupa Clock Out" },
];

/** Kolom Catatan: tanda yang tidak masuk status utama (design-intern.md 8). */
const dayNote = (day: ApiAttendanceDay) => {
  const parts: string[] = [];
  if (day.holiday_name) parts.push(day.holiday_name);
  if (day.late_minutes) parts.push(`Terlambat ${day.late_minutes} menit`);
  if (day.leave_type) parts.push(labelOf(LEAVE_TYPE_LABEL, day.leave_type));
  if (day.missed_clock_out) parts.push("Lupa Clock Out");
  return parts.length > 0 ? parts.join(" · ") : "-";
};

export function History({ onCorrect }: { onCorrect: (date: string) => void }) {
  const search = useSearch({ strict: false }) as PageSearch;
  const todayQuery = useTodayStatus();
  const [month, setMonth] = useState<string | null>(null);
  const [status, setStatus] = useState<"Semua" | ApiAttendanceFilter>(
    FILTER_OPTIONS.find((o) => o.value === search.status)?.value ?? "Semua",
  );
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const activeMonth = month ?? (todayQuery.data?.date ?? TODAY).slice(0, 7);
  // Rekap di dashboard membuka halaman ini dengan `?status=`; ikuti bila nilainya berubah.
  useEffect(() => {
    const next = FILTER_OPTIONS.find((o) => o.value === search.status)?.value;
    if (next) setStatus(next);
  }, [search.status]);
  const historyQuery = useAttendanceHistory({
    month: activeMonth,
    ...(status === "Semua" ? {} : { status }),
  });
  const detailQuery = useAttendanceDay(detailDate);
  const data = historyQuery.data;
  const bounds = data?.selectable_months ?? { first: activeMonth, last: activeMonth };

  const detailError =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : detailQuery.isError
        ? "Detail presensi gagal dimuat."
        : null;

  return (
    <Panel
      title="Riwayat presensi"
      subtitle="Status ditetapkan otomatis setelah 23:59. Hari ini masih berjalan."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="role-select"
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "Semua" | ApiAttendanceFilter)}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Status: {option.label}
              </option>
            ))}
          </select>
          <MonthNav
            value={activeMonth}
            onChange={(ym) => setMonth(ym)}
            min={bounds.first}
            max={bounds.last}
          />
        </div>
      }
    >
      {historyQuery.isPending ? (
        <LoadingState />
      ) : historyQuery.isError ? (
        <ErrorState
          message={historyQuery.error instanceof ApiError ? historyQuery.error.message : undefined}
          onRetry={() => void historyQuery.refetch()}
        />
      ) : (
        <>
          <ApiRecapStrip recap={data!.recap} />
          {data!.days.length === 0 ? (
            <Empty>Belum ada data presensi pada bulan ini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table clickable">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.days.map((day) => (
                    <tr
                      key={day.date}
                      onClick={() => setDetailDate(day.date)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setDetailDate(day.date)}
                    >
                      <td>{formatDate(day.date)}</td>
                      <td>{day.clock_in_at ?? "-"}</td>
                      <td>{day.clock_out_at ?? "-"}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <Status status={labelOf(ATTENDANCE_STATUS_LABEL, day.status)} />
                          {day.is_corrected && <Tag>Dikoreksi</Tag>}
                        </div>
                      </td>
                      <td>{dayNote(day)}</td>
                      <td>
                        {day.can_request_correction ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCorrect(day.date);
                            }}
                          >
                            Koreksi
                          </Button>
                        ) : day.has_active_correction ? (
                          <span className="text-[11px] text-muted-foreground">
                            Menunggu koreksi
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <ApiDayDetail
        date={detailDate}
        day={detailQuery.data ?? null}
        loading={detailQuery.isPending}
        error={detailError}
        onRetry={() => void detailQuery.refetch()}
        onClose={() => setDetailDate(null)}
      />
    </Panel>
  );
}

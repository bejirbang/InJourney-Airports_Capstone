import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, MoreHorizontal, Plus, RotateCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RADIUS_MAX, RADIUS_MIN, formatCoord, validateOffice } from "@/lib/mock-rules";
import type {
  AdminAirport,
  AdminOffice,
  AdminSpecialSchedule,
  WeeklyDay,
  WeeklySet,
} from "@/lib/endpoints/admin";
import { SPECIAL_SCHEDULE_STATE_LABEL, labelOf } from "@/lib/labels";
import { type PageSearch } from "@/lib/search";
import {
  AirportForm,
  WeeklyDaysEditor,
  defaultWeeklyDays,
} from "@/components/internspace/admin/airport-form";
import {
  useAdminAirport,
  useAdminAirports,
  useAdminOffices,
  useCreateOffice,
  useCreateSpecial,
  useDeleteSpecial,
  useSaveWeekly,
  useSpecialSchedules,
  useToggleAirport,
  useToggleOffice,
  useUpdateOffice,
  useUpdateSpecial,
  useWeeklyHistory,
} from "@/components/internspace/admin/locations-data";
import {
  Confirm,
  Empty,
  ErrorState,
  FormError,
  LoadingState,
  PageHeading,
  Panel,
  Status,
  Tabs,
} from "@/components/internspace/shared/ui";
import { errorText, todayIso } from "@/components/internspace/admin/utils";

// Bandara Soekarno-Hatta, titik awal peta saat belum ada pin.
const DEFAULT_CENTER: [number, number] = [-6.1256, 106.6559];

type DetailTab = "offices" | "weekly" | "special";

const detailTab = (value: string | undefined): DetailTab =>
  value === "weekly" || value === "special" ? value : "offices";

// ---------- Lokasi & Jadwal (design-admin.md Bagian 9A) ----------
export function OfficesPage() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const airportsQuery = useAdminAirports();
  const [form, setForm] = useState<AdminAirport | "new" | null>(null);
  const [deactivate, setDeactivate] = useState<AdminAirport | null>(null);
  const toggle = useToggleAirport();

  const openId =
    search.open !== undefined && /^\d+$/.test(search.open) ? Number(search.open) : null;
  const airports = airportsQuery.data ?? [];

  if (openId !== null) {
    return (
      <AirportDetail
        airportId={openId}
        tab={detailTab(search.tab)}
        onTab={(tab) => navigate({ to: "/lokasi-kantor", search: { ...search, tab } })}
        onBack={() =>
          navigate({ to: "/lokasi-kantor", search: { airport_id: search.airport_id ?? "" } })
        }
        onEdit={(airport) => setForm(airport)}
      >
        <AirportForm
          open={form !== null}
          airport={form === "new" ? null : form}
          onClose={() => setForm(null)}
        />
      </AirportDetail>
    );
  }

  return (
    <>
      <PageHeading
        title="Lokasi & Jadwal"
        subtitle="Bandara memiliki titik presensi dan jadwal kerja sendiri. Data tidak dihapus, hanya dinonaktifkan."
        action={
          <Button onClick={() => setForm("new")}>
            <Plus />
            Tambah Bandara
          </Button>
        }
      />
      {airportsQuery.isSuccess && airports.length === 0 ? (
        <Panel title="Daftar bandara">
          <Empty>Belum ada bandara. Tambahkan bandara agar intern bisa clock in.</Empty>
        </Panel>
      ) : (
        <Panel
          title="Daftar bandara"
          subtitle={`${airports.filter((a) => a.is_active).length} aktif`}
        >
          {airportsQuery.isLoading ? (
            <LoadingState />
          ) : airportsQuery.isError ? (
            <ErrorState error={airportsQuery.error} onRetry={() => void airportsQuery.refetch()} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kota</th>
                    <th>Kantor aktif</th>
                    <th>Intern aktif</th>
                    <th>Jadwal berlaku</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {airports.map((airport) => (
                    <tr key={airport.id}>
                      <td className="font-semibold">{airport.name}</td>
                      <td className="text-muted-foreground">{airport.city || "-"}</td>
                      <td>{airport.active_offices}</td>
                      <td>{airport.active_interns}</td>
                      <td className="text-muted-foreground">
                        {airport.weekly_schedule
                          ? `${airport.weekly_schedule.effective_from} · ${airport.weekly_schedule.summary}`
                          : "-"}
                      </td>
                      <td>
                        <Status status={airport.is_active ? "Aktif" : "Nonaktif"} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate({
                                to: "/lokasi-kantor",
                                search: { ...search, open: String(airport.id) },
                              })
                            }
                          >
                            Buka
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Aksi untuk ${airport.name}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setForm(airport)}>
                                Ubah
                              </DropdownMenuItem>
                              {airport.is_active ? (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => setDeactivate(airport)}
                                >
                                  Nonaktifkan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    toggle.mutate(
                                      { id: airport.id, active: true },
                                      {
                                        onSuccess: (body) => toast.success(body.message),
                                        onError: (cause) =>
                                          toast.error(
                                            errorText(cause, "Bandara gagal diaktifkan."),
                                          ),
                                      },
                                    )
                                  }
                                >
                                  Aktifkan
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <AirportForm
        open={form !== null}
        airport={form === "new" ? null : form}
        onClose={() => setForm(null)}
        onCreated={(airport) =>
          navigate({ to: "/lokasi-kantor", search: { ...search, open: String(airport.id) } })
        }
      />
      <Confirm
        open={deactivate !== null}
        title={`Nonaktifkan ${deactivate?.name ?? ""}?`}
        confirmLabel="Nonaktifkan"
        destructive
        disabled={toggle.isPending}
        onClose={() => setDeactivate(null)}
        onConfirm={() => {
          if (deactivate === null) return;
          toggle.mutate(
            { id: deactivate.id, active: false },
            {
              onSuccess: (body) => toast.success(body.message),
              onError: (cause) => toast.error(errorText(cause, "Bandara gagal dinonaktifkan.")),
            },
          );
          setDeactivate(null);
        }}
      >
        Bandara dengan intern aktif tidak bisa dinonaktifkan. Riwayat presensi tetap tersimpan.
      </Confirm>
    </>
  );
}

/** Detail bandara dengan tiga tab: titik presensi, jadwal mingguan, jadwal khusus. */
function AirportDetail({
  airportId,
  tab,
  onTab,
  onBack,
  onEdit,
  children,
}: {
  airportId: number;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onBack: () => void;
  onEdit: (airport: AdminAirport) => void;
  children: React.ReactNode;
}) {
  const detail = useAdminAirport(airportId);
  const offices = useAdminOffices(airportId);
  const weekly = useWeeklyHistory(airportId);
  const specials = useSpecialSchedules(airportId);
  const [officeForm, setOfficeForm] = useState<AdminOffice | "new" | null>(null);
  const [deactivateOffice, setDeactivateOffice] = useState<AdminOffice | null>(null);
  const [weeklyForm, setWeeklyForm] = useState(false);
  const [specialForm, setSpecialForm] = useState<AdminSpecialSchedule | "new" | null>(null);
  const [deleteSpecial, setDeleteSpecial] = useState<AdminSpecialSchedule | null>(null);
  const toggleOffice = useToggleOffice();
  const removeSpecial = useDeleteSpecial();

  if (detail.isLoading) return <LoadingState />;
  if (detail.isError)
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  const airport = detail.data;
  if (!airport) return null;

  const officeRows = offices.data?.offices ?? [];
  const activeOffices = officeRows.filter((office) => office.is_active).length;
  const history = weekly.data ?? [];
  const specialRows = specials.data ?? [];

  return (
    <>
      <PageHeading
        title={airport.name}
        subtitle={`${airport.city || "Kota belum diisi"} · ${airport.active_interns} intern aktif`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft /> Kembali
            </Button>
            <Button variant="outline" onClick={() => onEdit(airport)}>
              Ubah Bandara
            </Button>
          </div>
        }
      />
      <Tabs
        label="Detail bandara"
        value={tab}
        onChange={onTab}
        items={[
          { value: "offices", label: `Titik Presensi (${officeRows.length})` },
          { value: "weekly", label: "Jadwal Mingguan" },
          { value: "special", label: `Jadwal Khusus (${specialRows.length})` },
        ]}
      />

      {tab === "offices" && (
        <>
          {activeOffices === 0 && officeRows.length > 0 && <NoActiveOfficeBanner />}
          <Panel
            title="Titik presensi"
            subtitle={`${activeOffices} kantor aktif`}
            action={
              <Button size="sm" onClick={() => setOfficeForm("new")}>
                <Plus /> Tambah Kantor
              </Button>
            }
          >
            {offices.isLoading ? (
              <LoadingState />
            ) : offices.isError ? (
              <ErrorState error={offices.error} onRetry={() => void offices.refetch()} />
            ) : officeRows.length === 0 ? (
              <Empty>Belum ada kantor. Tambahkan kantor agar intern bisa clock in.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Koordinat</th>
                      <th>Radius clock in</th>
                      <th>Radius clock out</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officeRows.map((office) => (
                      <tr key={office.id}>
                        <td className="font-semibold">{office.name}</td>
                        <td className="text-muted-foreground">
                          {formatCoord(office.latitude, office.longitude)}
                        </td>
                        <td>{office.clock_in_radius_meters} m</td>
                        <td>{office.clock_out_radius_meters} m</td>
                        <td>
                          <Status status={office.is_active ? "Aktif" : "Nonaktif"} />
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Aksi untuk ${office.name}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setOfficeForm(office)}>
                                Ubah
                              </DropdownMenuItem>
                              {office.is_active ? (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => setDeactivateOffice(office)}
                                >
                                  Nonaktifkan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    toggleOffice.mutate(
                                      { id: office.id, active: true },
                                      {
                                        onSuccess: (body) => toast.success(body.message),
                                        onError: (cause) =>
                                          toast.error(errorText(cause, "Kantor gagal diaktifkan.")),
                                      },
                                    )
                                  }
                                >
                                  Aktifkan
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-5 py-4 text-[11px] text-muted-foreground">
              Clock in diterima bila posisi intern ada dalam radius clock in salah satu kantor
              aktif. Clock out memakai radius clock out. Batas radius {RADIUS_MIN}-{RADIUS_MAX} m.
            </div>
          </Panel>
          <OfficeForm
            target={officeForm}
            airport={airport}
            takenNames={officeRows
              .filter(
                (office) =>
                  office.id !== (officeForm && officeForm !== "new" ? officeForm.id : null),
              )
              .map((office) => office.name)}
            onClose={() => setOfficeForm(null)}
          />
          <Confirm
            open={deactivateOffice !== null}
            title={`Nonaktifkan ${deactivateOffice?.name ?? ""}?`}
            confirmLabel="Nonaktifkan"
            destructive
            disabled={toggleOffice.isPending}
            onClose={() => setDeactivateOffice(null)}
            onConfirm={() => {
              if (deactivateOffice === null) return;
              toggleOffice.mutate(
                { id: deactivateOffice.id, active: false },
                {
                  onSuccess: (body) => toast.success(body.message),
                  onError: (cause) => toast.error(errorText(cause, "Kantor gagal dinonaktifkan.")),
                },
              );
              setDeactivateOffice(null);
            }}
          >
            {deactivateOffice?.is_active && activeOffices === 1
              ? "Ini kantor aktif terakhir di bandara ini. Intern tidak bisa clock in sampai ada kantor aktif lagi."
              : "Intern tidak bisa lagi clock in atau clock out di kantor ini. Riwayat presensi tetap tersimpan."}
          </Confirm>
        </>
      )}

      {tab === "weekly" && (
        <>
          <Panel
            title="Jadwal mingguan berlaku"
            subtitle={airport.weekly_schedule?.summary ?? "Belum ada jadwal"}
            action={
              <Button size="sm" onClick={() => setWeeklyForm(true)}>
                <Plus /> Atur Jadwal
              </Button>
            }
          >
            {weekly.isLoading ? (
              <LoadingState />
            ) : weekly.isError ? (
              <ErrorState error={weekly.error} onRetry={() => void weekly.refetch()} />
            ) : history.length === 0 ? (
              <Empty>Belum ada riwayat jadwal.</Empty>
            ) : (
              <div className="grid gap-4 p-5">
                {history.map((set) => (
                  <WeeklySetCard key={set.effective_from} set={set} />
                ))}
              </div>
            )}
          </Panel>
          <WeeklyForm
            open={weeklyForm}
            airportId={airport.id}
            latest={history[0] ?? airport.weekly_schedule ?? null}
            onClose={() => setWeeklyForm(false)}
          />
        </>
      )}

      {tab === "special" && (
        <>
          <Panel
            title="Jadwal khusus"
            subtitle="Mengganti jam kerja mingguan pada rentang tanggal tertentu."
            action={
              <Button size="sm" onClick={() => setSpecialForm("new")}>
                <Plus /> Tambah Jadwal
              </Button>
            }
          >
            {specials.isLoading ? (
              <LoadingState />
            ) : specials.isError ? (
              <ErrorState error={specials.error} onRetry={() => void specials.refetch()} />
            ) : specialRows.length === 0 ? (
              <Empty>Belum ada jadwal khusus.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Tanggal</th>
                      <th>Jam</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialRows.map((special) => (
                      <tr key={special.id}>
                        <td className="font-semibold">{special.name}</td>
                        <td>
                          {special.start_date} s.d. {special.end_date}
                        </td>
                        <td>
                          {special.start_time} - {special.end_time}
                        </td>
                        <td>
                          <Status status={labelOf(SPECIAL_SCHEDULE_STATE_LABEL, special.state)} />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {special.can_edit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSpecialForm(special)}
                              >
                                Ubah
                              </Button>
                            )}
                            {special.state !== "finished" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteSpecial(special)}
                              >
                                {special.state === "running" ? "Hentikan" : "Hapus"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <SpecialForm
            open={specialForm !== null}
            airportId={airport.id}
            target={specialForm === "new" ? null : specialForm}
            onClose={() => setSpecialForm(null)}
          />
          <Confirm
            open={deleteSpecial !== null}
            title={
              deleteSpecial?.state === "running"
                ? `Hentikan ${deleteSpecial.name}?`
                : `Hapus ${deleteSpecial?.name ?? ""}?`
            }
            confirmLabel={deleteSpecial?.state === "running" ? "Hentikan" : "Hapus"}
            destructive
            disabled={removeSpecial.isPending}
            onClose={() => setDeleteSpecial(null)}
            onConfirm={() => {
              if (deleteSpecial === null) return;
              removeSpecial.mutate(deleteSpecial.id, {
                onSuccess: (message) => toast.success(message),
                onError: (cause) => toast.error(errorText(cause, "Jadwal gagal diproses.")),
              });
              setDeleteSpecial(null);
            }}
          >
            {deleteSpecial?.state === "running"
              ? "Jadwal yang sedang berjalan dihentikan mulai hari ini. Hari yang sudah lewat tetap tercatat."
              : "Jadwal khusus yang belum dimulai akan dihapus."}
          </Confirm>
        </>
      )}
      {children}
    </>
  );
}

function WeeklySetCard({ set }: { set: WeeklySet }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <strong>Berlaku {set.effective_from}</strong>
        <span className="text-sm text-muted-foreground">{set.summary}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {set.days
          .slice()
          .sort((a, b) => a.day_of_week - b.day_of_week)
          .map((day) => (
            <span className="tag" key={day.day_of_week}>
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][day.day_of_week - 1]}:{" "}
              {day.is_workday ? `${day.start_time ?? "-"}–${day.end_time ?? "-"}` : "libur"}
            </span>
          ))}
      </div>
    </div>
  );
}

function WeeklyForm({
  open,
  airportId,
  latest,
  onClose,
}: {
  open: boolean;
  airportId: number;
  latest: WeeklySet | null;
  onClose: () => void;
}) {
  const save = useSaveWeekly();
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [days, setDays] = useState<WeeklyDay[]>(defaultWeeklyDays);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEffectiveFrom(todayIso());
    const source = latest?.days ?? [];
    setDays(
      defaultWeeklyDays().map(
        (fallback) => source.find((day) => day.day_of_week === fallback.day_of_week) ?? fallback,
      ),
    );
    setError(null);
  }, [open, latest]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>Atur jadwal mingguan</DialogTitle>
        <DialogDescription>
          Hari yang tidak dicentang dianggap libur. Jadwal baru berlaku mulai tanggal yang dipilih
          dan tidak mengubah presensi sebelumnya.
        </DialogDescription>
        <div className="grid gap-3">
          <label className="form-field">
            Tanggal berlaku *
            <input
              type="date"
              min={todayIso()}
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </label>
          <WeeklyDaysEditor days={days} onChange={setDays} />
          <FormError text={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => {
              if (days.length < 1) return setError("Pilih minimal satu hari.");
              if (days.some((day) => day.is_workday && (!day.start_time || !day.end_time))) {
                return setError("Hari kerja wajib punya jam masuk dan jam pulang.");
              }
              save.mutate(
                { airportId, effectiveFrom, days },
                {
                  onSuccess: (body) => {
                    toast.success(body.message);
                    onClose();
                  },
                  onError: (cause) => setError(errorText(cause, "Jadwal gagal disimpan.")),
                },
              );
            }}
          >
            {save.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpecialForm({
  open,
  airportId,
  target,
  onClose,
}: {
  open: boolean;
  airportId: number;
  target: AdminSpecialSchedule | null;
  onClose: () => void;
}) {
  const create = useCreateSpecial();
  const update = useUpdateSpecial();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? "");
    setStartDate(target?.start_date ?? todayIso());
    setEndDate(target?.end_date ?? todayIso());
    setStartTime(target?.start_time ?? "08:00");
    setEndTime(target?.end_time ?? "12:00");
    setError(null);
  }, [open, target]);

  const running = target?.state === "running";
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogTitle>{target ? "Ubah jadwal khusus" : "Tambah jadwal khusus"}</DialogTitle>
        <DialogDescription>
          {running
            ? "Jadwal yang sedang berjalan hanya bisa diubah tanggal selesainya, mulai hari ini."
            : "Jadwal khusus mengganti jam kerja pada rentang tanggal ini."}
        </DialogDescription>
        <div className="grid gap-3">
          <label className="form-field">
            Nama *
            <input
              value={name}
              disabled={running}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="form-two">
            <label className="form-field">
              Tanggal mulai *
              <input
                type="date"
                min={todayIso()}
                value={startDate}
                disabled={running}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="form-field">
              Tanggal selesai *
              <input
                type="date"
                min={running ? todayIso() : startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
          <div className="form-two">
            <label className="form-field">
              Jam masuk *
              <input
                type="time"
                value={startTime}
                disabled={running}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
            <label className="form-field">
              Jam pulang *
              <input
                type="time"
                value={endTime}
                disabled={running}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </label>
          </div>
          <FormError text={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              const input = {
                name: name.trim(),
                start_date: startDate,
                end_date: endDate,
                start_time: startTime,
                end_time: endTime,
              };
              if (input.name === "") return setError("Nama wajib diisi.");
              const onSuccess = (message: string) => {
                toast.success(message);
                onClose();
              };
              const onError = (cause: unknown) =>
                setError(errorText(cause, "Jadwal gagal disimpan."));
              if (target)
                update.mutate(
                  { id: target.id, input },
                  { onSuccess: (body) => onSuccess(body.message), onError },
                );
              else
                create.mutate(
                  { airportId, input },
                  { onSuccess: (body) => onSuccess(body.message), onError },
                );
            }}
          >
            {pending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfficeForm({
  target,
  airport,
  takenNames,
  onClose,
}: {
  target: AdminOffice | "new" | null;
  airport: AdminAirport;
  takenNames: string[];
  onClose: () => void;
}) {
  const editing = target && target !== "new" ? target : null;
  const create = useCreateOffice();
  const update = useUpdateOffice();
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [radiusIn, setRadiusIn] = useState("100");
  const [radiusOut, setRadiusOut] = useState("300");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPin(editing ? { lat: editing.latitude, lng: editing.longitude } : null);
    setName(editing?.name ?? "");
    setRadiusIn(String(editing?.clock_in_radius_meters ?? 100));
    setRadiusOut(String(editing?.clock_out_radius_meters ?? 300));
    setQuery("");
    setSearchMsg(null);
    setFocus(null);
    setError(null);
  }, [target, editing]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchMsg(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query.trim())}`,
        { headers: { "Accept-Language": "id" } },
      );
      const data = (await res.json()) as { lat: string; lon: string }[];
      const hit = data[0];
      if (!hit) setSearchMsg("Alamat tidak ditemukan. Geser peta dan pilih titik secara manual.");
      else setFocus({ lat: Number(hit.lat), lng: Number(hit.lon) });
    } catch {
      setSearchMsg("Pencarian alamat gagal. Geser peta dan pilih titik secara manual.");
    } finally {
      setSearching(false);
    }
  };

  const submit = () => {
    if (!pin) {
      setError("Klik titik lokasi kantor di peta.");
      return;
    }
    const validation = validateOffice(
      { name, lat: pin.lat, lng: pin.lng, radiusIn, radiusOut },
      takenNames,
    );
    setError(validation);
    if (validation) return;

    const input = {
      airport_id: airport.id,
      name: name.trim(),
      latitude: pin.lat,
      longitude: pin.lng,
      clock_in_radius_meters: Number(radiusIn),
      clock_out_radius_meters: Number(radiusOut),
    };
    const onError = (cause: unknown) =>
      setError(errorText(cause, "Kantor gagal disimpan. Coba lagi."));
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          input: {
            name: input.name,
            latitude: input.latitude,
            longitude: input.longitude,
            clock_in_radius_meters: input.clock_in_radius_meters,
            clock_out_radius_meters: input.clock_out_radius_meters,
          },
        },
        {
          onSuccess: (body) => {
            toast.success(body.message);
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: (body) => {
          toast.success(body.message);
          onClose();
        },
        onError,
      });
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={target !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{editing ? `Ubah Kantor - ${editing.name}` : "Tambah Kantor"}</DialogTitle>
        <DialogDescription>
          Titik presensi untuk {airport.name}. Cari alamat atau geser peta, lalu klik titik kantor.
        </DialogDescription>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label className="search-field flex-1">
            <Search size={15} className="text-muted-foreground" />
            <input
              className="!w-full"
              aria-label="Cari alamat"
              placeholder="Cari alamat, misalnya Terminal 3 Soekarno-Hatta"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? "Mencari..." : "Cari"}
          </Button>
        </form>
        {searchMsg && <p className="text-[11px] text-warning">{searchMsg}</p>}
        {target !== null && (
          <OfficeMap
            pin={pin}
            radiusIn={Number(radiusIn)}
            radiusOut={Number(radiusOut)}
            focus={focus}
            onPick={(lat, lng) => setPin({ lat, lng })}
          />
        )}
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            Koordinat:{" "}
            {pin ? `${formatCoord(pin.lat, pin.lng)} (terisi otomatis dari pin)` : "belum ada pin"}
          </span>
          <span className="map-legend">
            <i className="in" /> radius clock in <i className="out" /> radius clock out
          </span>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="form-field">
            Bandara
            <input value={airport.name} disabled />
          </label>
          <label className="form-field">
            Nama kantor *
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="form-two">
            <label className="form-field">
              Radius clock in (m) *
              <input
                type="number"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                value={radiusIn}
                onChange={(event) => setRadiusIn(event.target.value)}
              />
            </label>
            <label className="form-field">
              Radius clock out (m) *
              <input
                type="number"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                value={radiusOut}
                onChange={(event) => setRadiusOut(event.target.value)}
              />
            </label>
          </div>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoActiveOfficeBanner({ link = false }: { link?: boolean }) {
  return (
    <div className="banner warn mb-4">
      <AlertTriangle size={16} />
      <span className="mr-auto">Belum ada kantor aktif. Intern tidak bisa clock in.</span>
      {link && (
        <Link className="text-action" to="/lokasi-kantor">
          Ke Lokasi & Jadwal
        </Link>
      )}
    </div>
  );
}

/** Peta Leaflet + OpenStreetMap. Leaflet butuh window, jadi dimuat di browser saja. */
function OfficeMap({
  pin,
  radiusIn,
  radiusOut,
  focus,
  onPick,
}: {
  pin: { lat: number; lng: number } | null;
  radiusIn: number;
  radiusOut: number;
  focus: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<Leaflet.Layer[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [status, setStatus] = useState<"memuat" | "siap" | "gagal">("memuat");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("memuat");
    import("leaflet")
      .then((mod) => {
        if (cancelled || !el.current) return;
        const L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
        lib.current = L;
        const start: [number, number] = pin ? [pin.lat, pin.lng] : DEFAULT_CENTER;
        const instance = L.map(el.current).setView(start, 16);
        let loaded = false;
        let errors = 0;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        })
          .on("tileload", () => {
            loaded = true;
          })
          .on("tileerror", () => {
            errors++;
            if (!loaded && errors >= 4) setStatus("gagal");
          })
          .addTo(instance);
        instance.on("click", (event: Leaflet.LeafletMouseEvent) =>
          pickRef.current(event.latlng.lat, event.latlng.lng),
        );
        map.current = instance;
        setStatus("siap");
        setTimeout(() => instance.invalidateSize(), 250);
      })
      .catch(() => !cancelled && setStatus("gagal"));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layers.current = [];
    };
    // Peta dibuat sekali per percobaan; pin awal dibaca saat itu saja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    const L = lib.current;
    const instance = map.current;
    if (!L || !instance || status !== "siap") return;
    layers.current.forEach((layer) => layer.remove());
    layers.current = [];
    if (!pin) return;
    const center: [number, number] = [pin.lat, pin.lng];
    if (radiusOut > 0)
      layers.current.push(
        L.circle(center, {
          radius: radiusOut,
          color: "#ef6c00",
          weight: 2,
          dashArray: "6 6",
          fillOpacity: 0.06,
        }).addTo(instance),
      );
    if (radiusIn > 0)
      layers.current.push(
        L.circle(center, {
          radius: radiusIn,
          color: "#00897b",
          weight: 2,
          fillOpacity: 0.15,
        }).addTo(instance),
      );
    const marker = L.marker(center, {
      draggable: true,
      icon: L.divIcon({
        className: "office-pin",
        html: "<span></span>",
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      }),
    }).addTo(instance);
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      pickRef.current(position.lat, position.lng);
    });
    layers.current.push(marker);
  }, [pin, radiusIn, radiusOut, status]);

  useEffect(() => {
    if (focus && map.current) map.current.setView([focus.lat, focus.lng], 17);
  }, [focus]);

  return (
    <div className="office-map-wrap">
      <div ref={el} className="office-map" aria-label="Peta lokasi kantor" />
      {status !== "siap" && (
        <div className="office-map-state">
          {status === "memuat" ? (
            "Memuat peta..."
          ) : (
            <>
              <span>Peta gagal dimuat.</span>
              <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                <RotateCw />
                Coba lagi
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

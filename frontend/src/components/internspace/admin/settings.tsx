import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import type { AdminHoliday, AdminHolidayInput, AdminUnit } from "@/lib/endpoints/admin";
import {
  useAdminHolidays,
  useAdminSettings,
  useAdminUnits,
  useCreateUnit,
  useDeleteHoliday,
  useSaveHoliday,
  useSaveSettings,
  useToggleUnit,
  useUpdateUnit,
} from "@/components/internspace/admin/settings-data";
import { errorText, todayIso } from "@/components/internspace/admin/utils";
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

type Tab = "general" | "holidays" | "units";

// ---------- Pengaturan (design-admin.md Alur 11) ----------
export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <>
      <PageHeading
        title="Pengaturan"
        subtitle="Pengaturan umum, kalender libur, dan unit. Jam kerja diatur per bandara di Lokasi & Jadwal."
      />
      <Tabs
        label="Bagian pengaturan"
        value={tab}
        onChange={setTab}
        items={[
          { value: "general", label: "Pengaturan Umum" },
          { value: "holidays", label: "Kalender Libur" },
          { value: "units", label: "Unit" },
        ]}
      />
      {tab === "general" && <GeneralSettings />}
      {tab === "holidays" && <Holidays />}
      {tab === "units" && <Units />}
    </>
  );
}

function GeneralSettings() {
  const data = useAdminSettings();
  const save = useSaveSettings();
  const [form, setForm] = useState({
    late_tolerance_minutes: 0,
    leave_quota: 3,
    end_reminder_days: 7,
    leave_escalation_hours: 24,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data.data) setForm(data.data);
  }, [data.data]);

  if (data.isLoading) return <LoadingState />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />;

  return (
    <Panel title="Pengaturan umum">
      <form
        className="form-grid max-w-xl p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate(form, {
            onSuccess: (body) => toast.success(body.message ?? "Perubahan tersimpan."),
            onError: (cause) => setError(errorText(cause, "Pengaturan gagal disimpan.")),
          });
        }}
      >
        <label className="form-field">
          Toleransi keterlambatan (menit) *
          <input
            type="number"
            min={0}
            max={120}
            value={form.late_tolerance_minutes}
            onChange={(event) =>
              setForm((old) => ({ ...old, late_tolerance_minutes: Number(event.target.value) }))
            }
          />
        </label>
        <label className="form-field">
          Kuota izin per intern *
          <input
            type="number"
            min={1}
            max={30}
            value={form.leave_quota}
            onChange={(event) =>
              setForm((old) => ({ ...old, leave_quota: Number(event.target.value) }))
            }
          />
        </label>
        <label className="form-field">
          Pengingat akhir magang (hari) *
          <input
            type="number"
            min={1}
            max={60}
            value={form.end_reminder_days}
            onChange={(event) =>
              setForm((old) => ({ ...old, end_reminder_days: Number(event.target.value) }))
            }
          />
        </label>
        <label className="form-field">
          Eskalasi izin (jam) *
          <input
            type="number"
            min={1}
            max={168}
            value={form.leave_escalation_hours}
            onChange={(event) =>
              setForm((old) => ({ ...old, leave_escalation_hours: Number(event.target.value) }))
            }
          />
        </label>
        <FormError text={error} />
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Holidays() {
  const data = useAdminHolidays();
  const save = useSaveHoliday();
  const remove = useDeleteHoliday();
  const [form, setForm] = useState<AdminHoliday | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AdminHoliday | null>(null);
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmPast, setConfirmPast] = useState<{
    id: number | undefined;
    input: AdminHolidayInput;
    message: string;
    affected: number;
  } | null>(null);

  const editing = form && form !== "new" ? form : null;
  useEffect(() => {
    setDate(editing?.date ?? todayIso());
    setName(editing?.name ?? "");
    setError(null);
  }, [form, editing]);

  const send = (id: number | undefined, input: AdminHolidayInput) => {
    save.mutate(
      { ...(id === undefined ? {} : { id }), input },
      {
        onSuccess: (body) => {
          toast.success(body.message);
          setForm(null);
          setConfirmPast(null);
        },
        onError: (cause) => {
          if (cause instanceof ApiError && cause.reason === "confirm_recalculate") {
            setConfirmPast({
              id,
              input,
              message: cause.message,
              affected: Number(cause.details?.["affected"] ?? 0),
            });
            return;
          }
          setError(errorText(cause, "Libur gagal disimpan."));
        },
      },
    );
  };

  return (
    <>
      <Panel
        title="Kalender libur"
        subtitle="Libur berlaku untuk semua bandara."
        action={
          <Button size="sm" onClick={() => setForm("new")}>
            <Plus /> Tambah Libur
          </Button>
        }
      >
        {data.isLoading ? (
          <LoadingState />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : (data.data ?? []).length === 0 ? (
          <Empty>Belum ada hari libur.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>Keterangan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(data.data ?? []).map((holiday) => (
                  <tr key={holiday.id}>
                    <td>{holiday.date}</td>
                    <td className="font-semibold">{holiday.name}</td>
                    <td>{holiday.is_past ? <Status status="Tanggal lampau" /> : "-"}</td>
                    <td>
                      <span className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setForm(holiday)}>
                          Ubah
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setToDelete(holiday)}
                        >
                          Hapus
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogTitle>{editing ? "Ubah Libur" : "Tambah Libur"}</DialogTitle>
          <DialogDescription>
            Menambah atau mengubah libur di tanggal lampau menghitung ulang status presensi.
          </DialogDescription>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() === "") return setError("Nama libur wajib diisi.");
              send(editing?.id, { date, name: name.trim() });
            }}
          >
            <label className="form-field">
              Tanggal *
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="form-field">
              Nama *
              <input
                value={name}
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <FormError text={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirm
        open={confirmPast !== null}
        title="Hitung ulang presensi?"
        confirmLabel="Ya, hitung ulang"
        disabled={save.isPending}
        onClose={() => setConfirmPast(null)}
        onConfirm={() => {
          if (confirmPast === null) return;
          send(confirmPast.id, { ...confirmPast.input, confirm: true });
        }}
      >
        {confirmPast?.message} Ada {confirmPast?.affected ?? 0} presensi yang akan dihitung ulang.
      </Confirm>

      <Confirm
        open={toDelete !== null}
        title="Hapus libur?"
        confirmLabel="Hapus"
        destructive
        disabled={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete === null) return;
          remove.mutate(toDelete.id, {
            onSuccess: (message) => toast.success(message),
            onError: (cause) => toast.error(errorText(cause, "Libur gagal dihapus.")),
          });
          setToDelete(null);
        }}
      >
        "{toDelete?.name}" tidak lagi dianggap libur dan status presensi pada tanggal itu mengikuti
        jadwal bandara.
      </Confirm>
    </>
  );
}

function Units() {
  const data = useAdminUnits();
  const create = useCreateUnit();
  const update = useUpdateUnit();
  const toggle = useToggleUnit();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<AdminUnit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (name.trim() === "") return setError("Nama unit wajib diisi.");
    const onSuccess = (body: { message: string }) => {
      toast.success(body.message);
      setName("");
      setEditing(null);
      setError(null);
    };
    const onError = (cause: unknown) => setError(errorText(cause, "Unit gagal disimpan."));
    if (editing) update.mutate({ id: editing.id, name: name.trim() }, { onSuccess, onError });
    else create.mutate(name.trim(), { onSuccess, onError });
  };

  return (
    <Panel title="Unit">
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-field flex-1">
            {editing ? `Ubah unit - ${editing.name}` : "Nama unit baru"} *
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
          </Button>
          {editing && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setName("");
                setError(null);
              }}
            >
              Batal
            </Button>
          )}
        </div>
        <FormError text={error} />
        {data.isLoading ? (
          <LoadingState />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : (data.data ?? []).length === 0 ? (
          <Empty>Belum ada unit.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jumlah pengguna</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(data.data ?? []).map((unit) => (
                  <tr key={unit.id}>
                    <td className="font-semibold">{unit.name}</td>
                    <td>{unit.user_count}</td>
                    <td>
                      <Status status={unit.is_active ? "Aktif" : "Nonaktif"} />
                    </td>
                    <td>
                      <span className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(unit);
                            setName(unit.name);
                            setError(null);
                          }}
                        >
                          Ubah
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggle.mutate(
                              { unit, active: !unit.is_active },
                              {
                                onSuccess: (body) => toast.success(body.message),
                                onError: (cause) =>
                                  toast.error(errorText(cause, "Unit gagal diubah.")),
                              },
                            )
                          }
                        >
                          {unit.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}

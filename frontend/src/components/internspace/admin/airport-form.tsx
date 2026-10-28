import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminAirport, WeeklyDay } from "@/lib/endpoints/admin";
import { useCreateAirport, useUpdateAirport } from "@/components/internspace/admin/locations-data";
import { errorText, todayIso } from "@/components/internspace/admin/utils";
import { FormError } from "@/components/internspace/shared/ui";

export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export const defaultWeeklyDays = (): WeeklyDay[] =>
  DAY_NAMES.map((_, index) => ({
    day_of_week: index + 1,
    is_workday: index < 5,
    start_time: index < 5 ? "08:00" : null,
    end_time: index < 5 ? "17:00" : null,
  }));

export function WeeklyDaysEditor({
  days,
  onChange,
}: {
  days: WeeklyDay[];
  onChange: (days: WeeklyDay[]) => void;
}) {
  const update = (dayOfWeek: number, patch: Partial<WeeklyDay>) => {
    onChange(days.map((day) => (day.day_of_week === dayOfWeek ? { ...day, ...patch } : day)));
  };

  return (
    <div className="grid gap-2">
      {days.map((day) => (
        <div
          className="grid grid-cols-[7.5rem_auto_1fr_1fr] items-center gap-2 text-sm"
          key={day.day_of_week}
        >
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={day.is_workday}
              onChange={(event) =>
                update(day.day_of_week, {
                  is_workday: event.target.checked,
                  start_time: event.target.checked ? (day.start_time ?? "08:00") : null,
                  end_time: event.target.checked ? (day.end_time ?? "17:00") : null,
                })
              }
            />
            {DAY_NAMES[day.day_of_week - 1]}
          </label>
          <span className="text-[11px] text-muted-foreground">
            {day.is_workday ? "Hari kerja" : "Libur"}
          </span>
          <input
            className="rounded-md border px-2 py-1"
            type="time"
            aria-label={`Jam masuk ${DAY_NAMES[day.day_of_week - 1]}`}
            value={day.start_time ?? ""}
            disabled={!day.is_workday}
            onChange={(event) =>
              update(day.day_of_week, { start_time: event.target.value || null })
            }
          />
          <input
            className="rounded-md border px-2 py-1"
            type="time"
            aria-label={`Jam pulang ${DAY_NAMES[day.day_of_week - 1]}`}
            value={day.end_time ?? ""}
            disabled={!day.is_workday}
            onChange={(event) => update(day.day_of_week, { end_time: event.target.value || null })}
          />
        </div>
      ))}
    </div>
  );
}

export function AirportForm({
  open,
  airport,
  onClose,
  onCreated,
}: {
  open: boolean;
  airport: AdminAirport | null;
  onClose: () => void;
  onCreated?: (airport: AdminAirport) => void;
}) {
  const create = useCreateAirport();
  const update = useUpdateAirport();
  const editing = airport !== null;
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [days, setDays] = useState<WeeklyDay[]>(defaultWeeklyDays);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(airport?.name ?? "");
    setCity(airport?.city ?? "");
    setEffectiveFrom(todayIso());
    setDays(defaultWeeklyDays());
    setError(null);
  }, [open, airport]);

  const submit = () => {
    setError(null);
    if (name.trim() === "") return setError("Nama bandara wajib diisi.");
    if (city.trim() === "") return setError("Kota wajib diisi.");

    if (editing) {
      update.mutate(
        { id: airport.id, input: { name: name.trim(), city: city.trim() } },
        {
          onSuccess: onClose,
          onError: (cause) => setError(errorText(cause, "Bandara gagal disimpan.")),
        },
      );
      return;
    }

    if (days.length !== 7) return setError("Isi jadwal untuk ketujuh hari.");
    if (days.some((day) => day.is_workday && (!day.start_time || !day.end_time))) {
      return setError("Hari kerja wajib punya jam masuk dan jam pulang.");
    }

    create.mutate(
      {
        name: name.trim(),
        city: city.trim(),
        effective_from: effectiveFrom,
        days,
      },
      {
        onSuccess: (body) => {
          onCreated?.(body.data);
          onClose();
        },
        onError: (cause) => setError(errorText(cause, "Bandara gagal disimpan.")),
      },
    );
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{editing ? `Ubah Bandara - ${airport?.name}` : "Tambah Bandara"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Nama dan kota dipakai di halaman serta dokumen PDF."
            : "Jadwal mingguan pertama wajib berisi tujuh hari. Hari yang tidak dicentang dianggap libur."}
        </DialogDescription>
        <div className="grid gap-3">
          <label className="form-field">
            Nama bandara *
            <input value={name} maxLength={255} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            Kota *
            <input
              value={city}
              maxLength={100}
              placeholder="Misalnya Tangerang"
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          {!editing && (
            <>
              <label className="form-field">
                Tanggal berlaku jadwal *
                <input
                  type="date"
                  min={todayIso()}
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              </label>
              <WeeklyDaysEditor days={days} onChange={setDays} />
            </>
          )}
          <FormError text={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

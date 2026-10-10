import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, MoreHorizontal, Plus, RotateCw, Search } from "lucide-react";
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
import { useMock, type Office } from "@/components/internspace/shared/model";
import {
  Confirm,
  Empty,
  FormError,
  PageHeading,
  Panel,
  Status,
} from "@/components/internspace/shared/ui";

// Bandara Soekarno-Hatta, titik awal peta saat belum ada pin.
const DEFAULT_CENTER: [number, number] = [-6.1256, 106.6559];

// ---------- Lokasi Kantor (design-admin.md Bagian 9A) ----------

export function OfficesPage() {
  const m = useMock();
  const [form, setForm] = useState<Office | "new" | null>(null);
  const [deactivate, setDeactivate] = useState<Office | null>(null);
  const activeCount = m.offices.filter((o) => o.active).length;
  const lastActive = deactivate?.active && activeCount === 1;
  return (
    <>
      <PageHeading
        title="Lokasi Kantor"
        subtitle="Tempat intern boleh clock in dan clock out. Kantor tidak dihapus, hanya dinonaktifkan."
        action={
          <Button onClick={() => setForm("new")}>
            <Plus />
            Tambah Kantor
          </Button>
        }
      />
      {activeCount === 0 && m.offices.length > 0 && <NoActiveOfficeBanner />}
      <Panel title="Daftar kantor" subtitle={`${activeCount} kantor aktif`}>
        {m.offices.length === 0 ? (
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
                {m.offices.map((o) => (
                  <tr key={o.id}>
                    <td className="font-semibold">{o.name}</td>
                    <td className="text-muted-foreground">{formatCoord(o.lat, o.lng)}</td>
                    <td>{o.radiusIn} m</td>
                    <td>{o.radiusOut} m</td>
                    <td>
                      <Status status={o.active ? "Aktif" : "Nonaktif"} />
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label={`Aksi untuk ${o.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setForm(o)}>Ubah</DropdownMenuItem>
                          {o.active ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeactivate(o)}
                            >
                              Nonaktifkan
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => {
                                m.setOffices((old) =>
                                  old.map((x) => (x.id === o.id ? { ...x, active: true } : x)),
                                );
                                m.log("Lokasi kantor", o.name, "Aktifkan kantor.");
                                toast.success("Perubahan tersimpan.");
                              }}
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
        <div className="px-5 py-4 text-[11px] text-muted-foreground grid gap-1">
          <span>
            Clock in diterima bila posisi intern ada dalam radius clock in salah satu kantor aktif.
            Clock out memakai radius clock out.
          </span>
          <span>
            Mengubah titik atau radius hanya berlaku untuk absensi berikutnya. Batas radius{" "}
            {RADIUS_MIN}-{RADIUS_MAX} m dan aturan intern boleh memakai kantor mana pun masih
            menunggu keputusan.
          </span>
        </div>
      </Panel>
      <OfficeForm target={form} onClose={() => setForm(null)} />
      <Confirm
        open={!!deactivate}
        title={`Nonaktifkan ${deactivate?.name ?? ""}?`}
        confirmLabel="Nonaktifkan"
        destructive
        onClose={() => setDeactivate(null)}
        onConfirm={() => {
          if (!deactivate) return;
          m.setOffices((old) =>
            old.map((x) => (x.id === deactivate.id ? { ...x, active: false } : x)),
          );
          m.log("Lokasi kantor", deactivate.name, "Nonaktifkan kantor.");
          setDeactivate(null);
          toast.success("Perubahan tersimpan.");
        }}
      >
        {lastActive
          ? "Ini kantor aktif terakhir. Setelah dinonaktifkan, intern tidak bisa clock in maupun clock out sampai ada kantor aktif lagi."
          : "Intern tidak bisa lagi clock in atau clock out di kantor ini. Riwayat absensi yang menunjuk kantor ini tetap tersimpan."}
      </Confirm>
    </>
  );
}

export function NoActiveOfficeBanner({ link = false }: { link?: boolean }) {
  return (
    <div className="banner warn mb-4">
      <AlertTriangle size={16} />
      <span className="mr-auto">Belum ada kantor aktif. Intern tidak bisa clock in.</span>
      {link && (
        <Link className="text-action" to="/lokasi-kantor">
          Ke Lokasi Kantor
        </Link>
      )}
    </div>
  );
}

function OfficeForm({ target, onClose }: { target: Office | "new" | null; onClose: () => void }) {
  const m = useMock();
  const editing = target && target !== "new" ? target : null;
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
    setPin(editing ? { lat: editing.lat, lng: editing.lng } : null);
    setName(editing?.name ?? "");
    setRadiusIn(String(editing?.radiusIn ?? 100));
    setRadiusOut(String(editing?.radiusOut ?? 300));
    setQuery("");
    setSearchMsg(null);
    setFocus(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

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

  const save = () => {
    const err = validateOffice(
      { name, lat: pin?.lat ?? null, lng: pin?.lng ?? null, radiusIn, radiusOut },
      m.offices.filter((o) => o.id !== editing?.id).map((o) => o.name),
    );
    setError(err);
    if (err || !pin) return;
    const data = {
      name: name.trim(),
      lat: pin.lat,
      lng: pin.lng,
      radiusIn: Number(radiusIn),
      radiusOut: Number(radiusOut),
    };
    if (editing) {
      m.setOffices((old) => old.map((o) => (o.id === editing.id ? { ...o, ...data } : o)));
      const moved = editing.lat !== pin.lat || editing.lng !== pin.lng;
      m.log(
        "Lokasi kantor",
        data.name,
        `Ubah ${moved ? "titik dan " : ""}radius: clock in ${data.radiusIn} m, clock out ${data.radiusOut} m.`,
      );
    } else {
      m.setOffices((old) => [...old, { id: Date.now(), ...data, active: true }]);
      m.log(
        "Lokasi kantor",
        data.name,
        `Tambah kantor di ${formatCoord(pin.lat, pin.lng)}, radius ${data.radiusIn} m / ${data.radiusOut} m.`,
      );
    }
    toast.success("Perubahan tersimpan.");
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogTitle>{editing ? `Ubah Kantor - ${editing.name}` : "Tambah Kantor"}</DialogTitle>
        <DialogDescription>
          Cari alamat atau geser peta, lalu klik titik kantor. Pin bisa digeser untuk dirapikan.
        </DialogDescription>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
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
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? "Mencari..." : "Cari"}
          </Button>
        </form>
        {searchMsg && <p className="text-[11px] text-warning">{searchMsg}</p>}
        {target && (
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
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="form-field">
            Nama kantor *
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="form-two">
            <label className="form-field">
              Radius clock in (m) *
              <input
                type="number"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                value={radiusIn}
                onChange={(e) => setRadiusIn(e.target.value)}
              />
            </label>
            <label className="form-field">
              Radius clock out (m) *
              <input
                type="number"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                value={radiusOut}
                onChange={(e) => setRadiusOut(e.target.value)}
              />
            </label>
          </div>
          <FormError text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        instance.on("click", (e: Leaflet.LeafletMouseEvent) =>
          pickRef.current(e.latlng.lat, e.latlng.lng),
        );
        map.current = instance;
        setStatus("siap");
        // Dialog masih beranimasi saat peta dibuat, ukuran dihitung ulang setelahnya.
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
    layers.current.forEach((l) => l.remove());
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
      const p = marker.getLatLng();
      pickRef.current(p.lat, p.lng);
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

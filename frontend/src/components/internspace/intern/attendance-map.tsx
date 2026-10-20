import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

type Point = { lat: number; lng: number };

const FALLBACK_CENTER: [number, number] = [-6.1256, 106.6559];

/**
 * Peta Leaflet kecil untuk kartu Hari Ini: lingkaran radius kantor yang dipilih dan
 * perkiraan posisi Anda (hanya tampilan; keputusan lokasi tetap di server).
 * Leaflet butuh window, jadi peta dimuat di browser saja.
 */
export function AttendanceMap({
  office,
  radius,
  user,
}: {
  office: Point | null;
  radius: number;
  user: Point | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<Leaflet.Layer[]>([]);
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
        const start: [number, number] = office
          ? [office.lat, office.lng]
          : user
            ? [user.lat, user.lng]
            : FALLBACK_CENTER;
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
        map.current = instance;
        setStatus("siap");
        // Kartu sedang dirender; ukuran peta dihitung ulang setelahnya.
        setTimeout(() => instance.invalidateSize(), 250);
      })
      .catch(() => !cancelled && setStatus("gagal"));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layers.current = [];
    };
    // Peta dibuat sekali per percobaan; isi peta diperbarui lewat efek di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    const L = lib.current;
    const instance = map.current;
    if (!L || !instance || status !== "siap") return;
    layers.current.forEach((l) => l.remove());
    layers.current = [];
    let view: Leaflet.LatLngBounds | null = null;
    if (office) {
      const center: [number, number] = [office.lat, office.lng];
      if (radius > 0) {
        const circle = L.circle(center, {
          radius,
          color: "#00897b",
          weight: 2,
          fillOpacity: 0.12,
        }).addTo(instance);
        layers.current.push(circle);
        view = circle.getBounds();
      } else {
        view = L.latLngBounds(center, center);
      }
      layers.current.push(
        L.circleMarker(center, {
          radius: 6,
          color: "#00897b",
          fillColor: "#00897b",
          fillOpacity: 1,
          weight: 2,
        }).addTo(instance),
      );
    }
    if (user) {
      const point = L.latLng(user.lat, user.lng);
      view = view ? view.extend(point) : L.latLngBounds(point, point);
      layers.current.push(
        L.circleMarker(point, {
          radius: 7,
          color: "#1d4ed8",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 2,
        }).addTo(instance),
      );
    }
    if (view) instance.fitBounds(view, { padding: [24, 24], maxZoom: 17 });
  }, [office, radius, user, status]);

  return (
    <div className="office-map-wrap">
      <div ref={el} className="attendance-map" aria-label="Peta kantor dan posisi Anda" />
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

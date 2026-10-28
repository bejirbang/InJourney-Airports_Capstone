import { useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { AdminAirport } from "@/lib/endpoints/admin";
import { type PageSearch } from "@/lib/search";
import { useAdminAirports } from "@/components/internspace/admin/locations-data";

/**
 * Filter bandara admin. Pilihan disimpan di parameter URL `airport_id` agar tetap
 * saat berpindah halaman, dan kosong berarti semua bandara.
 */
export function useAirportFilter() {
  const search = useSearch({ strict: false }) as PageSearch;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const airports = useAdminAirports();

  const raw = search.airport_id;
  const airportId = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;

  const setAirport = (id: number | null) => {
    navigate({
      to: pathname,
      search: { ...search, airport_id: id === null ? "" : String(id) },
      replace: true,
    });
  };

  return {
    airportId,
    setAirport,
    airports: airports.data ?? [],
    airportsLoading: airports.isLoading,
    airportsError: airports.error,
  };
}

export function AirportFilter({
  value,
  onChange,
  airports,
  disabled = false,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  airports: AdminAirport[];
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <MapPin size={15} aria-hidden />
      <span className="sr-only">Filter bandara</span>
      <select
        className="role-select"
        aria-label="Filter bandara"
        value={value === null ? "" : String(value)}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      >
        <option value="">Semua bandara</option>
        {airports.map((airport) => (
          <option key={airport.id} value={airport.id}>
            {airport.name}
            {airport.is_active ? "" : " (nonaktif)"}
          </option>
        ))}
      </select>
    </label>
  );
}

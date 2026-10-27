import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { notesApi } from "@/lib/endpoints/intern";

// Catatan (warning) dan nilai akhir intern (design-intern.md Alur 11).

export const WARNINGS_KEY = ["intern", "warnings"] as const;
export const ASSESSMENT_KEY = ["intern", "assessment"] as const;

/** Catatan dari admin; hanya baca dan terbaru lebih dulu. */
export function useWarnings() {
  return useQuery({
    queryKey: WARNINGS_KEY,
    queryFn: () => notesApi.warnings(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Nilai akhir; `available` ditentukan server, bukan dihitung di frontend. */
export function useAssessment() {
  return useQuery({
    queryKey: ASSESSMENT_KEY,
    queryFn: () => notesApi.assessment(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

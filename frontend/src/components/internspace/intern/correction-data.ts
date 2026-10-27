import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { correctionApi } from "@/lib/endpoints/intern";

// Koreksi presensi intern (design-intern.md Alur 7): daftar, detail, ajukan, batalkan.

export const CORRECTIONS_KEY = ["intern", "corrections"] as const;

export function useCorrections() {
  return useQuery({
    queryKey: CORRECTIONS_KEY,
    queryFn: () => correctionApi.list(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCorrectionDetail(id: string | null) {
  const numeric = Number(id);
  return useQuery({
    queryKey: [...CORRECTIONS_KEY, "detail", id ?? ""],
    queryFn: () => correctionApi.show(internToken(), numeric),
    enabled: id !== null && Number.isInteger(numeric) && numeric > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; reason: string }) =>
      correctionApi.store(internToken(), input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

export function useCancelCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => correctionApi.cancel(internToken(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

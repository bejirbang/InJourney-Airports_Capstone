import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { presentationApi } from "@/lib/endpoints/intern";

// Presentasi akhir intern (design-intern.md Alur 10): status dan link bukti.

export const PRESENTATION_KEY = ["intern", "presentation"] as const;

export function usePresentation() {
  return useQuery({
    queryKey: PRESENTATION_KEY,
    queryFn: () => presentationApi.show(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitPresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evidenceUrl: string) => presentationApi.submit(internToken(), evidenceUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intern"] }),
  });
}

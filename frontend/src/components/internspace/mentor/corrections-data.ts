import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { mentorApi, type MentorCorrectionTab } from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";

// Koreksi presensi dari sisi mentor (design-mentor.md Alur 5): daftar, detail, ACC, Tolak.

export const CORRECTIONS_KEY = [...MENTOR_KEY, "corrections"] as const;

export function useMentorCorrections(params: { tab: MentorCorrectionTab; intern_id?: number }) {
  return useQuery({
    queryKey: [...CORRECTIONS_KEY, "list", params],
    queryFn: () => mentorApi.corrections(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorCorrectionDetail(id: string | null) {
  const numeric = Number(id);
  return useQuery({
    queryKey: [...CORRECTIONS_KEY, "detail", id ?? ""],
    queryFn: () => mentorApi.correction(internToken(), numeric),
    enabled: id !== null && Number.isInteger(numeric) && numeric > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useApproveCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) =>
      mentorApi.approveCorrection(internToken(), id, note),
    onSettled: () => queryClient.invalidateQueries({ queryKey: MENTOR_KEY }),
  });
}

export function useRejectCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      mentorApi.rejectCorrection(internToken(), id, note),
    onSettled: () => queryClient.invalidateQueries({ queryKey: MENTOR_KEY }),
  });
}

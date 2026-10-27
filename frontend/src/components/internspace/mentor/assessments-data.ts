import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { mentorApi, type MentorAssessmentInput } from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";

// Input nilai mentor (design-mentor.md Alur 9): daftar, detail, simpan draft, dan submit.

export const ASSESSMENTS_KEY = [...MENTOR_KEY, "assessments"] as const;

export function useMentorAssessments() {
  return useQuery({
    queryKey: [...ASSESSMENTS_KEY, "list"],
    queryFn: () => mentorApi.assessments(internToken()),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorAssessmentDetail(internId: string | null) {
  const numeric = Number(internId);
  return useQuery({
    queryKey: [...ASSESSMENTS_KEY, "detail", internId ?? ""],
    queryFn: () => mentorApi.assessment(internToken(), numeric),
    enabled: internId !== null && Number.isInteger(numeric) && numeric > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useSaveAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ internId, input }: { internId: number; input: MentorAssessmentInput }) =>
      mentorApi.saveAssessment(internToken(), internId, input),
    onSuccess: (result, { internId }) => {
      queryClient.setQueryData([...ASSESSMENTS_KEY, "detail", String(internId)], result.data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MENTOR_KEY }),
  });
}

export function useSubmitAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ internId, input }: { internId: number; input: MentorAssessmentInput }) =>
      mentorApi.submitAssessment(internToken(), internId, input),
    onSuccess: (result, { internId }) => {
      queryClient.setQueryData([...ASSESSMENTS_KEY, "detail", String(internId)], result.data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MENTOR_KEY }),
  });
}

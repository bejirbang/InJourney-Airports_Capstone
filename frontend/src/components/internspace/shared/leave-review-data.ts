import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  adminLeaveApi,
  mentorApi,
  type ReviewerLeave,
  type ReviewerLeaveParams,
  type ReviewerLeaveList,
} from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";

// Izin dari sisi mentor dan admin (progress.md 7.5). Satu hook memilih endpoint sesuai role.

export type ReviewerRole = "mentor" | "admin";

export const REVIEW_LEAVES_KEY = ["reviewer", "leaves"] as const;

export function useReviewerLeaves(role: ReviewerRole, params: ReviewerLeaveParams) {
  return useQuery({
    queryKey: [...REVIEW_LEAVES_KEY, role, "list", params],
    queryFn: () =>
      role === "admin"
        ? adminLeaveApi.list(internToken(), params)
        : mentorApi.leaves(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useReviewerLeaveDetail(role: ReviewerRole, id: string | null) {
  const numeric = Number(id);
  return useQuery({
    queryKey: [...REVIEW_LEAVES_KEY, role, "detail", id ?? ""],
    queryFn: () =>
      role === "admin"
        ? adminLeaveApi.show(internToken(), numeric)
        : mentorApi.leave(internToken(), numeric),
    enabled: id !== null && Number.isInteger(numeric) && numeric > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Pilihan filter intern. Admin memakai `meta.interns` dari daftar; mentor memakai daftar intern. */
export function useReviewerLeaveInterns(role: ReviewerRole) {
  const query = useQuery({
    queryKey: [...REVIEW_LEAVES_KEY, role, "interns"],
    queryFn: () =>
      mentorApi
        .interns(internToken(), { status: "all" })
        .then((result) => result.interns.map((intern) => ({ id: intern.id, name: intern.name }))),
    enabled: role === "mentor",
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return role === "admin" ? [] : (query.data ?? []);
}

function useInvalidateLeave() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: REVIEW_LEAVES_KEY });
    void queryClient.invalidateQueries({ queryKey: MENTOR_KEY });
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: ["menu"] });
  };
}

export function useApproveLeave(role: ReviewerRole) {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: ({
      id,
      note,
      evidenceChecked = false,
    }: {
      id: number;
      note: string;
      evidenceChecked?: boolean;
    }): Promise<{ message: string; data: ReviewerLeave }> =>
      role === "admin"
        ? adminLeaveApi.approve(internToken(), id, {
            note,
            evidence_checked: evidenceChecked,
          })
        : mentorApi.approveLeave(internToken(), id, note),
    onSettled: invalidate,
  });
}

export function useRejectLeave(role: ReviewerRole) {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      role === "admin"
        ? adminLeaveApi.reject(internToken(), id, note)
        : mentorApi.rejectLeave(internToken(), id, note),
    onSettled: invalidate,
  });
}

export type { ReviewerLeave, ReviewerLeaveList, ReviewerLeaveParams };

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  mentorApi,
  type MentorLogbookListParams,
  type MentorLogbookTab,
} from "@/lib/endpoints/mentor";
import { MENTOR_KEY } from "@/components/internspace/mentor/dashboard-data";
import { invalidateMenu } from "@/components/internspace/shared/menu-data";

// Review logbook mentor (design-mentor.md Alur 4): daftar, detail, setujui, minta revisi,
// dan setujui massal. Jumlah tab berasal dari `meta` respons daftar.

export const LOGBOOKS_KEY = [...MENTOR_KEY, "logbooks"] as const;

export function useMentorLogbooks(params: MentorLogbookListParams) {
  return useQuery({
    queryKey: [...LOGBOOKS_KEY, "list", params],
    queryFn: () => mentorApi.logbooks(internToken(), params),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useMentorLogbookDetail(id: string | null, tab: MentorLogbookTab) {
  const numeric = Number(id);
  return useQuery({
    queryKey: [...LOGBOOKS_KEY, "detail", id ?? "", tab],
    queryFn: () => mentorApi.logbook(internToken(), numeric, tab),
    enabled: id !== null && Number.isInteger(numeric) && numeric > 0,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Setujui satu logbook; komentar opsional. */
export function useApproveLogbook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string | null }) =>
      mentorApi.approveLogbook(internToken(), id, comment),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MENTOR_KEY });
      void invalidateMenu(queryClient);
    },
  });
}

/** Minta revisi; komentar wajib diisi. */
export function useReviseLogbook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      mentorApi.reviseLogbook(internToken(), id, comment),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MENTOR_KEY });
      void invalidateMenu(queryClient);
    },
  });
}

/** Setujui massal; server mengembalikan id yang disetujui dan yang dilewati. */
export function useApproveLogbooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => mentorApi.approveLogbooks(internToken(), ids),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MENTOR_KEY });
      void invalidateMenu(queryClient);
    },
  });
}

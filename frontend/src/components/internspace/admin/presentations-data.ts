import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi, type AdminPresentationTab } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminPresentations(tab: AdminPresentationTab, airportId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "presentations", tab, airportId],
    queryFn: () => adminApi.presentations.list(internToken(), { tab, airport_id: airportId }),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminPresentation(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "presentation", id],
    queryFn: () => adminApi.presentations.show(internToken(), id as number),
    enabled: id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useDecidePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: "approve" | "revise";
      note?: string;
    }) =>
      decision === "approve"
        ? adminApi.presentations.approve(internToken(), id)
        : adminApi.presentations.revise(internToken(), id, note ?? ""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

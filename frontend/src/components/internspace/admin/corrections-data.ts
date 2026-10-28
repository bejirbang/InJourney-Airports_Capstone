import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi, type AdminCorrectionTab } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminCorrections({
  tab,
  internId,
  airportId,
}: {
  tab: AdminCorrectionTab;
  internId: number | null;
  airportId: number | null;
}) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "corrections", tab, internId, airportId],
    queryFn: () =>
      adminApi.corrections.list(internToken(), {
        tab,
        intern_id: internId,
        airport_id: airportId,
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminCorrection(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "correction", id],
    queryFn: () => adminApi.corrections.show(internToken(), id as number),
    enabled: id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useDecideCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: "approve" | "reject";
      note: string;
    }) =>
      decision === "approve"
        ? adminApi.corrections.approve(internToken(), id, note)
        : adminApi.corrections.reject(internToken(), id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

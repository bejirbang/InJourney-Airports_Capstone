import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminWarningInterns(search: string) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "warning-interns", search],
    queryFn: () => adminApi.warnings.list(internToken(), search.trim() || undefined),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminWarnings(internId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "warnings", internId],
    queryFn: () => adminApi.warnings.forIntern(internToken(), internId as number),
    enabled: internId !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSaveWarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      internId,
      warningId,
      body,
    }: {
      internId: number;
      warningId: number | undefined;
      body: string;
    }) =>
      warningId === undefined
        ? adminApi.warnings.create(internToken(), internId, body)
        : adminApi.warnings.update(internToken(), warningId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

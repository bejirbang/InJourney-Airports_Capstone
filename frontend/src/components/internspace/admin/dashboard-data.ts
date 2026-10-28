import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminDashboard(airportId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "dashboard", airportId],
    queryFn: () => adminApi.dashboard(internToken(), airportId),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useExtendInternship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, endDate }: { id: number; endDate: string }) =>
      adminApi.users.extend(internToken(), id, endDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

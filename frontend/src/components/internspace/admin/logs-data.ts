import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi, type AdminAuditLogFilters } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminAuditLogs(filters: AdminAuditLogFilters) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "audit-logs", filters],
    queryFn: () => adminApi.auditLogs.list(internToken(), filters),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminAuditLogOptions() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "audit-log-options"],
    queryFn: () => adminApi.auditLogs.options(internToken()),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

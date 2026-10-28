import { useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi, type AdminAssessmentFilter } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminAssessments(filter: AdminAssessmentFilter, airportId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "assessments", filter, airportId],
    queryFn: () =>
      adminApi.assessments.list(internToken(), { status: filter, airport_id: airportId }),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminAssessment(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "assessment", id],
    queryFn: () => adminApi.assessments.show(internToken(), id as number),
    enabled: id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

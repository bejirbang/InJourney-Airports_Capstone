import { useMutation, useQuery } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  adminApi,
  type AdminAssessmentPdfInput,
  type AdminAttendancePdfInput,
  type AdminReportFilters,
} from "@/lib/endpoints/admin";

export function useReportOptions() {
  return useQuery({
    queryKey: ["admin", "report-options"],
    queryFn: () => adminApi.reports.options(internToken()),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useReportPreview() {
  return useMutation({
    mutationFn: (filters: AdminReportFilters) => adminApi.reports.preview(internToken(), filters),
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: (filters: AdminReportFilters) => adminApi.reports.export(internToken(), filters),
  });
}

export function useExportAttendancePdf() {
  return useMutation({
    mutationFn: (input: AdminAttendancePdfInput) =>
      adminApi.reports.attendancePdf(internToken(), input),
  });
}

export function useExportAssessmentPdf() {
  return useMutation({
    mutationFn: (input: AdminAssessmentPdfInput) =>
      adminApi.reports.assessmentPdf(internToken(), input),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  adminApi,
  type AdminAirportCreateInput,
  type AdminAirportUpdateInput,
  type AdminOfficeInput,
  type AdminOfficeUpdateInput,
  type AdminSpecialScheduleInput,
  type WeeklyDay,
} from "@/lib/endpoints/admin";

/** Kunci dasar data admin; semua mutasi admin menyegarkan kunci ini. */
export const ADMIN_KEY = ["admin"] as const;

export function useAdminAirports() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "airports"],
    queryFn: () => adminApi.airports.list(internToken()),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminAirport(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "airport", id],
    queryFn: () => adminApi.airports.show(internToken(), id as number),
    enabled: id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminOffices(airportId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "offices", airportId],
    queryFn: () => adminApi.offices.list(internToken(), airportId),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useWeeklyHistory(airportId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "weekly", airportId],
    queryFn: () => adminApi.airports.weeklyHistory(internToken(), airportId as number),
    enabled: airportId !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSpecialSchedules(airportId: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "specials", airportId],
    queryFn: () => adminApi.airports.specials(internToken(), airportId as number),
    enabled: airportId !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminAirportCreateInput) => adminApi.airports.create(internToken(), input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useUpdateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdminAirportUpdateInput }) =>
      adminApi.airports.update(internToken(), id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useToggleAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      adminApi.airports.setActive(internToken(), id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useSaveWeekly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      airportId,
      effectiveFrom,
      days,
    }: {
      airportId: number;
      effectiveFrom: string;
      days: WeeklyDay[];
    }) =>
      adminApi.airports.saveWeekly(internToken(), airportId, {
        effective_from: effectiveFrom,
        days,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useCreateSpecial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ airportId, input }: { airportId: number; input: AdminSpecialScheduleInput }) =>
      adminApi.airports.createSpecial(internToken(), airportId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useUpdateSpecial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdminSpecialScheduleInput }) =>
      adminApi.airports.updateSpecial(internToken(), id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useDeleteSpecial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.airports.deleteSpecial(internToken(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useCreateOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminOfficeInput) => adminApi.offices.create(internToken(), input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useUpdateOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdminOfficeUpdateInput }) =>
      adminApi.offices.update(internToken(), id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useToggleOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      adminApi.offices.setActive(internToken(), id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

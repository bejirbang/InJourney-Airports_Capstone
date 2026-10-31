import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  adminApi,
  type AdminGeneralSettings,
  type AdminHolidayInput,
  type AdminUnit,
} from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";
import { invalidateMenu } from "@/components/internspace/shared/menu-data";

export function useAdminSettings() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "settings"],
    queryFn: () => adminApi.settings.show(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminGeneralSettings) => adminApi.settings.update(internToken(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      void invalidateMenu(queryClient);
    },
  });
}

export function useAdminHolidays() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "holidays"],
    queryFn: () => adminApi.holidays.list(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSaveHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AdminHolidayInput }) =>
      adminApi.holidays.save(internToken(), input, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.holidays.remove(internToken(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useAdminUnits() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "units"],
    queryFn: () => adminApi.units.list(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminApi.units.create(internToken(), name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      adminApi.units.update(internToken(), id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useToggleUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unit, active }: { unit: AdminUnit; active: boolean }) =>
      adminApi.units.setActive(internToken(), unit.id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

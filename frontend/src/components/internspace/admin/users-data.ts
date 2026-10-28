import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import {
  adminApi,
  type AdminUserCreateInput,
  type AdminUserFilters,
  type AdminUserUpdateInput,
} from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminUsers(filters: AdminUserFilters) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "users", filters],
    queryFn: () => adminApi.users.list(internToken(), filters),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminMentors() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "mentors"],
    queryFn: () => adminApi.users.mentors(internToken()),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminUser(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user", id],
    queryFn: () => adminApi.users.show(internToken(), id as number),
    enabled: id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUserCreateInput) => adminApi.users.create(internToken(), input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdminUserUpdateInput }) =>
      adminApi.users.update(internToken(), id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useToggleAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active
        ? adminApi.users.activate(internToken(), id)
        : adminApi.users.deactivate(internToken(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useMentorChangeImpact(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "mentor-change", id],
    queryFn: () => adminApi.users.mentorChange(internToken(), id as number),
    enabled: id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useChangeMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mentorId }: { id: number; mentorId: number }) =>
      adminApi.users.changeMentor(internToken(), id, mentorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useResetAdminPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.users.resetPassword(internToken(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useAdminInternAttendance(id: number | null, month: string | null, enabled = true) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user-attendance", id, month],
    queryFn: () => adminApi.users.attendance(internToken(), id as number, month),
    enabled: enabled && id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminInternDay(id: number | null, date: string | null) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user-day", id, date],
    queryFn: () => adminApi.users.attendanceDay(internToken(), id as number, date as string),
    enabled: id !== null && date !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminInternLogbooks(id: number | null, month: string | null, enabled = true) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user-logbooks", id, month],
    queryFn: () => adminApi.users.logbooks(internToken(), id as number, month),
    enabled: enabled && id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminInternLeaves(id: number | null, enabled = true) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user-leaves", id],
    queryFn: () => adminApi.users.leaves(internToken(), id as number),
    enabled: enabled && id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useAdminInternCorrections(id: number | null, enabled = true) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user-corrections", id],
    queryFn: () => adminApi.users.corrections(internToken(), id as number),
    enabled: enabled && id !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

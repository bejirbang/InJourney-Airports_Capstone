import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { internToken } from "@/lib/api";
import { adminApi, type AdminAnnouncementInput } from "@/lib/endpoints/admin";
import { ADMIN_KEY } from "@/components/internspace/admin/locations-data";

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: [...ADMIN_KEY, "announcements"],
    queryFn: () => adminApi.announcements.list(internToken()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSaveAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AdminAnnouncementInput }) =>
      id === undefined
        ? adminApi.announcements.create(internToken(), input)
        : adminApi.announcements.update(internToken(), id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.announcements.remove(internToken(), id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
  });
}

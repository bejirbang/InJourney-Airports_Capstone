import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { internToken } from "@/lib/api";
import { announcementApi } from "@/lib/endpoints/shared";
import { formatShort } from "@/lib/mock-rules";
import type { AppPath, PageSearch } from "@/lib/search";

/**
 * Detail pengumuman yang dibuka dari lonceng: notifikasi pengumuman memakai
 * `link_path: "/"` dan `link_params.announcement`. Endpoint detail tetap
 * `GET /api/announcements/{id}`.
 */
export function AnnouncementNotificationDialog() {
  const search = useSearch({ strict: false }) as PageSearch;
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const id = Number(search.announcement);
  const open = Number.isInteger(id) && id > 0;

  const query = useQuery({
    queryKey: ["announcement", id],
    queryFn: () => announcementApi.show(internToken(), id),
    enabled: open,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const close = () => {
    const next = { ...search };
    delete next.announcement;
    void navigate({ to: path as AppPath, search: next as never, replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogTitle>{query.data?.title ?? "Pengumuman"}</DialogTitle>
        <DialogDescription>
          {query.data
            ? `${query.data.author_name ?? "-"} · ${formatShort(query.data.created_at ?? "", true)}`
            : "Detail pengumuman dari admin."}
        </DialogDescription>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat pengumuman...</p>
        ) : query.isError ? (
          <p className="text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Pengumuman gagal dimuat."}
          </p>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed">{query.data?.body}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

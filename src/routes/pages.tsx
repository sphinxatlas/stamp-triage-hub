import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { identifyPage } from "@/lib/identify.functions";
import {
  deletePageCompletely,
  deleteStampsForPage,
  fetchContainers,
  fetchPageDetail,
  fetchPageStampCounts,
  fetchPages,
  fetchStampsForPage,
} from "@/lib/triage";

const containersQuery = queryOptions({ queryKey: ["containers"], queryFn: fetchContainers });
const pagesQuery = queryOptions({ queryKey: ["pages"], queryFn: () => fetchPages() });
const countsQuery = queryOptions({
  queryKey: ["page-stamp-counts"],
  queryFn: fetchPageStampCounts,
});

type RunState = "pending" | "running" | "done" | "failed";
type RunItem = { id: string; label: string; state: RunState; error?: string };

async function countSetsForPage(pageId: string) {
  const { count, error } = await supabase
    .from("stamp_sets")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId);
  if (error) return 0;
  return count ?? 0;
}


async function fetchThumbnails(paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase.storage.from("captures").createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export const Route = createFileRoute("/pages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Page history — Stamp Triage" },
      {
        name: "description",
        content: "Every captured album page, its identification status and detected stamps.",
      },
      { property: "og:title", content: "Page history — Stamp Triage" },
      {
        property: "og:description",
        content: "Every captured album page, its identification status and detected stamps.",
      },
    ],
  }),
  component: Pages,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Pages() {
  const queryClient = useQueryClient();
  const { data: pages } = useSuspenseQuery(pagesQuery);
  const { data: containers } = useSuspenseQuery(containersQuery);
  const { data: counts } = useSuspenseQuery(countsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const paths = pages.map((page) => page.photo_path).filter((path): path is string => !!path);
  const { data: thumbs } = useSuspenseQuery(
    queryOptions({
      queryKey: ["capture-thumbs", paths.slice().sort().join("|")],
      queryFn: () => fetchThumbnails(paths),
    }),
  );

  const containerLabel = (id: string) =>
    containers.find((container) => container.id === id)?.label ?? "—";

  const sorted = pages.slice().sort((a, b) => {
    const left = a.captured_at ? Date.parse(a.captured_at) : 0;
    const right = b.captured_at ? Date.parse(b.captured_at) : 0;
    return right - left;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pages</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Photo</TableHead>
            <TableHead>Page</TableHead>
            <TableHead>Container</TableHead>
            <TableHead>Capture type</TableHead>
            <TableHead>Identify status</TableHead>
            <TableHead>Captured at</TableHead>
            <TableHead className="text-right">Stamps</TableHead>
            <TableHead>By review status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                No pages yet
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((page) => {
              const count = counts[page.id];
              const url = page.photo_path ? thumbs[page.photo_path] : undefined;
              return (
                <TableRow
                  key={page.id}
                  onClick={() => setSelectedId(page.id)}
                  className="cursor-pointer"
                  data-state={selectedId === page.id ? "selected" : undefined}
                >
                  <TableCell>
                    {url ? (
                      <img
                        src={url}
                        alt={`Capture for ${page.label}`}
                        className="h-10 w-14 rounded object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{page.label}</TableCell>
                  <TableCell>{containerLabel(page.container_id)}</TableCell>
                  <TableCell>{page.capture_type ?? "—"}</TableCell>
                  <TableCell>{page.identify_status}</TableCell>
                  <TableCell>
                    {page.captured_at ? new Date(page.captured_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">{count?.total ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(count?.byStatus ?? {}).map(([status, value]) => (
                        <Badge key={status} variant="secondary">
                          {status} {value}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {selectedId ? (
        <PageDetail
          pageId={selectedId}
          onDeleted={() => setSelectedId(null)}
          refresh={() => {
            queryClient.invalidateQueries({ queryKey: ["pages"] });
            queryClient.invalidateQueries({ queryKey: ["page-stamp-counts"] });
            queryClient.invalidateQueries({ queryKey: ["page-detail", selectedId] });
            queryClient.invalidateQueries({ queryKey: ["page-stamps", selectedId] });
            queryClient.invalidateQueries({ queryKey: ["stamps"] });
            queryClient.invalidateQueries({ queryKey: ["review-stamps"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      ) : null}
    </div>
  );
}

function PageDetail({
  pageId,
  onDeleted,
  refresh,
}: {
  pageId: string;
  onDeleted: () => void;
  refresh: () => void;
}) {
  const { data: page } = useSuspenseQuery(
    queryOptions({ queryKey: ["page-detail", pageId], queryFn: () => fetchPageDetail(pageId) }),
  );
  const { data: stamps } = useSuspenseQuery(
    queryOptions({ queryKey: ["page-stamps", pageId], queryFn: () => fetchStampsForPage(pageId) }),
  );
  const { data: photo } = useSuspenseQuery(
    queryOptions({
      queryKey: ["page-photo", page.photo_path],
      queryFn: (): Promise<Record<string, string>> =>
        page.photo_path ? fetchThumbnails([page.photo_path]) : Promise.resolve({}),
    }),
  );

  const identifyFn = useServerFn(identifyPage);

  const rerun = useMutation({
    mutationFn: async () => identifyFn({ data: { page_id: pageId } }),
    onSuccess: (data) => {
      toast.success(`Identification finished — ${data.stamps.length} stamp(s)`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clearStamps = useMutation({
    mutationFn: async () => deleteStampsForPage(pageId),
    onSuccess: () => {
      toast.success("Stamp records deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removePage = useMutation({
    mutationFn: async () => deletePageCompletely(page),
    onSuccess: () => {
      toast.success(`Page ${page.label} deleted`);
      onDeleted();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const photoUrl = page.photo_path ? photo[page.photo_path] : undefined;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{page.label}</h2>
        <div className="flex flex-wrap gap-2">
          <ConfirmButton
            label={rerun.isPending ? "Identifying…" : "Re-run identification"}
            title="Re-run identification?"
            description="All existing stamp records for this page will be deleted and replaced, including any edits or confirmations."
            actionLabel="Re-run"
            disabled={rerun.isPending || !page.photo_path}
            onConfirm={() => rerun.mutate()}
          />
          <ConfirmButton
            label="Delete stamp records"
            title="Delete stamp records?"
            description="All stamp records for this page will be deleted and the page returns to pending. The page and its photo are kept."
            actionLabel="Delete records"
            disabled={clearStamps.isPending}
            onConfirm={() => clearStamps.mutate()}
          />
          <ConfirmButton
            label="Delete page"
            title="Delete this page?"
            description="The page, its stamp records and its photo will be permanently removed. This cannot be undone."
            actionLabel="Delete page"
            variant="destructive"
            disabled={removePage.isPending}
            onConfirm={() => removePage.mutate()}
          />
        </div>
      </div>

      {photoUrl ? (
        <img src={photoUrl} alt={`Capture for ${page.label}`} className="max-h-96 rounded" />
      ) : (
        <p className="text-sm text-muted-foreground">No photo for this page yet.</p>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-medium">Page notes</h3>
        <p className="text-sm text-muted-foreground">{page.page_notes ?? "—"}</p>
      </div>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            Raw model output
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
            {page.raw_model_output ? JSON.stringify(page.raw_model_output, null, 2) : "—"}
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Denomination</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Review status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stamps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No stamp records for this page
              </TableCell>
            </TableRow>
          ) : (
            stamps.map((stamp, index) => (
              <TableRow key={stamp.id}>
                <TableCell>{index}</TableCell>
                <TableCell>{stamp.country ?? "—"}</TableCell>
                <TableCell>{stamp.denomination ?? "—"}</TableCell>
                <TableCell>
                  {stamp.confidence === null ? "—" : Number(stamp.confidence).toFixed(2)}
                </TableCell>
                <TableCell>{stamp.review_status}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

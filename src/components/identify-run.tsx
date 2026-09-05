import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { identifyPage } from "@/lib/identify.functions";
import {
  createRun,
  fetchLatestRun,
  fetchRunStatus,
  patchRun,
  requestCancel,
  type IdentifyRun,
  type RunError,
} from "@/lib/runs";
import { researchBrief } from "@/lib/research.functions";
import { fetchBriefTargets, fetchPages } from "@/lib/triage";

type BriefProgress = { label: string; done: number; total: number } | null;

type Ctx = {
  run: IdentifyRun | null;
  active: boolean;
  briefs: BriefProgress;
  start: (pageIds: string[]) => void;
  cancel: () => void;
  openPanel: () => void;
  labelOf: (id: string) => string;
};

const IdentifyRunContext = createContext<Ctx | null>(null);

export function useIdentifyRun() {
  const ctx = useContext(IdentifyRunContext);
  if (!ctx) throw new Error("useIdentifyRun must be used inside IdentifyRunProvider");
  return ctx;
}

export function IdentifyRunProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const identifyFn = useServerFn(identifyPage);
  const briefFn = useServerFn(researchBrief);
  const [panelOpen, setPanelOpen] = useState(false);
  const [briefs, setBriefs] = useState<BriefProgress>(null);
  const workingRef = useRef<string | null>(null);

  const { data: run = null } = useQuery({
    queryKey: ["identify-run"],
    queryFn: fetchLatestRun,
    refetchInterval: (query) =>
      (query.state.data as IdentifyRun | null)?.status === "running" ? 1500 : false,
  });

  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: () => fetchPages() });

  const labelOf = useCallback(
    (id: string) => pages.find((page) => page.id === id)?.label ?? id,
    [pages],
  );

  const active = run?.status === "running";

  const refreshAll = useCallback(() => {
    for (const key of [
      "pages",
      "page-stamp-counts",
      "page-detail",
      "page-stamps",
      "stamps",
      "review-queue",
      "review-stamps",
      "review-sets",
      "stamp-sets",
      "dashboard",
      "identify-run",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  // The run is driven from here, in the root layout, so it survives route changes.
  useEffect(() => {
    if (!run || run.status !== "running") return;
    if (workingRef.current === run.id) return;
    workingRef.current = run.id;

    const work = async () => {
      const errors: RunError[] = [...run.errors];
      let index = run.current_index;
      for (; index < run.page_ids.length; index += 1) {
        let status: string;
        try {
          status = await fetchRunStatus(run.id);
        } catch {
          break;
        }
        if (status !== "running") break;

        const pageId = run.page_ids[index]!;
        await patchRun(run.id, { current_index: index });
        queryClient.invalidateQueries({ queryKey: ["identify-run"] });
        let identified = true;
        try {
          await identifyFn({ data: { page_id: pageId } });
        } catch (error) {
          identified = false;
          errors.push({
            page_id: pageId,
            label: labelOf(pageId),
            message: (error as Error).message ?? "Failed",
          });
          await patchRun(run.id, { errors: errors as never });
        }
        // Results are written per page, so finished pages are reviewable straight away.
        refreshAll();

        // Every new stamp and set gets its research brief and value estimate here,
        // one at a time, so the review queue is already filled in.
        if (identified) {
          try {
            const targets = await fetchBriefTargets(pageId);
            for (let i = 0; i < targets.length; i += 1) {
              const target = targets[i]!;
              const runStatus = await fetchRunStatus(run.id).catch(() => "cancelled");
              if (runStatus !== "running") break;
              setBriefs({ label: target.label, done: i, total: targets.length });
              try {
                await briefFn({ data: { kind: target.kind, id: target.id } });
              } catch {
                // A failed brief must not stop identification of the remaining pages.
              }
              refreshAll();
            }
          } catch {
            // Ignore: briefs are an extra, identification results are already saved.
          }
          setBriefs(null);
        }
      }

      const finalStatus = await fetchRunStatus(run.id).catch(() => "cancelled");
      if (finalStatus === "running") {
        await patchRun(run.id, {
          current_index: run.page_ids.length,
          status: "done",
          finished_at: new Date().toISOString(),
        });
        const failed = errors.length;
        if (failed === 0) toast.success(`Identified ${run.page_ids.length} page(s)`);
        else toast.error(`${failed} page(s) failed`);
      }
      refreshAll();
      workingRef.current = null;
    };

    void work();
  }, [run, identifyFn, briefFn, labelOf, refreshAll, queryClient]);

  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  const startMutation = useMutation({
    mutationFn: (pageIds: string[]) => createRun(pageIds),
    onSuccess: () => {
      setPanelOpen(true);
      queryClient.invalidateQueries({ queryKey: ["identify-run"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (run) await requestCancel(run.id);
    },
    onSuccess: () => {
      toast.success("Stopping after the current page");
      queryClient.invalidateQueries({ queryKey: ["identify-run"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const value = useMemo<Ctx>(
    () => ({
      run,
      active,
      start: (pageIds: string[]) => {
        if (pageIds.length === 0 || active) return;
        startMutation.mutate(pageIds);
      },
      cancel: () => cancelMutation.mutate(),
      openPanel: () => setPanelOpen(true),
      labelOf,
    }),
    [run, active, startMutation, cancelMutation, labelOf],
  );

  return (
    <IdentifyRunContext.Provider value={value}>
      {children}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Identification progress</DialogTitle>
            <DialogDescription>
              This keeps running while you move around the app. Closing this browser tab stops the
              run.
            </DialogDescription>
          </DialogHeader>
          <IdentifyRunPanel />
        </DialogContent>
      </Dialog>
    </IdentifyRunContext.Provider>
  );
}

export function IdentifyRunPanel() {
  const { run, active, cancel, labelOf } = useIdentifyRun();
  if (!run) return <p className="text-sm text-muted-foreground">No runs yet.</p>;

  const total = run.page_ids.length;
  const done = active ? run.current_index : total - 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {active
            ? `Identifying: ${Math.min(run.current_index + 1, total)} of ${total} — ${labelOf(
                run.page_ids[run.current_index] ?? "",
              )}`
            : run.status === "cancelled"
              ? `Stopped — ${done} of ${total} pages done`
              : `Finished — ${total - run.errors.length} succeeded, ${run.errors.length} failed`}
        </p>
        {active ? (
          <Button size="sm" variant="outline" onClick={cancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      <ul className="max-h-64 space-y-1 overflow-auto text-sm">
        {run.page_ids.map((id, index) => {
          const failure = run.errors.find((item) => item.page_id === id);
          const state = failure
            ? "failed"
            : active && index === run.current_index
              ? "running"
              : index < run.current_index || !active
                ? run.status === "cancelled" && index >= run.current_index
                  ? "not run"
                  : "done"
                : "waiting";
          return (
            <li key={`${id}-${index}`} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{labelOf(id)}</span>
              <Badge variant={failure ? "destructive" : "secondary"}>{state}</Badge>
              {failure ? <span className="text-muted-foreground">{failure.message}</span> : null}
            </li>
          );
        })}
      </ul>

      {run.errors.length > 0 && !active ? <RetryFailed errors={run.errors} /> : null}
    </div>
  );
}

function RetryFailed({ errors }: { errors: RunError[] }) {
  const { start } = useIdentifyRun();
  return (
    <Button size="sm" onClick={() => start(errors.map((item) => item.page_id))}>
      Retry failed
    </Button>
  );
}

export function IdentifyRunIndicator() {
  const { run, active, openPanel } = useIdentifyRun();
  if (!active || !run) return null;
  return (
    <button
      type="button"
      onClick={openPanel}
      className="w-full rounded-md bg-primary/10 px-2 py-1 text-left text-xs font-medium text-primary"
    >
      Identifying: {Math.min(run.current_index + 1, run.page_ids.length)} of{" "}
      {run.page_ids.length}
    </button>
  );
}

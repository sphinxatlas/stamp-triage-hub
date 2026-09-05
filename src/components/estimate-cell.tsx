import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { researchBrief } from "@/lib/research.functions";

const AFFECTED = [
  "review-queue",
  "review-sets",
  "browse-stamps",
  "browse-sets",
  "stamps",
  "dashboard",
];

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of AFFECTED) queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function EstimateCell({ kind, id }: { kind: "stamp" | "set"; id: string }) {
  const generate = useServerFn(researchBrief);
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await generate({ data: { kind, id } });
      refresh();
      toast.success("Estimate ready");
    } catch (error) {
      toast.error((error as Error).message || "Could not work out an estimate");
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Working…
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      onClick={(event) => {
        event.stopPropagation();
        void run();
      }}
    >
      Estimate
    </Button>
  );
}

export type EstimateTarget = { kind: "stamp" | "set"; id: string; label: string };

export function EstimateAllHighPriority({ targets }: { targets: EstimateTarget[] }) {
  const generate = useServerFn(researchBrief);
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);

  const start = async () => {
    const list = [...targets];
    setRunning(true);
    setDone(0);
    setFailed(0);
    let ok = 0;
    let bad = 0;
    for (const target of list) {
      setCurrent(target.label);
      try {
        await generate({ data: { kind: target.kind, id: target.id } });
        ok += 1;
        setDone(ok);
      } catch {
        bad += 1;
        setFailed(bad);
      }
      refresh();
    }
    setCurrent(null);
    setRunning(false);
    toast.success(`Estimates finished: ${ok} done${bad > 0 ? `, ${bad} failed` : ""}`);
  };

  if (running) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Estimating {done + failed + 1} of {targets.length}
        {current ? ` · ${current}` : ""}
      </span>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={targets.length === 0}>
          Estimate all high priority ({targets.length})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Work out estimates for {targets.length} items?</AlertDialogTitle>
          <AlertDialogDescription>
            This writes a short brief and a rough estimate for every high priority item that does
            not have one yet. It uses AI credits, one item at a time, and can take a while.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void start()}>Start</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

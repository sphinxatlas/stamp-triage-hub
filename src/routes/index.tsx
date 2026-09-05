import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PRIORITY_TIER_LABELS,
  priorityDotClass,
  priorityTier,
  whyThisIsHere,
  type PriorityTier,
} from "@/lib/priority";
import { fetchDashboard, recalculatePriorities } from "@/lib/triage";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: fetchDashboard });

const TIERS: PriorityTier[] = ["high", "medium", "low", "skip"];
const RESCORE_FLAG = "stampdex.rescored.v2";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Stamp Triage" },
      {
        name: "description",
        content: "Overview of the stamps, sets and containers in your collection.",
      },
      { property: "og:title", content: "Dashboard — Stamp Triage" },
      {
        property: "og:description",
        content: "Overview of the stamps, sets and containers in your collection.",
      },
    ],
  }),
  component: Dashboard,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const autoRan = useRef(false);

  const runRecalculate = async (silent = false) => {
    setRecalculating(true);
    try {
      const result = await recalculatePriorities();
      await queryClient.invalidateQueries();
      if (!silent) {
        toast.success(
          `Recalculated ${result.stampsUpdated} stamp${result.stampsUpdated === 1 ? "" : "s"} and ${result.setsUpdated} set${result.setsUpdated === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Recalculating failed.");
    } finally {
      setRecalculating(false);
      setConfirmOpen(false);
    }
  };

  // The scoring rules changed, so existing records are rescored once.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(RESCORE_FLAG)) return;
    window.localStorage.setItem(RESCORE_FLAG, "done");
    void runRecalculate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={recalculating}>
          {recalculating ? "Recalculating…" : "Recalculate priorities"}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalculate priorities?</AlertDialogTitle>
            <AlertDialogDescription>
              This works out the priority score and reasons again for every stamp and set from
              details already saved. Nothing is sent to the AI and no other details change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={recalculating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void runRecalculate();
              }}
              disabled={recalculating}
            >
              {recalculating ? "Working…" : "Recalculate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total stamps
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.totalStamps}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total sets</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.totalSets}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Containers</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.containerCount}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Stamps by container</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.byContainer.length === 0 ? (
              <span className="text-muted-foreground">No stamps yet</span>
            ) : (
              data.byContainer.map(([label, count]) => (
                <div key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Stamps by priority</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {TIERS.map((tier) => (
              <div key={tier} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(tier)}`} />
                  {PRIORITY_TIER_LABELS[tier]}
                </span>
                <span className="font-medium">{data.byTier[tier]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Top 20 by priority</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/stamps">Open stamps</Link>
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stamp</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.top20.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No stamps yet
                </TableCell>
              </TableRow>
            ) : (
              data.top20.map((item) => {
                const tier = priorityTier(item.priority_score);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to="/stamps" className="hover:underline">
                        {item.label}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.page_label}</TableCell>
                    <TableCell title={whyThisIsHere(item.priority_reasons)}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(tier)}`} />
                        {PRIORITY_TIER_LABELS[tier]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{item.priority_score}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

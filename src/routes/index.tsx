import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import { fetchDashboard, fetchTopValues, recalculatePriorities } from "@/lib/triage";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: fetchDashboard });
const topValuesQuery = queryOptions({ queryKey: ["dashboard", "top-values"], queryFn: fetchTopValues });

function euro(value: number | null) {
  return value === null ? "?" : `EUR ${value.toLocaleString("en-GB")}`;
}

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Stamp Triage" },
      {
        name: "description",
        content: "Overview of stamps, review progress and containers in your collection.",
      },
      { property: "og:title", content: "Dashboard — Stamp Triage" },
      {
        property: "og:description",
        content: "Overview of stamps, review progress and containers in your collection.",
      },
    ],
  }),
  component: Dashboard,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { data: topValues } = useSuspenseQuery(topValuesQuery);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const runRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await recalculatePriorities();
      await queryClient.invalidateQueries();
      toast.success(
        `Recalculated ${result.stampsUpdated} stamp${result.stampsUpdated === 1 ? "" : "s"} and ${result.setsUpdated} set${result.setsUpdated === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recalculating failed.");
    } finally {
      setRecalculating(false);
      setConfirmOpen(false);
    }
  };

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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By review status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.keys(data.byStatus).length === 0 ? (
              <span className="text-muted-foreground">No stamps yet</span>
            ) : (
              Object.entries(data.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span>{status}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Containers</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.containerCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Top 10 by estimated value</CardTitle>
          <p className="text-xs text-muted-foreground">
            These figures are AI guesses from photographs, not valuations.
          </p>
        </CardHeader>
        <CardContent>
          {topValues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No estimates yet. Ask for a research brief on a high priority item to get one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Est. sale value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topValues.map((item) => (
                  <TableRow key={`${item.kind}-${item.id}`}>
                    <TableCell>{item.label}</TableCell>
                    <TableCell className="text-muted-foreground">{item.kind}</TableCell>
                    <TableCell className="text-right">
                      {euro(item.value_low)} to {euro(item.value_high)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Stamps by country</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Stamps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byCountry.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No stamps yet
                </TableCell>
              </TableRow>
            ) : (
              data.byCountry.map(([country, count]) => (
                <TableRow key={country}>
                  <TableCell>{country}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

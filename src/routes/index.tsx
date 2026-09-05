import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchDashboard } from "@/lib/triage";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: fetchDashboard });

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
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

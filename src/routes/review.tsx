import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchReviewStamps } from "@/lib/triage";

const reviewQuery = queryOptions({ queryKey: ["review-stamps"], queryFn: fetchReviewStamps });

export const Route = createFileRoute("/review")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Review queue — Stamp Triage" },
      { name: "description", content: "Stamps waiting for review or expert attention." },
      { property: "og:title", content: "Review queue — Stamp Triage" },
      {
        property: "og:description",
        content: "Stamps waiting for review or expert attention.",
      },
    ],
  }),
  component: Review,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Review() {
  const { data: stamps } = useSuspenseQuery(reviewQuery);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Review</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Crop</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Denomination</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stamps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No stamps to review yet
              </TableCell>
            </TableRow>
          ) : (
            stamps.map((stamp) => (
              <TableRow key={stamp.id}>
                <TableCell>
                  <div className="h-12 w-10 rounded border bg-muted" aria-label="Crop placeholder" />
                </TableCell>
                <TableCell>{stamp.country ?? "—"}</TableCell>
                <TableCell>{stamp.denomination ?? "—"}</TableCell>
                <TableCell>{stamp.confidence ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{stamp.review_status}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

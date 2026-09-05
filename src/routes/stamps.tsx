import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchStamps, formatDenomination } from "@/lib/triage";

const stampsQuery = queryOptions({ queryKey: ["stamps"], queryFn: fetchStamps });

export const Route = createFileRoute("/stamps")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "All stamps — Stamp Triage" },
      { name: "description", content: "Browse and search every stamp recorded in the collection." },
      { property: "og:title", content: "All stamps — Stamp Triage" },
      {
        property: "og:description",
        content: "Browse and search every stamp recorded in the collection.",
      },
    ],
  }),
  component: Stamps,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Stamps() {
  const { data: stamps } = useSuspenseQuery(stampsQuery);
  const [search, setSearch] = useState("");

  const term = search.trim().toLowerCase();
  const filtered = term
    ? stamps.filter(
        (stamp) =>
          (stamp.country ?? "").toLowerCase().includes(term) ||
          (stamp.issue_name ?? "").toLowerCase().includes(term),
      )
    : stamps;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Stamps</h1>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search country or issue name"
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Country</TableHead>
            <TableHead>Denomination</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Item type</TableHead>
            <TableHead>Review status</TableHead>
            <TableHead className="text-right">Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                {stamps.length === 0 ? "No stamps recorded yet" : "No stamps match your search"}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((stamp) => (
              <TableRow key={stamp.id}>
                <TableCell>{stamp.country ?? "—"}</TableCell>
                <TableCell>{formatDenomination(stamp.denomination, stamp.currency)}</TableCell>
                <TableCell>{stamp.year_estimate ?? "—"}</TableCell>
                <TableCell>{stamp.item_type}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{stamp.review_status}</Badge>
                </TableCell>
                <TableCell className="text-right">{stamp.quantity}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

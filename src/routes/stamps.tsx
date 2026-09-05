import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Info } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchStamps, formatDenomination } from "@/lib/triage";

function euro(value: number | null) {
  return value === null ? "?" : `EUR ${value.toLocaleString("en-GB")}`;
}

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
  const [sort, setSort] = useState<"newest" | "value">("newest");

  const term = search.trim().toLowerCase();
  const filtered = term
    ? stamps.filter(
        (stamp) =>
          (stamp.country ?? "").toLowerCase().includes(term) ||
          (stamp.issue_name ?? "").toLowerCase().includes(term),
      )
    : stamps;

  const sorted =
    sort === "value"
      ? [...filtered].sort((a, b) => (b.value_high ?? -1) - (a.value_high ?? -1))
      : filtered;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Stamps</h1>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search country or issue name"
        className="max-w-sm"
      />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort by</span>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as "newest" | "value")}
          className="h-9 rounded-md border bg-background px-2"
        >
          <option value="newest">Newest first</option>
          <option value="value">Est. sale value</option>
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Country</TableHead>
            <TableHead>Denomination</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Item type</TableHead>
            <TableHead>Review status</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">
                Est. sale value
                <TooltipProvider>
                  <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" aria-label="About this figure" />
                  </TooltipTrigger>
                  <TooltipContent>
                    An AI guess from a photograph, not a valuation.
                  </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </TableHead>
            <TableHead className="text-right">Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                {stamps.length === 0 ? "No stamps recorded yet" : "No stamps match your search"}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((stamp) => (
              <TableRow key={stamp.id}>
                <TableCell>{stamp.country ?? "—"}</TableCell>
                <TableCell>{formatDenomination(stamp.denomination, stamp.currency)}</TableCell>
                <TableCell>{stamp.year_estimate ?? "—"}</TableCell>
                <TableCell>{stamp.item_type}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{stamp.review_status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {stamp.value_high === null && stamp.value_low === null
                    ? "—"
                    : `${euro(stamp.value_low)} to ${euro(stamp.value_high)}`}
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

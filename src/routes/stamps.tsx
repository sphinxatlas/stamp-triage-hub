import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EstimateAllHighPriority,
  EstimateCell,
  type EstimateTarget,
} from "@/components/estimate-cell";
import { SIGNIFICANCE_LABELS } from "@/components/market-lookup";
import { SetDetail, StampDetail } from "@/components/record-detail";
import { StampCrop } from "@/components/stamp-crop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
import {
  PRIORITY_TIER_LABELS,
  priorityDotClass,
  priorityTier,
  whyThisIsHere,
  type PriorityTier,
} from "@/lib/priority";
import {
  fetchAllSets,
  fetchBrowseStamps,
  formatDenomination,
  type BrowseStamp,
  type ReviewSet,
} from "@/lib/triage";
import { cn } from "@/lib/utils";


function euro(value: number | null) {
  return value === null ? "?" : `EUR ${value.toLocaleString("en-GB")}`;
}

function range(low: number | null, high: number | null) {
  return low === null && high === null ? "—" : `${euro(low)} to ${euro(high)}`;
}

const stampsQuery = queryOptions({ queryKey: ["browse-stamps"], queryFn: fetchBrowseStamps });
const setsQuery = queryOptions({ queryKey: ["browse-sets"], queryFn: fetchAllSets });

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

const ANY = "__any__";
const REVIEW_STATUSES = ["pending", "auto_accepted", "confirmed", "flagged_expert", "rejected"];
const TIERS: PriorityTier[] = ["high", "medium", "low", "skip"];
const SIGNIFICANCE_LEVELS = ["key_issue", "notable", "ordinary", "unknown"];

type SortKey = "newest" | "year" | "value" | "priority" | "country";

function EstimateHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      Est. sale value
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground" aria-label="About this figure" />
          </TooltipTrigger>
          <TooltipContent>An AI guess from a photograph, not a valuation.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

function PriorityCell({ score, reasons }: { score: number; reasons: string[] | null }) {
  const tier = priorityTier(score);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
            <span
              className={cn("h-2.5 w-2.5 shrink-0 rounded-full", priorityDotClass(tier))}
              aria-hidden="true"
            />
            {PRIORITY_TIER_LABELS[tier]}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{whyThisIsHere(reasons)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Stamps() {
  const { data } = useSuspenseQuery(stampsQuery);
  const { data: setsData } = useSuspenseQuery(setsQuery);

  const [view, setView] = useState<"stamps" | "sets">("stamps");
  const [search, setSearch] = useState("");
  const [container, setContainer] = useState(ANY);
  const [country, setCountry] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [tier, setTier] = useState(ANY);
  const [significance, setSignificance] = useState(ANY);
  const [onlySets, setOnlySets] = useState(false);
  const [sort, setSort] = useState<SortKey>("priority");

  const [openStamp, setOpenStamp] = useState<BrowseStamp | null>(null);
  const [openSet, setOpenSet] = useState<ReviewSet | null>(null);

  const containers = useMemo(
    () => Array.from(new Set(data.stamps.map((stamp) => stamp.container_label))).sort(),
    [data.stamps],
  );
  const countries = useMemo(
    () =>
      Array.from(
        new Set(data.stamps.map((stamp) => stamp.country).filter((c): c is string => !!c)),
      ).sort(),
    [data.stamps],
  );

  const term = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const rows = data.stamps.filter((stamp) => {
      if (term) {
        const hit =
          (stamp.country ?? "").toLowerCase().includes(term) ||
          (stamp.issue_name ?? "").toLowerCase().includes(term);
        if (!hit) return false;
      }
      if (container !== ANY && stamp.container_label !== container) return false;
      if (country !== ANY && stamp.country !== country) return false;
      if (status !== ANY && stamp.review_status !== status) return false;
      if (tier !== ANY && priorityTier(stamp.priority_score) !== tier) return false;
      if (significance !== ANY && stamp.significance_level !== significance) return false;
      if (onlySets && !stamp.set_id) return false;
      return true;
    });

    const sorted = [...rows];
    if (sort === "year") sorted.sort((a, b) => (b.year_estimate ?? -1) - (a.year_estimate ?? -1));
    if (sort === "value") sorted.sort((a, b) => (b.value_high ?? -1) - (a.value_high ?? -1));
    if (sort === "priority") sorted.sort((a, b) => b.priority_score - a.priority_score);
    if (sort === "country")
      sorted.sort((a, b) => (a.country ?? "zz").localeCompare(b.country ?? "zz"));
    return sorted;
  }, [data.stamps, term, container, country, status, tier, significance, onlySets, sort]);

  const filteredSets = useMemo(() => {
    const rows = setsData.sets.filter((item) => {
      if (term) {
        const hit =
          (item.country ?? "").toLowerCase().includes(term) ||
          item.set_name.toLowerCase().includes(term);
        if (!hit) return false;
      }
      if (container !== ANY && item.container_label !== container) return false;
      if (country !== ANY && item.country !== country) return false;
      if (status !== ANY && item.review_status !== status) return false;
      if (tier !== ANY && priorityTier(item.priority_score) !== tier) return false;
      if (significance !== ANY && item.significance_level !== significance) return false;
      return true;
    });
    const sorted = [...rows];
    if (sort === "year") sorted.sort((a, b) => (b.year_from ?? -1) - (a.year_from ?? -1));
    if (sort === "value") sorted.sort((a, b) => (b.value_high ?? -1) - (a.value_high ?? -1));
    if (sort === "priority") sorted.sort((a, b) => b.priority_score - a.priority_score);
    if (sort === "country")
      sorted.sort((a, b) => (a.country ?? "zz").localeCompare(b.country ?? "zz"));
    return sorted;
  }, [setsData.sets, term, container, country, status, tier, significance, sort]);

  const highTargets = useMemo<EstimateTarget[]>(() => {
    const needsEstimate = (low: number | null, high: number | null, score: number) =>
      priorityTier(score) === "high" && low === null && high === null;
    const stampTargets = data.stamps
      .filter((stamp) => needsEstimate(stamp.value_low, stamp.value_high, stamp.priority_score))
      .map((stamp) => ({
        kind: "stamp" as const,
        id: stamp.id,
        label: `${stamp.country ?? "Unknown"} ${stamp.issue_name ?? ""}`.trim(),
      }));
    const setTargets = setsData.sets
      .filter((item) => needsEstimate(item.value_low, item.value_high, item.priority_score))
      .map((item) => ({ kind: "set" as const, id: item.id, label: item.set_name }));
    return [...stampTargets, ...setTargets];
  }, [data.stamps, setsData.sets]);



  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Stamps</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === "stamps" ? "default" : "outline"}
            onClick={() => setView("stamps")}
          >
            Stamps ({data.stamps.length})
          </Button>
          <Button
            size="sm"
            variant={view === "sets" ? "default" : "outline"}
            onClick={() => setView("sets")}
          >
            Sets ({setsData.sets.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search country or issue name"
        />
        <Picker
          label="Container"
          value={container}
          onChange={setContainer}
          options={containers}
          anyLabel="All containers"
        />
        <Picker
          label="Country"
          value={country}
          onChange={setCountry}
          options={countries}
          anyLabel="All countries"
        />
        <Picker
          label="Review status"
          value={status}
          onChange={setStatus}
          options={REVIEW_STATUSES}
          anyLabel="All statuses"
        />
        <Picker
          label="Priority"
          value={tier}
          onChange={setTier}
          options={TIERS}
          labels={PRIORITY_TIER_LABELS}
          anyLabel="All priorities"
        />
        <Picker
          label="Significance"
          value={significance}
          onChange={setSignificance}
          options={SIGNIFICANCE_LEVELS}
          labels={SIGNIFICANCE_LABELS}
          anyLabel="All significance"
        />
        <div className="space-y-2">
          <Label htmlFor="sort">Sort by</Label>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger id="sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="year">Year</SelectItem>
              <SelectItem value="value">Est. sale value</SelectItem>
              <SelectItem value="priority">Priority score</SelectItem>
              <SelectItem value="country">Country</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {view === "stamps" ? (
          <div className="flex items-end gap-2 pb-2">
            <Switch id="only-sets" checked={onlySets} onCheckedChange={setOnlySets} />
            <Label htmlFor="only-sets">Only stamps in sets</Label>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <EstimateAllHighPriority targets={highTargets} />
        <p className="text-xs text-muted-foreground">
          Rough estimates come from the photo, not from a valuer.
        </p>
      </div>

      <div>
      {view === "stamps" ? (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead className="w-28">Page</TableHead>
              <TableHead className="w-28">Country</TableHead>
              <TableHead className="w-24">Value</TableHead>
              <TableHead className="w-16">Year</TableHead>
              <TableHead>Issue or set</TableHead>
              <TableHead className="w-36">Priority</TableHead>
              <TableHead className="w-40 text-right">
                <EstimateHeader />
              </TableHead>
              <TableHead className="w-28">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  {data.stamps.length === 0
                    ? "No stamps recorded yet"
                    : "No stamps match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((stamp) => {
                const name = stamp.set_name ?? stamp.issue_name ?? "—";
                return (
                <TableRow
                  key={stamp.id}
                  className="cursor-pointer"
                  onClick={() => setOpenStamp(stamp)}
                >
                  <TableCell>
                    <StampCrop
                      photoUrl={
                        stamp.page_photo_path ? data.photoUrls[stamp.page_photo_path] : undefined
                      }
                      bbox={stamp.bbox}
                      label={`Stamp on ${stamp.page_label}`}
                      className="h-14 w-12"
                    />
                  </TableCell>
                  <TableCell className="truncate text-xs text-muted-foreground">
                    {stamp.page_label}
                  </TableCell>
                  <TableCell className="truncate">{stamp.country ?? "—"}</TableCell>
                  <TableCell className="truncate">
                    {formatDenomination(stamp.denomination, stamp.currency)}
                  </TableCell>
                  <TableCell>{stamp.year_estimate ?? "—"}</TableCell>
                  <TableCell className="truncate" title={name}>
                    {name}
                  </TableCell>
                  <TableCell>
                    <PriorityCell
                      score={stamp.priority_score}
                      reasons={stamp.priority_reasons}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {stamp.value_low === null && stamp.value_high === null ? (
                      <EstimateCell kind="stamp" id={stamp.id} />
                    ) : (
                      range(stamp.value_low, stamp.value_high)
                    )}
                  </TableCell>
                  <TableCell className="truncate">
                    <Badge variant="secondary">{stamp.review_status}</Badge>
                  </TableCell>
                </TableRow>
                );
              })
            )}

          </TableBody>
        </Table>
      ) : (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">Members</TableHead>
              <TableHead>Set</TableHead>
              <TableHead className="w-32">Catalogue</TableHead>
              <TableHead className="w-20">Present</TableHead>
              <TableHead className="w-28">Complete</TableHead>
              <TableHead className="w-36">Priority</TableHead>
              <TableHead className="w-40 text-right">
                <EstimateHeader />
              </TableHead>
              <TableHead>Review status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  {setsData.sets.length === 0 ? "No sets recorded yet" : "No sets match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              filteredSets.map((item) => {
                const complete =
                  item.item_count === null
                    ? "Unknown"
                    : item.member_count >= item.item_count
                      ? "Complete"
                      : "Incomplete";
                return (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setOpenSet(item)}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {item.members.slice(0, 4).map((member) => (
                          <StampCrop
                            key={member.id}
                            photoUrl={
                              member.photo_path ? setsData.photoUrls[member.photo_path] : undefined
                            }
                            bbox={member.bbox}
                            label={item.set_name}
                            className="h-12 w-10 shrink-0"
                          />
                        ))}
                        {item.member_count > 4 ? (
                          <span className="text-xs text-muted-foreground">
                            +{item.member_count - 4} more
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="truncate" title={item.set_name}>
                      <p className="truncate font-medium">{item.set_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.container_label} · {item.page_label}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {[item.catalogue_system, item.catalogue_range].filter(Boolean).join(" ") ||
                        "—"}
                    </TableCell>
                    <TableCell>
                      {item.member_count} of {item.item_count ?? "?"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={complete === "Complete" ? "default" : "secondary"}
                        className={cn(complete === "Incomplete" && "bg-muted text-muted-foreground")}
                      >
                        {complete}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PriorityCell score={item.priority_score} reasons={item.priority_reasons} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {item.value_low === null && item.value_high === null ? (
                        <EstimateCell kind="set" id={item.id} />
                      ) : (
                        range(item.value_low, item.value_high)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.review_status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
      </div>

      <Sheet open={openStamp !== null} onOpenChange={(open) => !open && setOpenStamp(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {openStamp ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {openStamp.country ?? "Unknown"} ·{" "}
                  {formatDenomination(openStamp.denomination, openStamp.currency)}
                </SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <StampDetail
                  key={openStamp.id}
                  stamp={openStamp}
                  photoUrl={
                    openStamp.page_photo_path
                      ? data.photoUrls[openStamp.page_photo_path]
                      : undefined
                  }
                  onRemoved={() => setOpenStamp(null)}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={openSet !== null} onOpenChange={(open) => !open && setOpenSet(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {openSet ? (
            <>
              <SheetHeader>
                <SheetTitle>{openSet.set_name}</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <SetDetail key={openSet.id} record={openSet} onRemoved={() => setOpenSet(null)} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
  labels,
  anyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  labels?: Record<string, string>;
  anyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

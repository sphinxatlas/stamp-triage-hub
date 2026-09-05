import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { SIGNIFICANCE_LABELS, SignificanceBadgeClass } from "@/components/market-lookup";
import { SetDetail, StampDetail } from "@/components/record-detail";
import { StampCrop } from "@/components/stamp-crop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_TIER_LABELS,
  priorityTier,
  priorityTierBadgeClass,
  whyThisIsHere,
} from "@/lib/priority";
import {
  fetchReviewQueue,
  fetchReviewSets,
  formatDenomination,
  type ReviewSet,
} from "@/lib/triage";
import { cn } from "@/lib/utils";

const queueQuery = queryOptions({ queryKey: ["review-queue"], queryFn: fetchReviewQueue });
const setsQuery = queryOptions({ queryKey: ["review-sets"], queryFn: () => fetchReviewSets() });

export const Route = createFileRoute("/review")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Review queue — Stamp Triage" },
      { name: "description", content: "Check machine guesses and record what each stamp is." },
      { property: "og:title", content: "Review queue — Stamp Triage" },
      {
        property: "og:description",
        content: "Check machine guesses and record what each stamp is.",
      },
    ],
  }),
  component: Review,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "flagged_expert", label: "Flagged for expert" },
] as const;

function Review() {
  const { data } = useSuspenseQuery(queueQuery);
  const { data: setsData } = useSuspenseQuery(setsQuery);
  const sets = setsData.sets;
  const [view, setView] = useState<"stamps" | "sets">("stamps");
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      filter === "all"
        ? data.stamps
        : data.stamps.filter((stamp) => stamp.review_status === filter),
    [data.stamps, filter],
  );

  useEffect(() => {
    if (visible.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !visible.some((stamp) => stamp.id === selectedId)) {
      setSelectedId(visible[0]!.id);
    }
  }, [visible, selectedId]);

  const visibleSets = useMemo(
    () => (filter === "all" ? sets : sets.filter((item) => item.review_status === filter)),
    [sets, filter],
  );

  const selected = visible.find((stamp) => stamp.id === selectedId) ?? null;

  const selectNext = (removedId: string) => {
    const index = visible.findIndex((stamp) => stamp.id === removedId);
    const next = visible[index + 1] ?? visible[index - 1] ?? null;
    setSelectedId(next ? next.id : null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {view === "sets"
            ? `${visibleSets.length} set${visibleSets.length === 1 ? "" : "s"} to review`
            : `${visible.length} stamp${visible.length === 1 ? "" : "s"} to review`}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "stamps" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("stamps")}
          >
            Stamps
          </Button>
          <Button
            variant={view === "sets" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("sets")}
          >
            Sets ({sets.length})
          </Button>
        </div>
        <div className="w-56">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "sets" ? (
        <SetsPanel sets={visibleSets} photoUrls={setsData.photoUrls} />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border p-6 text-muted-foreground">Nothing left to review</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {visible.map((stamp) => (
              <button
                key={stamp.id}
                type="button"
                onClick={() => setSelectedId(stamp.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent",
                  stamp.id === selectedId && "border-primary bg-accent",
                )}
              >
                <StampCrop
                  photoUrl={
                    stamp.page_photo_path ? data.photoUrls[stamp.page_photo_path] : undefined
                  }
                  bbox={stamp.bbox}
                  label={`Stamp on ${stamp.page_label}`}
                  className="h-16 w-14 shrink-0"
                />
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {stamp.container_label} · {stamp.page_label}
                  </p>
                  <p className="truncate text-sm font-medium">{stamp.country ?? "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDenomination(stamp.denomination, stamp.currency)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{stamp.review_status}</Badge>
                    <Badge className={priorityTierBadgeClass(priorityTier(stamp.priority_score))}>
                      {PRIORITY_TIER_LABELS[priorityTier(stamp.priority_score)]}
                    </Badge>
                    {stamp.significance_level === "key_issue" ||
                    stamp.significance_level === "notable" ? (
                      <Badge className={SignificanceBadgeClass(stamp.significance_level)}>
                        {SIGNIFICANCE_LABELS[stamp.significance_level]}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {whyThisIsHere(stamp.priority_reasons)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <StampDetail
              key={selected.id}
              stamp={selected}
              photoUrl={
                selected.page_photo_path ? data.photoUrls[selected.page_photo_path] : undefined
              }
              onRemoved={() => selectNext(selected.id)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function SetsPanel({
  sets,
  photoUrls,
}: {
  sets: ReviewSet[];
  photoUrls: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (sets.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !sets.some((item) => item.id === selectedId)) {
      setSelectedId(sets[0]!.id);
    }
  }, [sets, selectedId]);

  const selected = sets.find((item) => item.id === selectedId) ?? null;

  const selectNext = (removedId: string) => {
    const index = sets.findIndex((item) => item.id === removedId);
    const next = sets[index + 1] ?? sets[index - 1] ?? null;
    setSelectedId(next ? next.id : null);
  };

  if (sets.length === 0) {
    return <p className="rounded-lg border p-6 text-muted-foreground">Nothing left to review</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {sets.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className={cn(
              "w-full space-y-1 rounded-lg border p-2 text-left transition-colors hover:bg-accent",
              item.id === selectedId && "border-primary bg-accent",
            )}
          >
            <p className="truncate text-xs text-muted-foreground">
              {item.container_label} · {item.page_label}
            </p>
            <p className="truncate text-sm font-medium">{item.set_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[item.country, item.year_from].filter(Boolean).join(" · ") || "—"}
            </p>
            {item.members.length > 0 ? (
              <div className="flex items-center gap-1">
                {item.members.slice(0, 4).map((member) => (
                  <StampCrop
                    key={member.id}
                    photoUrl={member.photo_path ? photoUrls[member.photo_path] : undefined}
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
            ) : null}
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{item.review_status}</Badge>
              <Badge className={priorityTierBadgeClass(priorityTier(item.priority_score))}>
                {PRIORITY_TIER_LABELS[priorityTier(item.priority_score)]}
              </Badge>
              {item.significance_level === "key_issue" || item.significance_level === "notable" ? (
                <Badge className={SignificanceBadgeClass(item.significance_level)}>
                  {SIGNIFICANCE_LABELS[item.significance_level]}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{whyThisIsHere(item.priority_reasons)}</p>
          </button>
        ))}
      </div>

      {selected ? (
        <SetDetail key={selected.id} record={selected} onRemoved={() => selectNext(selected.id)} />
      ) : null}
    </div>
  );
}

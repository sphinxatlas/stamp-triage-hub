import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  MarketLookup,
  SIGNIFICANCE_LABELS,
  SignificanceBadgeClass,
} from "@/components/market-lookup";
import { PageWithBox, StampCrop } from "@/components/stamp-crop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  PRIORITY_TIER_LABELS,
  priorityTier,
  priorityTierBadgeClass,
  whyThisIsHere,
} from "@/lib/priority";
import { researchBrief } from "@/lib/research.functions";
import {
  FAULT_OPTIONS,
  FORMAT_OPTIONS,
  GUM_OPTIONS,
  ITEM_TYPE_OPTIONS,
  MINT_OPTIONS,
  fetchReviewQueue,
  fetchReviewSets,
  formatDenomination,
  saveSet,
  saveStamp,
  type ReviewSet,
  type ReviewStamp,
  type SetEdits,
  type StampEdits,
} from "@/lib/triage";
import { cn } from "@/lib/utils";

const queueQuery = queryOptions({ queryKey: ["review-queue"], queryFn: fetchReviewQueue });
const setsQuery = queryOptions({ queryKey: ["review-sets"], queryFn: fetchReviewSets });

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

function toEdits(stamp: ReviewStamp): StampEdits {
  return {
    country: stamp.country,
    country_inscription: stamp.country_inscription,
    year_estimate: stamp.year_estimate,
    denomination: stamp.denomination,
    currency: stamp.currency,
    issue_name: stamp.issue_name,
    catalogue_system: stamp.catalogue_system,
    catalogue_number: stamp.catalogue_number,
    item_type: stamp.item_type,
    format: stamp.format,
    mint_or_used: stamp.mint_or_used ?? "unknown",
    gum_state: stamp.gum_state,
    perforation: stamp.perforation,
    watermark: stamp.watermark,
    faults: stamp.faults ?? [],
    quantity: stamp.quantity,
    notes: stamp.notes,
    market_notes: stamp.market_notes,
  };
}

function toSetEdits(record: ReviewSet): SetEdits {
  return {
    set_name: record.set_name,
    country: record.country,
    year_from: record.year_from,
    year_to: record.year_to,
    catalogue_system: record.catalogue_system,
    catalogue_range: record.catalogue_range,
    item_count: record.item_count,
    notes: record.notes,
    market_notes: record.market_notes,
  };
}

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
                  photoUrl={stamp.page_photo_path ? data.photoUrls[stamp.page_photo_path] : undefined}
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

function StampDetail({
  stamp,
  photoUrl,
  onRemoved,
}: {
  stamp: ReviewStamp;
  photoUrl: string | undefined;
  onRemoved: () => void;
}) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<StampEdits>(() => toEdits(stamp));

  const set = <K extends keyof StampEdits>(key: K, value: StampEdits[K]) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["stamps"] });
    queryClient.invalidateQueries({ queryKey: ["review-stamps"] });
    queryClient.invalidateQueries({ queryKey: ["page-stamp-counts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const decide = useMutation({
    mutationFn: async (status?: "confirmed" | "flagged_expert" | "rejected") => {
      await saveStamp(stamp.id, edits, status);
      return status;
    },
    onSuccess: (status) => {
      if (status) {
        onRemoved();
        toast.success(
          status === "confirmed"
            ? "Stamp confirmed"
            : status === "rejected"
              ? "Marked as not a stamp"
              : "Flagged for expert",
        );
      } else {
        toast.success("Changes saved");
      }
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confidence = (value: number | null) =>
    value === null ? "—" : Number(value).toFixed(2);

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-start gap-4">
        <StampCrop
          photoUrl={photoUrl}
          bbox={stamp.bbox}
          label={`Stamp on ${stamp.page_label}`}
          className="h-56 w-48"
        />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            {stamp.country ?? "Unknown"} · {formatDenomination(stamp.denomination, stamp.currency)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {stamp.container_label} · {stamp.page_label}
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="px-0">
                View full page
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{stamp.page_label}</DialogTitle>
              </DialogHeader>
              <PageWithBox photoUrl={photoUrl} bbox={stamp.bbox} label={stamp.page_label} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <section className="space-y-2 rounded-lg bg-muted/50 p-4">
        <h2 className="text-sm font-semibold">What the AI reported</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Reported label="Issue name" value={stamp.issue_name} />
          <Reported
            label="Catalogue"
            value={
              [stamp.catalogue_system, stamp.catalogue_number].filter(Boolean).join(" ") || null
            }
          />
          <Reported label="Item type" value={stamp.item_type} />
          <Reported label="Format" value={stamp.format} />
          <Reported label="Mint or used" value={stamp.mint_or_used} />
          <Reported label="Hinged guess" value={stamp.hinged_guess} />
          <Reported label="Faults" value={stamp.faults?.length ? stamp.faults.join(", ") : null} />
          <Reported label="Condition notes" value={stamp.condition_notes} />
          <Reported label="Overall confidence" value={confidence(stamp.confidence)} />
          <Reported label="Year confidence" value={confidence(stamp.year_confidence)} />
          <Reported label="Catalogue confidence" value={confidence(stamp.catalogue_confidence)} />
          <Reported label="Reasoning" value={stamp.notes} />
        </dl>
        <div className="space-y-2 border-t pt-3">
          <Badge className={SignificanceBadgeClass(stamp.significance_level)}>
            {SIGNIFICANCE_LABELS[stamp.significance_level] ?? stamp.significance_level}
          </Badge>
          <p className="text-sm">{stamp.significance ?? "No note on how this issue is regarded."}</p>
          <h3 className="text-xs font-semibold">What to have an expert check</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Reported label="Forgery risk" value={stamp.forgery_risk} />
            <Reported label="Variants to check" value={stamp.variants_to_check} />
          </dl>
        </div>
        <p className="text-xs text-muted-foreground">These are unverified machine guesses.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Your record</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Input
              value={edits.country ?? ""}
              onChange={(event) => set("country", event.target.value || null)}
            />
          </Field>
          <Field label="Country inscription">
            <Input
              value={edits.country_inscription ?? ""}
              onChange={(event) => set("country_inscription", event.target.value || null)}
            />
          </Field>
          <Field label="Year">
            <Input
              type="number"
              value={edits.year_estimate ?? ""}
              onChange={(event) =>
                set("year_estimate", event.target.value ? Number(event.target.value) : null)
              }
            />
          </Field>
          <Field label="Denomination">
            <Input
              value={edits.denomination ?? ""}
              onChange={(event) => set("denomination", event.target.value || null)}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={edits.currency ?? ""}
              onChange={(event) => set("currency", event.target.value || null)}
            />
          </Field>
          <Field label="Issue name">
            <Input
              value={edits.issue_name ?? ""}
              onChange={(event) => set("issue_name", event.target.value || null)}
            />
          </Field>
          <Field label="Catalogue system">
            <Input
              value={edits.catalogue_system ?? ""}
              onChange={(event) => set("catalogue_system", event.target.value || null)}
            />
          </Field>
          <Field label="Catalogue number">
            <Input
              value={edits.catalogue_number ?? ""}
              onChange={(event) => set("catalogue_number", event.target.value || null)}
            />
          </Field>
          <Field label="Item type">
            <Choice
              value={edits.item_type}
              options={ITEM_TYPE_OPTIONS}
              onChange={(value) => set("item_type", value)}
            />
          </Field>
          <Field label="Format">
            <Choice
              value={edits.format}
              options={FORMAT_OPTIONS}
              onChange={(value) => set("format", value)}
            />
          </Field>
          <Field label="Mint or used">
            <Choice
              value={edits.mint_or_used ?? "unknown"}
              options={MINT_OPTIONS}
              onChange={(value) => set("mint_or_used", value)}
            />
          </Field>
          <Field label="Quantity">
            <Input
              type="number"
              min={1}
              value={edits.quantity}
              onChange={(event) => set("quantity", Math.max(1, Number(event.target.value) || 1))}
            />
          </Field>
        </div>

        <p className="text-xs text-muted-foreground">
          Only fill these in if you have physically checked the stamp.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Gum state">
            <Choice
              value={edits.gum_state}
              options={GUM_OPTIONS}
              onChange={(value) => set("gum_state", value)}
            />
          </Field>
          <Field label="Perforation">
            <Input
              placeholder="Not checked"
              value={edits.perforation ?? ""}
              onChange={(event) => set("perforation", event.target.value || null)}
            />
          </Field>
          <Field label="Watermark">
            <Input
              placeholder="Not checked"
              value={edits.watermark ?? ""}
              onChange={(event) => set("watermark", event.target.value || null)}
            />
          </Field>
        </div>

        <Field label="Faults">
          <div className="flex flex-wrap gap-2">
            {FAULT_OPTIONS.map((fault) => (
              <Toggle
                key={fault}
                size="sm"
                variant="outline"
                pressed={edits.faults.includes(fault)}
                onPressedChange={(pressed) =>
                  set(
                    "faults",
                    pressed
                      ? [...edits.faults, fault]
                      : edits.faults.filter((item) => item !== fault),
                  )
                }
              >
                {fault}
              </Toggle>
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <Textarea
            value={edits.notes ?? ""}
            onChange={(event) => set("notes", event.target.value || null)}
          />
        </Field>

        {priorityTier(stamp.priority_score) === "high" ? (
          <ResearchBriefBlock
            kind="stamp"
            id={stamp.id}
            brief={stamp.research_brief}
            generatedAt={stamp.research_brief_generated_at}
          />
        ) : null}

        <MarketLookup
          record={{
            country: edits.country,
            year: edits.year_estimate,
            issue_name: edits.issue_name,
            denomination: edits.denomination,
            catalogue_system: edits.catalogue_system,
            catalogue_reference: edits.catalogue_number,
          }}
        />

        <Field label="Market notes">
          <Textarea
            placeholder="Paste what you found and what it sold for"
            value={edits.market_notes ?? ""}
            onChange={(event) => set("market_notes", event.target.value || null)}
          />
        </Field>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button disabled={decide.isPending} onClick={() => decide.mutate("confirmed")}>
          Confirm
        </Button>
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate("flagged_expert")}
        >
          Flag for expert
        </Button>
        <Button
          variant="destructive"
          disabled={decide.isPending}
          onClick={() => decide.mutate("rejected")}
        >
          Not a stamp
        </Button>
        <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate(undefined)}>
          Save without deciding
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Reported({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value ?? "—"}</dd>
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
        <SetDetail
          key={selected.id}
          record={selected}
          onRemoved={() => selectNext(selected.id)}
        />
      ) : null}
    </div>
  );
}

function SetDetail({ record, onRemoved }: { record: ReviewSet; onRemoved: () => void }) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<SetEdits>(() => toSetEdits(record));

  const set = <K extends keyof SetEdits>(key: K, value: SetEdits[K]) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  const decide = useMutation({
    mutationFn: async (status?: "confirmed" | "flagged_expert" | "rejected") => {
      await saveSet(record.id, edits, status);
      return status;
    },
    onSuccess: (status) => {
      if (status) {
        onRemoved();
        toast.success(status === "confirmed" ? "Set confirmed" : status === "rejected" ? "Set rejected" : "Flagged for expert");
      } else {
        toast.success("Changes saved");
      }
      queryClient.invalidateQueries({ queryKey: ["review-sets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{record.set_name}</h2>
        <p className="text-sm text-muted-foreground">
          {record.container_label} · {record.page_label}
        </p>
      </div>

      <section className="space-y-2 rounded-lg bg-muted/50 p-4">
        <h2 className="text-sm font-semibold">What the AI reported</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Reported label="Country" value={record.country} />
          <Reported
            label="Years"
            value={[record.year_from, record.year_to].filter(Boolean).join("–") || null}
          />
          <Reported
            label="Catalogue"
            value={[record.catalogue_system, record.catalogue_range].filter(Boolean).join(" ") || null}
          />
          <Reported
            label="Items on page"
            value={record.item_count === null ? null : String(record.item_count)}
          />
          <Reported
            label="Confidence"
            value={record.confidence === null ? "—" : Number(record.confidence).toFixed(2)}
          />
          <Reported
            label="Priority score"
            value={`${record.priority_score}${
              record.priority_reasons?.length ? ` (${record.priority_reasons.join(", ")})` : ""
            }`}
          />
          <Reported label="Reasoning" value={record.notes} />
        </dl>
        <div className="space-y-2 border-t pt-3">
          <Badge className={SignificanceBadgeClass(record.significance_level)}>
            {SIGNIFICANCE_LABELS[record.significance_level] ?? record.significance_level}
          </Badge>
          <p className="text-sm">
            {record.significance ?? "No note on how this set is regarded."}
          </p>
          <h3 className="text-xs font-semibold">What to have an expert check</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Reported label="Forgery risk" value={record.forgery_risk} />
            <Reported label="Variants to check" value={record.variants_to_check} />
          </dl>
        </div>
        <p className="text-xs text-muted-foreground">These are unverified machine guesses.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Your record</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Set name">
            <Input value={edits.set_name} onChange={(event) => set("set_name", event.target.value)} />
          </Field>
          <Field label="Country">
            <Input
              value={edits.country ?? ""}
              onChange={(event) => set("country", event.target.value || null)}
            />
          </Field>
          <Field label="Year from">
            <Input
              type="number"
              value={edits.year_from ?? ""}
              onChange={(event) =>
                set("year_from", event.target.value ? Number(event.target.value) : null)
              }
            />
          </Field>
          <Field label="Year to">
            <Input
              type="number"
              value={edits.year_to ?? ""}
              onChange={(event) =>
                set("year_to", event.target.value ? Number(event.target.value) : null)
              }
            />
          </Field>
          <Field label="Catalogue system">
            <Input
              value={edits.catalogue_system ?? ""}
              onChange={(event) => set("catalogue_system", event.target.value || null)}
            />
          </Field>
          <Field label="Catalogue range">
            <Input
              value={edits.catalogue_range ?? ""}
              onChange={(event) => set("catalogue_range", event.target.value || null)}
            />
          </Field>
          <Field label="Items on page">
            <Input
              type="number"
              value={edits.item_count ?? ""}
              onChange={(event) =>
                set("item_count", event.target.value ? Number(event.target.value) : null)
              }
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            value={edits.notes ?? ""}
            onChange={(event) => set("notes", event.target.value || null)}
          />
        </Field>

        {priorityTier(record.priority_score) === "high" ? (
          <ResearchBriefBlock
            kind="set"
            id={record.id}
            brief={record.research_brief}
            generatedAt={record.research_brief_generated_at}
          />
        ) : null}

        <MarketLookup
          record={{
            country: edits.country,
            year: edits.year_from,
            issue_name: edits.set_name,
            catalogue_system: edits.catalogue_system,
            catalogue_reference: edits.catalogue_range,
          }}
        />

        <Field label="Market notes">
          <Textarea
            placeholder="Paste what you found and what it sold for"
            value={edits.market_notes ?? ""}
            onChange={(event) => set("market_notes", event.target.value || null)}
          />
        </Field>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button disabled={decide.isPending} onClick={() => decide.mutate("confirmed")}>
          Confirm
        </Button>
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate("flagged_expert")}
        >
          Flag for expert
        </Button>
        <Button
          variant="destructive"
          disabled={decide.isPending}
          onClick={() => decide.mutate("rejected")}
        >
          Reject set
        </Button>
        <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate(undefined)}>
          Save without deciding
        </Button>
      </div>
    </div>
  );
}

function ResearchBriefBlock({
  kind,
  id,
  brief,
  generatedAt,
}: {
  kind: "stamp" | "set";
  id: string;
  brief: string | null;
  generatedAt: string | null;
}) {
  const queryClient = useQueryClient();
  const generate = useServerFn(researchBrief);
  const [text, setText] = useState(brief);
  const [when, setWhen] = useState(generatedAt);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText(brief);
    setWhen(generatedAt);
  }, [brief, generatedAt, id]);

  const run = async () => {
    setBusy(true);
    try {
      const result = await generate({ data: { kind, id } });
      setText(result.research_brief);
      setWhen(result.research_brief_generated_at);
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["review-sets"] });
      toast.success("Research brief ready");
    } catch (error) {
      toast.error((error as Error).message || "Could not write the brief");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Research brief</h2>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
          {busy ? "Writing…" : text ? "Regenerate" : "Research brief"}
        </Button>
      </div>
      {text ? (
        <>
          <p className="whitespace-pre-wrap text-sm">{text}</p>
          {when ? (
            <p className="text-xs text-muted-foreground">
              Written {new Date(when).toLocaleString()}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            This describes the item, not its price. Use the sold listings below for real prices, and
            a professional valuation for a real figure.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask for a short plain-English brief on this item before taking it to a valuer.
        </p>
      )}
    </section>
  );
}

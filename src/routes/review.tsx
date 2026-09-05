import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  FAULT_OPTIONS,
  FORMAT_OPTIONS,
  GUM_OPTIONS,
  ITEM_TYPE_OPTIONS,
  MINT_OPTIONS,
  fetchReviewQueue,
  saveStamp,
  type ReviewStamp,
  type StampEdits,
} from "@/lib/triage";
import { cn } from "@/lib/utils";

const queueQuery = queryOptions({ queryKey: ["review-queue"], queryFn: fetchReviewQueue });

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
  };
}

function Review() {
  const { data } = useSuspenseQuery(queueQuery);
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
          {visible.length} stamp{visible.length === 1 ? "" : "s"} to review
        </h1>
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

      {visible.length === 0 ? (
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
                  <Badge variant="secondary">{stamp.review_status}</Badge>
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

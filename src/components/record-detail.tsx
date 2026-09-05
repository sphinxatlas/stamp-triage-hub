import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MarketLookup } from "@/components/market-lookup";
import { PageWithBox, StampCrop } from "@/components/stamp-crop";
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
  formatDenomination,
  saveSet,
  saveStamp,
  type ReviewSet,
  type ReviewStamp,
  type SetEdits,
  type StampEdits,
} from "@/lib/triage";

export function toEdits(stamp: ReviewStamp): StampEdits {
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

export function toSetEdits(record: ReviewSet): SetEdits {
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Choice({
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

export function Reported({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}

export function StampDetail({
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
    for (const key of [
      "review-queue",
      "stamps",
      "browse-stamps",
      "review-stamps",
      "page-stamp-counts",
      "dashboard",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
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

  const confidence = (value: number | null) => (value === null ? "—" : Number(value).toFixed(2));

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
          <Reported label="Faults" value={stamp.faults?.length ? stamp.faults.join(", ") : null} />
          <Reported label="Overall confidence" value={confidence(stamp.confidence)} />
          <Reported label="Year confidence" value={confidence(stamp.year_confidence)} />
          <Reported label="Catalogue confidence" value={confidence(stamp.catalogue_confidence)} />
          <Reported label="Note" value={stamp.notes} />
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
          Save
        </Button>
        <Button
          variant="destructive"
          disabled={decide.isPending}
          onClick={() => decide.mutate("rejected")}
        >
          Not a stamp
        </Button>
      </div>
    </div>
  );
}

export function SetDetail({ record, onRemoved }: { record: ReviewSet; onRemoved: () => void }) {
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
        toast.success(
          status === "confirmed"
            ? "Set confirmed"
            : status === "rejected"
              ? "Set rejected"
              : "Flagged for expert",
        );
      } else {
        toast.success("Changes saved");
      }
      queryClient.invalidateQueries({ queryKey: ["review-sets"] });
      queryClient.invalidateQueries({ queryKey: ["browse-sets"] });
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
            value={
              [record.catalogue_system, record.catalogue_range].filter(Boolean).join(" ") || null
            }
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
          <Reported label="Note" value={record.notes} />
        </dl>
        <p className="text-xs text-muted-foreground">These are unverified machine guesses.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Your record</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Set name">
            <Input
              value={edits.set_name}
              onChange={(event) => set("set_name", event.target.value)}
            />
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
          Save
        </Button>
        <Button
          variant="destructive"
          disabled={decide.isPending}
          onClick={() => decide.mutate("rejected")}
        >
          Not a set
        </Button>
      </div>
    </div>
  );
}

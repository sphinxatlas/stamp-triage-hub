import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useIdentifyRun } from "@/components/identify-run";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchContainers, nextPageLabel } from "@/lib/triage";
import { cn } from "@/lib/utils";

const containersQuery = queryOptions({ queryKey: ["containers"], queryFn: fetchContainers });

export const Route = createFileRoute("/capture")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Capture pages — Stamp Triage" },
      { name: "description", content: "Photograph album pages or loose grids and attach them." },
      { property: "og:title", content: "Capture pages — Stamp Triage" },
      {
        property: "og:description",
        content: "Photograph album pages or loose grids and attach them.",
      },
    ],
  }),
  component: Capture,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

type Staged = {
  key: string;
  file: File;
  preview: string;
  label: string;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
};

function bumpLabel(base: string, offset: number) {
  const match = /^(.*-P)(\d+)$/.exec(base);
  if (!match) return `${base}-${offset + 1}`;
  const n = Number(match[2]) + offset;
  return `${match[1]}${String(n).padStart(match[2]!.length, "0")}`;
}

function Capture() {
  const queryClient = useQueryClient();
  const { data: containers } = useSuspenseQuery(containersQuery);
  const { start } = useIdentifyRun();

  const [containerId, setContainerId] = useState("");
  const [captureType, setCaptureType] = useState("album_page");
  const [identifyAfter, setIdentifyAfter] = useState(true);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      for (const item of staged) URL.revokeObjectURL(item.preview);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const relabel = async (items: Staged[], targetContainerId: string) => {
    const container = containers.find((entry) => entry.id === targetContainerId);
    if (!container) return items;
    const base = await nextPageLabel(container.label, container.id);
    return items.map((item, index) => ({ ...item, label: bumpLabel(base, index) }));
  };

  const addFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    const sorted = [...images].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    const next: Staged[] = sorted.map((file, index) => ({
      key: `${file.name}-${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      label: "",
      state: "waiting",
    }));
    const combined = [...staged.filter((item) => item.state !== "done"), ...next];
    setStaged(containerId ? await relabel(combined, containerId) : combined);
  };

  const chooseContainer = async (value: string) => {
    setContainerId(value);
    setStaged(await relabel(staged, value));
  };

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of staged) {
      const key = item.label.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return seen;
  }, [staged]);

  const hasDuplicates = Array.from(duplicates.entries()).some(
    ([label, count]) => label !== "" && count > 1,
  );

  const upload = useMutation({
    mutationFn: async () => {
      const container = containers.find((item) => item.id === containerId);
      if (!container) throw new Error("Choose a container first");
      if (staged.length === 0) throw new Error("Choose at least one image");
      if (hasDuplicates) throw new Error("Two pages have the same label");

      const createdIds: string[] = [];
      let failures = 0;

      for (const item of staged) {
        setStaged((prev) =>
          prev.map((entry) => (entry.key === item.key ? { ...entry, state: "uploading" } : entry)),
        );
        try {
          const label = item.label.trim() || (await nextPageLabel(container.label, container.id));
          const { data: page, error } = await supabase
            .from("pages")
            .insert({ label, container_id: container.id })
            .select("id, label")
            .single();
          if (error) throw error;

          const path = `${page.label}/${Date.now()}.jpg`;
          const result = await supabase.storage.from("captures").upload(path, item.file, {
            contentType: item.file.type || "image/jpeg",
            upsert: true,
          });
          if (result.error) throw result.error;

          const { error: updateError } = await supabase
            .from("pages")
            .update({
              photo_path: path,
              capture_type: captureType,
              captured_at: new Date().toISOString(),
            })
            .eq("id", page.id);
          if (updateError) throw updateError;

          createdIds.push(page.id);
          setStaged((prev) =>
            prev.map((entry) => (entry.key === item.key ? { ...entry, state: "done" } : entry)),
          );
        } catch (error) {
          failures += 1;
          setStaged((prev) =>
            prev.map((entry) =>
              entry.key === item.key
                ? { ...entry, state: "failed", error: (error as Error).message }
                : entry,
            ),
          );
        }
      }

      return { createdIds, failures };
    },
    onSuccess: ({ createdIds, failures }) => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["page-stamp-counts"] });
      toast[failures ? "warning" : "success"](
        `${createdIds.length} page${createdIds.length === 1 ? "" : "s"} saved${
          failures ? `, ${failures} failed` : ""
        }`,
      );
      if (identifyAfter && createdIds.length > 0) start(createdIds);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Capture</h1>

      <div className="space-y-2">
        <Label>Container</Label>
        <Select value={containerId} onValueChange={(value) => void chooseContainer(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a container" />
          </SelectTrigger>
          <SelectContent>
            {containers.map((container) => (
              <SelectItem key={container.id} value={container.id}>
                {container.label} · {container.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Capture type</Label>
        <RadioGroup value={captureType} onValueChange={setCaptureType} className="flex gap-6">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="album_page" id="album_page" />
            <Label htmlFor="album_page">Album page</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="loose_grid" id="loose_grid" />
            <Label htmlFor="loose_grid">Loose grid</Label>
          </div>
        </RadioGroup>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "space-y-3 rounded-lg border-2 border-dashed p-6 text-center",
          dragging && "border-primary bg-accent",
        )}
      >
        <p className="text-sm text-muted-foreground">Drop photos here, or choose them below.</p>
        <Input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void addFiles(Array.from(event.target.files ?? []))}
        />
      </div>

      {staged.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="identify-after"
              checked={identifyAfter}
              onCheckedChange={(value) => setIdentifyAfter(value === true)}
            />
            <Label htmlFor="identify-after">Identify after upload</Label>
          </div>

          <ul className="space-y-2">
            {staged.map((item, index) => {
              const duplicate =
                item.label.trim() !== "" &&
                (duplicates.get(item.label.trim().toLowerCase()) ?? 0) > 1;
              return (
                <li key={item.key} className="flex items-start gap-3 rounded-lg border p-2">
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="h-16 w-14 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-xs text-muted-foreground">{item.file.name}</p>
                    <Input
                      value={item.label}
                      aria-label={`Page label for ${item.file.name}`}
                      onChange={(event) =>
                        setStaged((prev) =>
                          prev.map((entry, position) =>
                            position === index ? { ...entry, label: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    {duplicate ? (
                      <p className="text-xs text-destructive">
                        This label is already used in this list.
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {item.state === "waiting"
                        ? "Waiting"
                        : item.state === "uploading"
                          ? "Uploading…"
                          : item.state === "done"
                            ? "Saved"
                            : `Failed: ${item.error}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => {
                      URL.revokeObjectURL(item.preview);
                      setStaged((prev) => prev.filter((entry) => entry.key !== item.key));
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Button
        onClick={() => upload.mutate()}
        disabled={upload.isPending || staged.length === 0 || !containerId || hasDuplicates}
      >
        {upload.isPending
          ? "Uploading…"
          : `Upload ${staged.length} page${staged.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}

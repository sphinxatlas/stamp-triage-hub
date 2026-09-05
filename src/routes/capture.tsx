import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { identifyPage } from "@/lib/identify.functions";
import { fetchContainers, fetchPages, nextPageLabel, signedCaptureUrl } from "@/lib/triage";


const containersQuery = queryOptions({ queryKey: ["containers"], queryFn: fetchContainers });
const pagesQuery = queryOptions({ queryKey: ["pages"], queryFn: () => fetchPages() });

const NEW_PAGE = "__new__";

export const Route = createFileRoute("/capture")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Capture a page — Stamp Triage" },
      { name: "description", content: "Photograph an album page or loose grid and attach it." },
      { property: "og:title", content: "Capture a page — Stamp Triage" },
      {
        property: "og:description",
        content: "Photograph an album page or loose grid and attach it.",
      },
    ],
  }),
  component: Capture,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

function Capture() {
  const queryClient = useQueryClient();
  const { data: containers } = useSuspenseQuery(containersQuery);
  const { data: pages } = useSuspenseQuery(pagesQuery);

  const [containerId, setContainerId] = useState("");
  const [pageId, setPageId] = useState("");
  const [captureType, setCaptureType] = useState("album_page");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ label: string; url: string; pageId: string } | null>(null);
  const [detected, setDetected] = useState<Record<string, unknown>[] | null>(null);
  const identifyFn = useServerFn(identifyPage);

  const identify = useMutation({
    mutationFn: async (targetPageId: string) => identifyFn({ data: { page_id: targetPageId } }),
    onSuccess: (data) => {
      setDetected(data.stamps);
      toast.success(
        data.stamps.length ? `Found ${data.stamps.length} stamp(s)` : "No stamps were detected",
      );
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["stamps"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const containerPages = pages.filter((page) => page.container_id === containerId);

  const submit = useMutation({
    mutationFn: async () => {
      const container = containers.find((item) => item.id === containerId);
      if (!container) throw new Error("Choose a container first");
      if (!file) throw new Error("Choose an image first");

      let targetId = pageId;
      let targetLabel = containerPages.find((page) => page.id === pageId)?.label ?? "";

      if (!pageId || pageId === NEW_PAGE) {
        const label = await nextPageLabel(container.label, container.id);
        const { data, error } = await supabase
          .from("pages")
          .insert({ label, container_id: container.id })
          .select("id, label")
          .single();
        if (error) throw error;
        targetId = data.id;
        targetLabel = data.label;
      }

      const path = `${targetLabel}/${Date.now()}.jpg`;
      const upload = await supabase.storage
        .from("captures")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (upload.error) throw upload.error;

      const { error: updateError } = await supabase
        .from("pages")
        .update({
          photo_path: path,
          capture_type: captureType,
          captured_at: new Date().toISOString(),
        })
        .eq("id", targetId);
      if (updateError) throw updateError;

      const url = await signedCaptureUrl(path);
      return { label: targetLabel, url };
    },
    onSuccess: (data) => {
      setResult(data);
      setFile(null);
      setPageId("");
      toast.success(`Saved capture for ${data.label}`);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Capture</h1>

      <div className="space-y-2">
        <Label>Container</Label>
        <Select
          value={containerId}
          onValueChange={(value) => {
            setContainerId(value);
            setPageId("");
          }}
        >
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
        <Label>Page</Label>
        <Select value={pageId} onValueChange={setPageId} disabled={!containerId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW_PAGE}>New page (auto label)</SelectItem>
            {containerPages.map((page) => (
              <SelectItem key={page.id} value={page.id}>
                {page.label}
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

      <div className="space-y-2">
        <Label htmlFor="photo">Photo</Label>
        <Input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Uploading…" : "Save capture"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" disabled>
                Identify stamps
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </div>

      {result ? (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Uploaded to {result.label}</p>
          <img src={result.url} alt={`Capture for ${result.label}`} className="max-h-80 rounded" />
        </div>
      ) : null}
    </div>
  );
}

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import JSZip from "jszip";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchContainers,
  fetchExportData,
  parseBbox,
  type ExportData,
  type ExportStamp,
} from "@/lib/triage";

const containersQuery = queryOptions({ queryKey: ["containers"], queryFn: fetchContainers });

export const Route = createFileRoute("/export")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Export — Stamp Triage" },
      {
        name: "description",
        content: "Download your stamp index as spreadsheets, with or without the photos.",
      },
      { property: "og:title", content: "Export — Stamp Triage" },
      {
        property: "og:description",
        content: "Download your stamp index as spreadsheets, with or without the photos.",
      },
    ],
  }),
  component: ExportPage,
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div>Nothing here.</div>,
});

const ALL = "__all__";
const BOM = "\uFEFF";

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers.join(","), ...rows.map((row) => row.map(cell).join(","))];
  return BOM + lines.join("\r\n") + "\r\n";
}

function cropFilename(stamp: ExportStamp) {
  return `${stamp.page_label}_${stamp.position_index ?? 0}.jpg`;
}

function buildCsvs(data: ExportData) {
  const stamps = toCsv(
    [
      "stamp_id",
      "container_label",
      "page_label",
      "position_index",
      "crop_filename",
      "country",
      "country_inscription",
      "denomination",
      "currency",
      "year_estimate",
      "issue_name",
      "catalogue_system",
      "catalogue_number",
      "item_type",
      "format",
      "is_overprinted",
      "mint_or_used",
      "faults",
      "confidence",
      "priority_score",
      "priority_reasons",
      "set_id",
      "set_name",
      "quantity",
      "notes",
      "market_notes",
    ],
    data.stamps.map((stamp) => [
      stamp.id,
      stamp.container_label,
      stamp.page_label,
      stamp.position_index,
      cropFilename(stamp),
      stamp.country,
      stamp.country_inscription,
      stamp.denomination,
      stamp.currency,
      stamp.year_estimate,
      stamp.issue_name,
      stamp.catalogue_system,
      stamp.catalogue_number,
      stamp.item_type,
      stamp.format,
      stamp.is_overprinted,
      stamp.mint_or_used,
      (stamp.faults ?? []).join(";"),
      stamp.confidence,
      stamp.priority_score,
      (stamp.priority_reasons ?? []).join(";"),
      stamp.set_id,
      stamp.set_name,
      stamp.quantity,
      stamp.notes,
      stamp.market_notes,
    ]),
  );

  const sets = toCsv(
    [
      "set_id",
      "container_label",
      "page_label",
      "name",
      "catalogue_system",
      "catalogue_range",
      "expected_count",
      "present_count",
      "is_complete",
      "priority_score",
      "member_stamp_ids",
    ],
    data.sets.map((item) => [
      item.id,
      item.container_label,
      item.page_label,
      item.set_name,
      item.catalogue_system,
      item.catalogue_range,
      item.item_count,
      item.present_count,
      item.is_complete,
      item.priority_score,
      item.member_ids.join(";"),
    ]),
  );

  const pages = toCsv(
    [
      "page_id",
      "container_label",
      "page_label",
      "capture_type",
      "photo_filename",
      "identify_status",
      "stamp_count",
      "page_notes",
    ],
    data.pages.map((page) => [
      page.id,
      page.container_label,
      page.page_label,
      page.capture_type,
      page.photo_path ? `${page.page_label}.jpg` : "",
      page.identify_status,
      page.stamp_count,
      page.page_notes,
    ]),
  );

  return { stamps, sets, pages };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = src;
  });
}

async function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85),
  );
}

const PAD = 0.03;

async function cropBlob(image: HTMLImageElement, bbox: unknown) {
  const raw = parseBbox(bbox);
  if (!raw) return null;
  const x = Math.max(0, raw.x - PAD);
  const y = Math.max(0, raw.y - PAD);
  const right = Math.min(1, raw.x + raw.width + PAD);
  const bottom = Math.min(1, raw.y + raw.height + PAD);

  const sx = Math.round(x * image.naturalWidth);
  const sy = Math.round(y * image.naturalHeight);
  const sw = Math.max(1, Math.round((right - x) * image.naturalWidth));
  const sh = Math.max(1, Math.round((bottom - y) * image.naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvasBlob(canvas);
}

async function pageBlob(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  return canvasBlob(canvas);
}

function ExportPage() {
  const { data: containers } = useSuspenseQuery(containersQuery);
  const [containerId, setContainerId] = useState(ALL);
  const [busy, setBusy] = useState<null | "csv" | "zip">(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const scopeLabel = useMemo(
    () => containers.find((item) => item.id === containerId)?.label ?? "collection",
    [containers, containerId],
  );

  const load = () => fetchExportData(containerId === ALL ? undefined : containerId);

  const runCsv = async () => {
    setBusy("csv");
    setFailures([]);
    setProgress("Collecting your records…");
    try {
      const data = await load();
      const csvs = buildCsvs(data);
      download(new Blob([csvs.stamps], { type: "text/csv;charset=utf-8" }), "stamps.csv");
      download(new Blob([csvs.sets], { type: "text/csv;charset=utf-8" }), "sets.csv");
      download(new Blob([csvs.pages], { type: "text/csv;charset=utf-8" }), "pages.csv");
      toast.success(`Exported ${data.stamps.length} stamps`);
    } catch (error) {
      toast.error((error as Error).message || "Export failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const runZip = async () => {
    setBusy("zip");
    setFailures([]);
    setProgress("Collecting your records…");
    const problems: string[] = [];
    try {
      const data = await load();
      const zip = new JSZip();
      const csvs = buildCsvs(data);
      zip.file("stamps.csv", csvs.stamps);
      zip.file("sets.csv", csvs.sets);
      zip.file("pages.csv", csvs.pages);

      const pagesWithPhoto = data.pages.filter((page) => page.photo_path);
      for (let index = 0; index < pagesWithPhoto.length; index += 1) {
        const page = pagesWithPhoto[index]!;
        setProgress(`Photo ${index + 1} of ${pagesWithPhoto.length} — ${page.page_label}`);
        const url = page.photo_path ? data.photoUrls[page.photo_path] : undefined;
        if (!url) {
          problems.push(`${page.page_label}: photo not found`);
          continue;
        }
        try {
          const image = await loadImage(url);
          const full = await pageBlob(image);
          if (full) zip.file(`pages/${page.page_label}.jpg`, full);
          for (const stamp of data.stamps.filter((item) => item.page_label === page.page_label)) {
            const blob = await cropBlob(image, stamp.bbox);
            if (blob) zip.file(`crops/${cropFilename(stamp)}`, blob);
          }
        } catch (error) {
          problems.push(`${page.page_label}: ${(error as Error).message}`);
          console.warn("Export image failed", page.page_label, error);
        }
      }

      setProgress("Building the zip file…");
      const blob = await zip.generateAsync({ type: "blob" });
      download(blob, `stamp-export-${scopeLabel}.zip`);
      setFailures(problems);
      toast.success(
        problems.length === 0
          ? `Exported ${data.stamps.length} stamps with images`
          : `Exported with ${problems.length} photo problem(s)`,
      );
    } catch (error) {
      toast.error((error as Error).message || "Export failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download your index as spreadsheets, on their own or together with the photos.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scope">What to export</Label>
        <Select value={containerId} onValueChange={setContainerId}>
          <SelectTrigger id="scope" className="max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Whole collection</SelectItem>
            {containers.map((container) => (
              <SelectItem key={container.id} value={container.id}>
                {container.label}
                {container.description ? ` · ${container.description}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export data (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Three spreadsheets: one row per stamp, one per set, one per page. Opens straight in
            Excel or Numbers.
          </p>
          <Button disabled={busy !== null} onClick={() => void runCsv()}>
            {busy === "csv" ? "Working…" : "Export data (CSV)"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export data and images (ZIP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The same three spreadsheets, plus a cut-out picture of every stamp and the original
            page photos. This takes a while for large collections, so keep this page open.
          </p>
          <Button disabled={busy !== null} onClick={() => void runZip()}>
            {busy === "zip" ? "Working…" : "Export data and images (ZIP)"}
          </Button>
        </CardContent>
      </Card>

      {progress ? <p className="text-sm">{progress}</p> : null}

      {failures.length > 0 ? (
        <div className="space-y-1 rounded-md border p-3 text-sm">
          <p className="font-medium">Some photos could not be included:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

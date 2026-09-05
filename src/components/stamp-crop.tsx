import { parseBbox } from "@/lib/triage";
import { cn } from "@/lib/utils";

export function StampCrop({
  photoUrl,
  bbox,
  label,
  className,
}: {
  photoUrl: string | undefined;
  bbox: unknown;
  label: string;
  className?: string;
}) {
  const raw = parseBbox(bbox);
  const PAD = 0.03;
  const box = raw
    ? (() => {
        const x = Math.max(0, raw.x - PAD);
        const y = Math.max(0, raw.y - PAD);
        const right = Math.min(1, raw.x + raw.width + PAD);
        const bottom = Math.min(1, raw.y + raw.height + PAD);
        return { x, y, width: right - x, height: bottom - y };
      })()
    : null;

  if (!box || !photoUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded border bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        No box
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded border bg-muted", className)}>
      <img
        src={photoUrl}
        alt={label}
        className="absolute max-w-none"
        style={{
          width: `${100 / box.width}%`,
          height: `${100 / box.height}%`,
          left: `${(-box.x / box.width) * 100}%`,
          top: `${(-box.y / box.height) * 100}%`,
        }}
      />
    </div>
  );
}

export function PageWithBox({
  photoUrl,
  bbox,
  label,
}: {
  photoUrl: string | undefined;
  bbox: unknown;
  label: string;
}) {
  const box = parseBbox(bbox);
  if (!photoUrl) return <p className="text-sm text-muted-foreground">No photo for this page.</p>;
  return (
    <div className="relative">
      <img src={photoUrl} alt={label} className="w-full rounded" />
      {box ? (
        <div
          className="absolute border-2 border-primary"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

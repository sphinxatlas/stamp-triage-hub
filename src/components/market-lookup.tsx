import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type MarketRecord = {
  country?: string | null;
  year?: number | null;
  issue_name?: string | null;
  denomination?: string | null;
  catalogue_system?: string | null;
  catalogue_reference?: string | null;
};

function tidy(parts: Array<string | number | null | undefined>) {
  const words = parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .join(" ")
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }
  return unique.slice(0, 6).join(" ");
}

function firstWords(value: string | null | undefined, count: number) {
  if (!value) return null;
  return value.trim().split(/\s+/).slice(0, count).join(" ");
}

export function buildPhrases(record: MarketRecord) {
  return {
    catalogue: tidy([record.country, record.catalogue_system, record.catalogue_reference]),
    descriptive: tidy([record.country, record.year, firstWords(record.issue_name, 3)]),
    minimal: tidy([record.country, record.year, record.denomination]),
    research: tidy([record.country, record.year, firstWords(record.issue_name, 3), "stamp"]),
  };
}

const TABS = [
  { key: "catalogue", label: "Catalogue" },
  { key: "descriptive", label: "Descriptive" },
  { key: "minimal", label: "Minimal" },
  { key: "research", label: "Research" },
] as const;

export function MarketLookup({ record }: { record: MarketRecord }) {
  const phrases = useMemo(() => buildPhrases(record), [record]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("catalogue");
  const [phrase, setPhrase] = useState(phrases.catalogue || phrases.descriptive);

  useEffect(() => {
    setPhrase(phrases[tab]);
  }, [phrases, tab]);

  const q = encodeURIComponent(phrase.trim());
  const delcampe = `https://www.delcampe.net/en_GB/collectibles/search?term=${q}`;
  const links = [
    {
      label: "eBay sold",
      href: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    },
    {
      label: "eBay Netherlands sold",
      href: `https://www.ebay.nl/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    },
    {
      label: "Google",
      href: `https://www.google.com/search?q=${q}`,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      toast.success("Search phrase copied");
    } catch {
      toast.error("Could not copy the search phrase");
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Check real sold prices</h2>
      <div className="flex flex-wrap gap-2">
        {TABS.map((option) => (
          <Button
            key={option.key}
            type="button"
            size="sm"
            variant={tab === option.key ? "default" : "outline"}
            onClick={() => setTab(option.key)}
            disabled={!phrases[option.key]}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="market-phrase">Search phrase</Label>
        <div className="flex gap-2">
          <Input
            id="market-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
          />
          <Button type="button" variant="outline" onClick={copy} aria-label="Copy search phrase">
            <Copy className="size-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Button asChild variant="secondary" size="sm">
          <a href={delcampe} target="_blank" rel="noreferrer noopener">
            Delcampe
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          On Delcampe, click Sold in the left filter panel to see completed sales.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Button key={link.label} asChild variant="secondary" size="sm">
            <a href={link.href} target="_blank" rel="noreferrer noopener">
              {link.label}
            </a>
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        These show what similar items actually sold for. Catalogue values are a ceiling, not a sale
        price.
      </p>
    </section>
  );
}

export function SignificanceBadgeClass(level: string) {
  switch (level) {
    case "key_issue":
      return "bg-destructive text-destructive-foreground";
    case "notable":
      return "bg-primary text-primary-foreground";
    case "ordinary":
      return "bg-muted text-muted-foreground";
    default:
      return cn("bg-secondary text-secondary-foreground");
  }
}

export const SIGNIFICANCE_LABELS: Record<string, string> = {
  key_issue: "Sought after",
  notable: "Above average",
  ordinary: "Common",
  unknown: "Not recognised",
};

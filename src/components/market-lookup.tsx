import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MarketLookup({ initialPhrase }: { initialPhrase: string }) {
  const [phrase, setPhrase] = useState(initialPhrase);

  useEffect(() => {
    setPhrase(initialPhrase);
  }, [initialPhrase]);

  const q = encodeURIComponent(phrase.trim());
  const links = [
    {
      label: "Delcampe (sold)",
      href: `https://www.delcampe.net/en_GB/collectibles/search?term=${q}&sold_items=1`,
    },
    {
      label: "eBay sold",
      href: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    },
    {
      label: "eBay sold (Netherlands)",
      href: `https://www.ebay.nl/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    },
    { label: "Google", href: `https://www.google.com/search?q=${q}` },
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
      return "bg-secondary text-secondary-foreground";
  }
}

export const SIGNIFICANCE_LABELS: Record<string, string> = {
  key_issue: "Key issue",
  notable: "Notable",
  ordinary: "Ordinary",
  unknown: "Unknown standing",
};

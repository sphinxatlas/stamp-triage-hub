export type PriorityInput = {
  significance_level?: string | null;
  forgery_risk?: string | null;
  variants_to_check?: string | null;
  confidence?: number | null;
  year_estimate?: number | null;
  format?: string | null;
  needs_review?: boolean;
};

export type Priority = { score: number; reasons: string[] };

export function computePriority(input: PriorityInput): Priority {
  const reasons: string[] = [];
  let score = 0;

  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (input.significance_level === "key_issue") add(45, "Known key issue");
  else if (input.significance_level === "notable") add(20, "Notable issue");

  if (input.forgery_risk === "high") add(15, "Commonly forged, needs checking");
  if (input.variants_to_check) add(10, "Variant-sensitive");

  if (typeof input.year_estimate === "number" && input.year_estimate < 1920) {
    add(30, "Pre-1920 issue");
  }
  if (input.format && input.format !== "single") add(15, "Not a single stamp");
  if (typeof input.confidence === "number" && input.confidence < 0.8) {
    add(10, "Uncertain identification");
  }
  if (input.needs_review) add(10, "Flagged by the AI");

  return { score, reasons };
}

export type PriorityTier = "high" | "medium" | "low" | "skip";

export const PRIORITY_TIER_LABELS: Record<PriorityTier, string> = {
  high: "Look at this",
  medium: "Worth a look",
  low: "Probably nothing",
  skip: "Skip",
};

export function priorityTier(score: number | null | undefined): PriorityTier {
  const value = typeof score === "number" ? score : 0;
  if (value >= 45) return "high";
  if (value >= 20) return "medium";
  if (value >= 10) return "low";
  return "skip";
}

export function priorityTierBadgeClass(tier: PriorityTier) {
  switch (tier) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-primary text-primary-foreground";
    case "low":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const REASON_PHRASES: Record<string, string> = {
  "Known key issue": "collectors seek this issue out",
  "Notable issue": "this issue is a bit above average",
  "Commonly forged, needs checking": "issues like this are often faked",
  "Variant-sensitive": "small printing differences change what it is worth",
  "Pre-1920 issue": "it looks older than 1920",
  "Not a single stamp": "it is not a single stamp",
  "Uncertain identification": "the machine was unsure what it is",
  "Flagged by the AI": "the machine asked for a second look",
};

export function whyThisIsHere(reasons: string[] | null | undefined) {
  const parts = (reasons ?? [])
    .map((reason) => REASON_PHRASES[reason] ?? reason.toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return "Why this is here: it is waiting for a first look.";
  const sentence =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]!}`;
  return `Why this is here: ${sentence}.`;
}

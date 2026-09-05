export type PriorityInput = {
  significance_level?: string | null;
  forgery_risk?: string | null;
  variants_to_check?: string | null;
  confidence?: number | null;
  year_estimate?: number | null;
  format?: string | null;
  country?: string | null;
  denomination?: string | null;
  currency?: string | null;
  item_type?: string | null;
  is_overprinted?: boolean | null;
};

export type Priority = { score: number; reasons: string[] };

const COLONIAL_TERMS = [
  "Indie",
  "Indies",
  "Suriname",
  "Curacao",
  "Antillen",
  "Antilles",
  "Occupation",
  "Besetzung",
];

const HIGH_VALUE_CURRENCIES = [
  "Lire",
  "Lira",
  "Gulden",
  "Mark",
  "Franc",
  "Frank",
  "Pound",
  "Dollar",
];

function leadingNumber(value: string | null | undefined) {
  if (!value) return null;
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function computePriority(input: PriorityInput): Priority {
  const reasons: string[] = [];
  let score = 0;

  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (input.significance_level === "key_issue") add(45, "Known key issue");
  if (input.significance_level === "notable") add(20, "Notable issue");

  if (input.is_overprinted === true) add(30, "Overprint or surcharge");

  const year = typeof input.year_estimate === "number" ? input.year_estimate : null;
  if (year !== null) {
    if (year < 1900) add(40, "Pre-1900");
    else if (year <= 1919) add(25, "Pre-1920");
    else if (year <= 1949) add(10, "Pre-1950");
  }

  if (input.format && input.format !== "single") add(25, "Not a single stamp");

  const country = input.country?.trim() ?? "";
  if (country) {
    const lowerCountry = country.toLowerCase();
    if (COLONIAL_TERMS.some((term) => lowerCountry.includes(term.toLowerCase()))) {
      add(20, "Colonial or occupation issue");
    }
  }

  if (input.forgery_risk === "high") add(15, "Commonly forged, needs checking");

  const denominationValue = leadingNumber(input.denomination);
  const currency = input.currency?.trim().toLowerCase() ?? "";
  if (
    denominationValue !== null &&
    denominationValue >= 5 &&
    currency &&
    HIGH_VALUE_CURRENCIES.some((unit) => currency.includes(unit.toLowerCase()))
  ) {
    add(15, "High denomination");
  }

  if (!country) add(15, "Country not identified");

  if (input.variants_to_check && input.variants_to_check.trim()) add(10, "Variant-sensitive");

  if (typeof input.confidence === "number" && input.confidence < 0.6) add(10, "Low confidence");

  if (year !== null && year >= 1970) add(-30, "Modern issue");

  if (
    input.item_type === "revenue" ||
    input.item_type === "cinderella" ||
    input.item_type === "label"
  ) {
    add(-20, "Not postage");
  }

  return { score, reasons };
}

export type SetPriorityInput = {
  members: Priority[];
  is_complete?: boolean | null;
  present_count?: number | null;
  expected_count?: number | null;
};

export function computeSetPriority(input: SetPriorityInput): Priority {
  let best: Priority = { score: 0, reasons: [] };
  input.members.forEach((member, index) => {
    if (index === 0 || member.score > best.score) best = member;
  });


  let score = best.score;
  const reasons = [...best.reasons];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  const present = typeof input.present_count === "number" ? input.present_count : null;
  const expected = typeof input.expected_count === "number" ? input.expected_count : null;

  if (input.is_complete === true) {
    add(25, "Complete set");
  } else if (present !== null && expected !== null && expected > 0) {
    if (present >= expected * 0.7) add(10, "Near complete set");
    else if (present < expected * 0.5) add(-15, "Incomplete set");
  }

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
  if (value >= 55) return "high";
  if (value >= 30) return "medium";
  if (value >= 5) return "low";
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
  "Overprint or surcharge": "it has extra text printed over the original design",
  "Pre-1900": "it looks older than 1900",
  "Pre-1920": "it looks older than 1920",
  "Pre-1950": "it looks older than 1950",
  "Not a single stamp": "it is not a single stamp",
  "Colonial or occupation issue": "it comes from a colony or an occupied area",
  "Commonly forged, needs checking": "issues like this are often faked",
  "High denomination": "it carries a high face value",
  "Country not identified": "the country could not be worked out",
  "Variant-sensitive": "small printing differences change what it is worth",
  "Low confidence": "the machine was unsure what it is",
  "Modern issue": "it is a modern issue",
  "Not postage": "it is not a postage stamp",
  "Complete set": "the set looks complete",
  "Near complete set": "the set is nearly complete",
  "Incomplete set": "much of the set is missing",
  // Legacy reason strings kept so older records still read cleanly.
  "Pre-1920 issue": "it looks older than 1920",
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

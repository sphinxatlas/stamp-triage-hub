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

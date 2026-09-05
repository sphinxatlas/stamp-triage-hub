import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "google/gemini-3.1-pro-preview";

const BRIEF_INSTRUCTIONS = `Write a brief of at most 250 words with these four headings:

What this is. The issue, when and why it was released, and anything historically notable about it.

Why collectors care. Its standing among collectors, whether it is scarce, sought after or common, and why.

What decides its worth. The specific physical factors that separate a valuable copy from an ordinary one for this particular item: gum state, printing variety, perforation, overprint spacing, centring, certificates. Be concrete about this item, not generic.

What to do next. What to have an expert examine, and whether a certificate is normally expected for material like this.

Write in plain English for someone who knows nothing about stamps.`;

const ESTIMATE_INSTRUCTIONS = `Then give a rough value estimate in euros.

catalogue_low and catalogue_high: the range you believe a major catalogue quotes for this item in sound unused condition. State the range wide enough to reflect your uncertainty.

realistic_low and realistic_high: what the owner might actually realise selling it. This is much lower than catalogue. A dealer buying outright typically pays 10 to 30 percent of catalogue. A specialist auction may realise 25 to 50 percent for mid-value classics, and more only for genuinely superb material with a certificate. Apply that reduction rather than repeating the catalogue figure.

basis: state in one sentence what your figure rests on, and be honest. Say whether you actually recall values for this specific issue, or are inferring from the era, country and type. Inferring is acceptable, but say so.

confidence: 0 to 1, reflecting how well you know this issue's value specifically. Use below 0.4 whenever you are inferring rather than recalling.

biggest_unknown: the single physical factor most likely to move the real figure, for example whether the gum is never hinged, or which printing the overprint belongs to.

Set can_estimate to false and leave every number null when you do not recognise the issue well enough to give a figure that means anything. A refusal is more useful than a fabricated number. Do not estimate for common modern material.

Return ONLY a JSON object, with no markdown fence, in exactly this shape:
{"brief": string, "estimate": {"can_estimate": boolean, "currency": "EUR", "catalogue_low": number|null, "catalogue_high": number|null, "realistic_low": number|null, "realistic_high": number|null, "basis": string, "confidence": number, "biggest_unknown": string}}`;

const estimateSchema = z.object({
  can_estimate: z.boolean(),
  currency: z.string().default("EUR"),
  catalogue_low: z.number().nullable().default(null),
  catalogue_high: z.number().nullable().default(null),
  realistic_low: z.number().nullable().default(null),
  realistic_high: z.number().nullable().default(null),
  basis: z.string().default(""),
  confidence: z.number().default(0),
  biggest_unknown: z.string().default(""),
});

export type ValueEstimate = z.infer<typeof estimateSchema>;

const payloadSchema = z.object({ brief: z.string(), estimate: estimateSchema });

function parsePayload(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return payloadSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function buildBasisText(estimate: ValueEstimate) {
  const parts: string[] = [];
  if (!estimate.can_estimate) {
    parts.push(estimate.basis || "The AI did not recognise this issue well enough to give a figure.");
  } else {
    parts.push(estimate.basis);
    if (estimate.catalogue_low !== null || estimate.catalogue_high !== null) {
      parts.push(`Catalogue reference: EUR ${estimate.catalogue_low ?? "?"} to ${estimate.catalogue_high ?? "?"}.`);
    }
    if (estimate.biggest_unknown) parts.push(`Biggest unknown: ${estimate.biggest_unknown}`);
  }
  return parts.filter(Boolean).join(" ");
}

function line(label: string, value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return `${label}: ${String(value)}`;
}

async function callModel(apiKey: string, prompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      response.status === 402
        ? "AI credits are exhausted for this workspace. Add credits in Lovable to continue."
        : response.status === 429
          ? "The AI service is rate limited right now. Try again in a moment."
          : `AI request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text: unknown }).text)
          : "",
      )
      .join("")
      .trim();
  }
  return "";
}

export const researchBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ kind: z.enum(["stamp", "set"]), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.kind === "stamp" ? "stamps" : "stamp_sets";

    const { data: record, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const row = record as Record<string, unknown>;
    const details =
      data.kind === "stamp"
        ? [
            line("Country", row["country"]),
            line("Year", row["year_estimate"]),
            line("Issue name", row["issue_name"]),
            line(
              "Catalogue",
              [row["catalogue_system"], row["catalogue_number"]].filter(Boolean).join(" "),
            ),
            line("Denomination", [row["denomination"], row["currency"]].filter(Boolean).join(" ")),
            line("Format", row["format"]),
            line("Overprint or surcharge noted", row["condition_notes"]),
            line("Notes recorded", row["significance"]),
            line("Variants flagged", row["variants_to_check"]),
          ]
        : [
            line("Set name", row["set_name"]),
            line("Country", row["country"]),
            line("Years", [row["year_from"], row["year_to"]].filter(Boolean).join("–")),
            line(
              "Catalogue",
              [row["catalogue_system"], row["catalogue_range"]].filter(Boolean).join(" "),
            ),
            line("Items present on the page", row["item_count"]),
            line("Notes recorded", row["significance"]),
            line("Variants flagged", row["variants_to_check"]),
          ];

    const prompt = `You are briefing the owner of an inherited stamp collection on one item so they can decide whether it is worth taking to a professional valuer. Here are the recorded details:\n${details
      .filter(Boolean)
      .join("\n")}\n\n${BRIEF_INSTRUCTIONS}`;

    const brief = await callModel(apiKey, prompt);
    if (!brief) throw new Error("The AI returned an empty brief. Please try again.");

    const generatedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update({ research_brief: brief, research_brief_generated_at: generatedAt } as never)
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    return { brief, generated_at: generatedAt };
  });

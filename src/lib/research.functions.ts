import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "google/gemini-3.1-pro-preview";

const BRIEF_INSTRUCTIONS = `Write a brief of at most 250 words with these four headings:

What this is. The issue, when and why it was released, and anything historically notable about it.

Why collectors care. Its standing among collectors, whether it is scarce, sought after or common, and why.

What decides its worth. The specific physical factors that separate a valuable copy from an ordinary one for this particular item: gum state, printing variety, perforation, overprint spacing, centring, certificates. Be concrete about this item, not generic.

What to do next. What to have an expert examine, and whether a certificate is normally expected for material like this.

Write in plain English for someone who knows nothing about stamps.`;

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
            line(
              "Overprint or surcharge",
              row["variants_to_check"] ?? row["significance"] ? "possibly, see notes" : null,
            ),
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

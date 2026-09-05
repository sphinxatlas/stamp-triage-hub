import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { IDENTIFY_PROMPT } from "./identify-prompt";
import { computePriority } from "./priority";

export type DetectedStamp = {
  id: string;
  position_index: number | null;
  country: string | null;
  denomination: string | null;
  year_estimate: number | null;
  item_type: string;
  confidence: number | null;
  review_status: string;
};

const MODEL = "google/gemini-3.1-pro-preview";

const ITEM_TYPES = ["postage", "revenue", "cinderella", "label", "unknown"] as const;
const FORMATS = ["single", "block", "sheet", "on_cover", "se_tenant"] as const;
const SIGNIFICANCE_LEVELS = ["key_issue", "notable", "ordinary", "unknown"] as const;
const FORGERY_RISKS = ["high", "medium", "low", "unknown"] as const;

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

type Bbox = { x: number; y: number; width: number; height: number };

export function box2dToBbox(value: unknown): Bbox | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const raw = value.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN));
  if (raw.some((v) => Number.isNaN(v))) return null;
  const scaled = raw.some((v) => v > 1) ? raw.map((v) => v / 1000) : raw;
  const [ymin, xmin, ymax, xmax] = scaled as [number, number, number, number];
  const x = Math.max(0, Math.min(1, xmin));
  const y = Math.max(0, Math.min(1, ymin));
  const width = Math.min(1 - x, xmax - xmin);
  const height = Math.min(1 - y, ymax - ymin);
  if (!(width > 0) || !(height > 0)) return null;
  return { x, y, width, height };
}

function legacyBbox(value: unknown): Bbox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const box = value as Record<string, unknown>;
  const keys = ["x", "y", "width", "height"] as const;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const raw = box[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    out[key] = raw;
  }
  if (out["width"]! <= 0 || out["height"]! <= 0) return null;
  return out as unknown as Bbox;
}

function resolveBbox(stamp: Record<string, unknown>): Bbox | null {
  return box2dToBbox(stamp["box_2d"]) ?? legacyBbox(stamp["bbox"]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extractJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function callModel(apiKey: string, dataUrl: string, prompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
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

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "",
      )
      .join("");
  }
  return "";
}

export const identifyPage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ page_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: page, error: pageError } = await supabaseAdmin
      .from("pages")
      .select("id, label, photo_path")
      .eq("id", data.page_id)
      .single();
    if (pageError) throw new Error(pageError.message);
    if (!page.photo_path) {
      throw new Error("This page has no photo yet. Upload a capture before identifying stamps.");
    }

    await supabaseAdmin.from("stamps").delete().eq("page_id", page.id);
    await supabaseAdmin.from("stamp_sets").delete().eq("page_id", page.id);
    await supabaseAdmin.from("pages").update({ identify_status: "running" }).eq("id", page.id);


    const fail = async (rawText: string, message: string) => {
      await supabaseAdmin
        .from("pages")
        .update({ identify_status: "failed", raw_model_output: { raw_text: rawText } })
        .eq("id", page.id);
      throw new Error(message);
    };

    try {
      const signed = await supabaseAdmin.storage
        .from("captures")
        .createSignedUrl(page.photo_path, 600);
      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(signed.error?.message ?? "Could not read the capture image.");
      }

      const imageResponse = await fetch(signed.data.signedUrl);
      if (!imageResponse.ok) throw new Error("Could not download the capture image.");
      const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      const dataUrl = `data:${contentType};base64,${toBase64(bytes)}`;

      let text = await callModel(apiKey, dataUrl, IDENTIFY_PROMPT);
      let parsed = extractJson(text);
      if (!parsed) {
        text = await callModel(
          apiKey,
          dataUrl,
          `${IDENTIFY_PROMPT}\n\nReturn only valid JSON matching the shape above. No prose, no markdown fences.`,
        );
        parsed = extractJson(text);
      }
      if (!parsed || typeof parsed !== "object") {
        await fail(text, "The AI response could not be read as JSON. Please try again.");
      }

      const result = parsed as { page_notes?: unknown; stamps?: unknown; sets?: unknown };
      const detected = Array.isArray(result.stamps) ? result.stamps : [];
      const detectedSets = Array.isArray(result.sets) ? result.sets : [];

      // Stamps are scored first: a set takes the score of its strongest member.
      const rows = detected.map((item, index) => {
        const stamp = (item ?? {}) as Record<string, unknown>;
        const confidence = num(stamp["confidence"]);
        const itemType = pick(stamp["item_type"], ITEM_TYPES, "unknown");
        const yearEstimate = num(stamp["year_estimate"]);
        const format = pick(stamp["format"], FORMATS, "single");
        const significanceLevel = pick(stamp["significance_level"], SIGNIFICANCE_LEVELS, "unknown");
        const forgeryRisk = pick(stamp["forgery_risk"], FORGERY_RISKS, "unknown");
        const variants = str(stamp["variants_to_check"]);
        const country = str(stamp["country"]);
        const denomination = str(stamp["denomination"]);
        const currency = str(stamp["currency"]);
        const isOverprinted = stamp["is_overprinted"] === true;
        const reviewStatus =
          stamp["needs_review"] === true
            ? "flagged_expert"
            : confidence !== null &&
                confidence >= 0.8 &&
                itemType === "postage" &&
                yearEstimate !== null &&
                yearEstimate >= 1970
              ? "auto_accepted"
              : "pending";
        const priority = computePriority({
          significance_level: significanceLevel,
          forgery_risk: forgeryRisk,
          variants_to_check: variants,
          confidence,
          year_estimate: yearEstimate,
          format,
          country,
          denomination,
          currency,
          item_type: itemType,
          is_overprinted: isOverprinted,
        });

        return {
          page_id: page.id,
          set_id: null as string | null,
          position_index: index,
          crop_path: null,
          bbox: resolveBbox(stamp) as never,
          country,
          country_inscription: str(stamp["country_inscription"]),
          year_estimate: yearEstimate === null ? null : Math.round(yearEstimate),
          year_confidence: num(stamp["year_confidence"]),
          denomination,
          currency,
          issue_name: str(stamp["issue_name"]),
          catalogue_system: str(stamp["catalogue_system"]),
          catalogue_number: str(stamp["catalogue_number"]),
          catalogue_confidence: num(stamp["catalogue_confidence"]),
          item_type: itemType,
          mint_or_used: str(stamp["mint_or_used"]),
          hinged_guess: str(stamp["hinged_guess"]),
          gum_state: "unknown",
          format,
          is_overprinted: isOverprinted,
          priority: priority as { score: number; reasons: string[] },

          faults: Array.isArray(stamp["faults_suggested"])
            ? (stamp["faults_suggested"] as unknown[]).filter(
                (fault): fault is string => typeof fault === "string",
              )
            : [],
          perforation: null,
          watermark: null,
          condition_notes: str(stamp["condition_notes"]),
          confidence,
          review_status: reviewStatus,
          notes: str(stamp["reasoning"]),
          significance: str(stamp["significance"]),
          significance_level: significanceLevel,
          forgery_risk: forgeryRisk,
          variants_to_check: variants,
          priority_score: priority.score,
          priority_reasons: priority.reasons,
        };
      });

      let inserted: DetectedStamp[] = [];
      if (rows.length > 0) {
        const { data: insertedRows, error: insertError } = await supabaseAdmin
          .from("stamps")
          .insert(rows as never)
          .select("*");
        if (insertError) throw new Error(insertError.message);
        inserted = (insertedRows ?? []).map((row) => ({
          id: String(row.id),
          position_index: row.position_index ?? null,
          country: row.country ?? null,
          denomination: row.denomination ?? null,
          year_estimate: row.year_estimate ?? null,
          item_type: row.item_type,
          confidence: row.confidence === null ? null : Number(row.confidence),
          review_status: row.review_status,
        }));
      }

      await supabaseAdmin
        .from("pages")
        .update({
          raw_model_output: result as never,
          page_notes: str(result.page_notes),
          identify_status: "done",
        })
        .eq("id", page.id);

      return { stamps: inserted };
    } catch (error) {
      await supabaseAdmin.from("pages").update({ identify_status: "failed" }).eq("id", page.id);
      throw error instanceof Error ? error : new Error("Identification failed.");
    }
  });

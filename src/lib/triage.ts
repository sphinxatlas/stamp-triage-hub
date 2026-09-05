import { supabase } from "@/integrations/supabase/client";

export const CONTAINER_TYPES = ["album", "box", "loose_sheet", "review_book"] as const;

export type Container = {
  id: string;
  label: string;
  type: string;
  description: string | null;
  created_at: string | null;
};

export type Page = {
  id: string;
  container_id: string;
  label: string;
  photo_path: string | null;
  capture_type: string | null;
  captured_at: string | null;
  identify_status: string;
  page_notes: string | null;
};

export type Stamp = {
  id: string;
  page_id: string;
  crop_path: string | null;
  country: string | null;
  issue_name: string | null;
  denomination: string | null;
  currency: string | null;
  year_estimate: number | null;
  item_type: string;
  review_status: string;
  quantity: number;
  confidence: number | null;
};

export function formatDenomination(
  denomination: string | null | undefined,
  currency: string | null | undefined,
) {
  const value = denomination?.trim();
  if (!value) return "—";
  const unit = currency?.trim();
  if (!unit) return value;
  return value.toLowerCase().includes(unit.toLowerCase()) ? value : `${value} ${unit}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function nextContainerLabel() {
  const { data, error } = await supabase
    .from("containers")
    .select("label")
    .order("label", { ascending: false })
    .limit(1);
  if (error) throw error;
  const highest = data?.[0]?.label;
  const n = highest ? Number(highest.replace(/^C/, "")) : 0;
  return `C${pad(n + 1)}`;
}

export async function nextPageLabel(containerLabel: string, containerId: string) {
  const { data, error } = await supabase
    .from("pages")
    .select("label")
    .eq("container_id", containerId)
    .order("label", { ascending: false })
    .limit(1);
  if (error) throw error;
  const highest = data?.[0]?.label;
  const n = highest ? Number(highest.split("-P")[1]) : 0;
  return `${containerLabel}-P${pad(n + 1)}`;
}

export async function fetchContainers() {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .order("label", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Container[];
}

export async function fetchPages(containerId?: string) {
  let query = supabase.from("pages").select("*").order("label", { ascending: true });
  if (containerId) query = query.eq("container_id", containerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Page[];
}

export async function fetchStamps() {
  const { data, error } = await supabase
    .from("stamps")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Stamp[];
}

export async function fetchReviewStamps() {
  const { data, error } = await supabase
    .from("stamps")
    .select("*")
    .in("review_status", ["pending", "flagged_expert"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Stamp[];
}

export async function fetchDashboard() {
  const [stamps, containers] = await Promise.all([
    supabase.from("stamps").select("review_status, country, quantity"),
    supabase.from("containers").select("id"),
  ]);
  if (stamps.error) throw stamps.error;
  if (containers.error) throw containers.error;

  const rows = stamps.data ?? [];
  const byStatus: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.review_status] = (byStatus[row.review_status] ?? 0) + 1;
    const country = row.country ?? "Unknown";
    byCountry[country] = (byCountry[country] ?? 0) + 1;
  }
  return {
    totalStamps: rows.length,
    containerCount: containers.data?.length ?? 0,
    byStatus,
    byCountry: Object.entries(byCountry).sort((a, b) => b[1] - a[1]),
  };
}

export async function signedCaptureUrl(path: string) {
  const { data, error } = await supabase.storage.from("captures").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export type PageStampCounts = {
  total: number;
  byStatus: Record<string, number>;
};

export async function fetchPageStampCounts() {
  const { data, error } = await supabase.from("stamps").select("page_id, review_status");
  if (error) throw error;
  const map: Record<string, PageStampCounts> = {};
  for (const row of data ?? []) {
    const entry = (map[row.page_id] ??= { total: 0, byStatus: {} });
    entry.total += 1;
    entry.byStatus[row.review_status] = (entry.byStatus[row.review_status] ?? 0) + 1;
  }
  return map;
}

export async function fetchPageDetail(pageId: string) {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .single();
  if (error) throw error;
  return data as Page & { raw_model_output: unknown };
}

export async function fetchStampsForPage(pageId: string) {
  const { data, error } = await supabase
    .from("stamps")
    .select("*")
    .eq("page_id", pageId)
    .order("position_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Stamp[];
}

export async function deleteStampsForPage(pageId: string) {
  const { error } = await supabase.from("stamps").delete().eq("page_id", pageId);
  if (error) throw error;
  const { error: setError } = await supabase.from("stamp_sets").delete().eq("page_id", pageId);
  if (setError) throw setError;
  const { error: pageError } = await supabase
    .from("pages")
    .update({ identify_status: "pending", raw_model_output: null, page_notes: null })
    .eq("id", pageId);
  if (pageError) throw pageError;
}

export async function deletePageCompletely(page: { id: string; photo_path: string | null }) {
  const { error: stampError } = await supabase.from("stamps").delete().eq("page_id", page.id);
  if (stampError) throw stampError;
  const { error: setError } = await supabase.from("stamp_sets").delete().eq("page_id", page.id);
  if (setError) throw setError;
  const { error } = await supabase.from("pages").delete().eq("id", page.id);
  if (error) throw error;
  if (page.photo_path) {
    await supabase.storage.from("captures").remove([page.photo_path]);
  }
}

export type Bbox = { x: number; y: number; width: number; height: number };

export type ReviewStamp = {
  id: string;
  page_id: string;
  bbox: unknown;
  country: string | null;
  country_inscription: string | null;
  year_estimate: number | null;
  year_confidence: number | null;
  denomination: string | null;
  currency: string | null;
  issue_name: string | null;
  catalogue_system: string | null;
  catalogue_number: string | null;
  catalogue_confidence: number | null;
  item_type: string;
  format: string;
  mint_or_used: string | null;
  hinged_guess: string | null;
  gum_state: string;
  perforation: string | null;
  watermark: string | null;
  faults: string[] | null;
  condition_notes: string | null;
  confidence: number | null;
  quantity: number;
  notes: string | null;
  significance: string | null;
  significance_level: string;
  forgery_risk: string;
  variants_to_check: string | null;
  market_notes: string | null;
  research_brief: string | null;
  research_brief_generated_at: string | null;
  priority_score: number;
  priority_reasons: string[] | null;
  review_status: string;
  created_at: string | null;
  page_label: string;
  page_photo_path: string | null;
  container_label: string;
};

export function parseBbox(value: unknown): Bbox | null {
  if (!value || typeof value !== "object") return null;
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

export async function fetchReviewQueue() {
  const { data, error } = await supabase
    .from("stamps")
    .select("*, pages!inner(label, photo_path, containers!inner(label))")
    .in("review_status", ["pending", "flagged_expert"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      pages: { label: string; photo_path: string | null; containers: { label: string } };
    }
  >;

  const stamps = rows.map((row) => {
    const { pages, ...rest } = row;
    return {
      ...(rest as unknown as ReviewStamp),
      page_label: pages.label,
      page_photo_path: pages.photo_path,
      container_label: pages.containers.label,
    } as ReviewStamp;
  });

  const paths = Array.from(
    new Set(stamps.map((stamp) => stamp.page_photo_path).filter((p): p is string => !!p)),
  );
  const photoUrls: Record<string, string> = {};
  if (paths.length > 0) {
    const signed = await supabase.storage.from("captures").createSignedUrls(paths, 3600);
    if (signed.error) throw signed.error;
    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) photoUrls[item.path] = item.signedUrl;
    }
  }

  return { stamps, photoUrls };
}

export const FAULT_OPTIONS = [
  "thin",
  "crease",
  "tear",
  "short_perfs",
  "toning",
  "foxing",
  "hinge_remnant",
  "fading",
] as const;

export const ITEM_TYPE_OPTIONS = [
  "postage",
  "revenue",
  "cinderella",
  "label",
  "unknown",
] as const;

export const FORMAT_OPTIONS = ["single", "block", "sheet", "on_cover", "se_tenant"] as const;
export const MINT_OPTIONS = ["mint", "used", "unknown"] as const;
export const GUM_OPTIONS = ["never_hinged", "hinged", "no_gum", "regummed", "unknown"] as const;

export type StampEdits = {
  country: string | null;
  country_inscription: string | null;
  year_estimate: number | null;
  denomination: string | null;
  currency: string | null;
  issue_name: string | null;
  catalogue_system: string | null;
  catalogue_number: string | null;
  item_type: string;
  format: string;
  mint_or_used: string | null;
  gum_state: string;
  perforation: string | null;
  watermark: string | null;
  faults: string[];
  quantity: number;
  notes: string | null;
  market_notes: string | null;
};

export async function saveStamp(
  stampId: string,
  edits: StampEdits,
  reviewStatus?: "confirmed" | "flagged_expert" | "rejected",
) {
  const payload: Record<string, unknown> = {
    ...edits,
    updated_at: new Date().toISOString(),
  };
  if (reviewStatus) payload["review_status"] = reviewStatus;
  const { error } = await supabase
    .from("stamps")
    .update(payload as never)
    .eq("id", stampId);
  if (error) throw error;
}

export const SIGNIFICANCE_OPTIONS = ["key_issue", "notable", "ordinary", "unknown"] as const;
export const FORGERY_OPTIONS = ["high", "medium", "low", "unknown"] as const;

export type ReviewSet = {
  id: string;
  page_id: string;
  set_name: string;
  country: string | null;
  year_from: number | null;
  year_to: number | null;
  catalogue_system: string | null;
  catalogue_range: string | null;
  item_count: number | null;
  confidence: number | null;
  notes: string | null;
  review_status: string;
  priority_score: number;
  priority_reasons: string[] | null;
  significance: string | null;
  significance_level: string;
  forgery_risk: string;
  variants_to_check: string | null;
  market_notes: string | null;
  created_at: string | null;
  page_label: string;
  container_label: string;
};

export async function fetchReviewSets() {
  const { data, error } = await supabase
    .from("stamp_sets")
    .select("*, pages!inner(label, containers!inner(label))")
    .in("review_status", ["pending", "flagged_expert"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & { pages: { label: string; containers: { label: string } } }
  >;
  return rows.map((row) => {
    const { pages, ...rest } = row;
    return {
      ...(rest as unknown as ReviewSet),
      page_label: pages.label,
      container_label: pages.containers.label,
    } as ReviewSet;
  });
}

export type SetEdits = {
  set_name: string;
  country: string | null;
  year_from: number | null;
  year_to: number | null;
  catalogue_system: string | null;
  catalogue_range: string | null;
  item_count: number | null;
  notes: string | null;
  market_notes: string | null;
};

export async function saveSet(
  setId: string,
  edits: SetEdits,
  reviewStatus?: "confirmed" | "flagged_expert" | "rejected",
) {
  const payload: Record<string, unknown> = { ...edits, updated_at: new Date().toISOString() };
  if (reviewStatus) payload["review_status"] = reviewStatus;
  const { error } = await supabase
    .from("stamp_sets")
    .update(payload as never)
    .eq("id", setId);
  if (error) throw error;
}

export function marketSearchPhrase(record: {
  country?: string | null;
  year_estimate?: number | null;
  year_from?: number | null;
  issue_name?: string | null;
  set_name?: string | null;
  catalogue_system?: string | null;
  catalogue_number?: string | null;
  catalogue_range?: string | null;
}) {
  const catalogue = [
    record.catalogue_system,
    record.catalogue_number ?? record.catalogue_range,
  ].every(Boolean)
    ? `${record.catalogue_system} ${record.catalogue_number ?? record.catalogue_range}`
    : null;
  return [
    record.country,
    record.year_estimate ?? record.year_from,
    record.issue_name ?? record.set_name,
    catalogue,
  ]
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .join(" ");
}

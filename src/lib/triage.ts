import { supabase } from "@/integrations/supabase/client";
import {
  computePriority,
  computeSetPriority,
  priorityTier,
  type PriorityTier,
} from "@/lib/priority";

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
  value_low: number | null;
  value_high: number | null;
  value_confidence: number | null;
  value_basis: string | null;
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

export async function fetchDashboard() {
  const [stamps, sets, containers, pages] = await Promise.all([
    supabase
      .from("stamps")
      .select(
        "id, country, issue_name, denomination, currency, page_id, priority_score, priority_reasons",
      )
      .neq("review_status", "rejected"),
    supabase.from("stamp_sets").select("id"),
    supabase.from("containers").select("id, label"),
    supabase.from("pages").select("id, label, container_id"),
  ]);
  for (const result of [stamps, sets, containers, pages]) {
    if (result.error) throw result.error;
  }

  const containerLabels = new Map((containers.data ?? []).map((row) => [row.id, row.label]));
  const pageInfo = new Map(
    (pages.data ?? []).map((row) => [row.id, { label: row.label, container_id: row.container_id }]),
  );

  const rows = stamps.data ?? [];
  const byContainer: Record<string, number> = {};
  const byTier: Record<PriorityTier, number> = { high: 0, medium: 0, low: 0, skip: 0 };

  for (const row of rows) {
    const page = pageInfo.get(row.page_id);
    const label = page ? (containerLabels.get(page.container_id) ?? "Unknown") : "Unknown";
    byContainer[label] = (byContainer[label] ?? 0) + 1;
    byTier[priorityTier(row.priority_score)] += 1;
  }

  const top20 = [...rows]
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      label:
        [row.country, row.issue_name ?? formatDenomination(row.denomination, row.currency)]
          .filter((part) => part && part !== "—")
          .join(" · ") || "Unnamed stamp",
      page_label: pageInfo.get(row.page_id)?.label ?? "",
      priority_score: row.priority_score,
      priority_reasons: row.priority_reasons as string[] | null,
    }));

  return {
    totalStamps: rows.length,
    totalSets: sets.data?.length ?? 0,
    containerCount: containers.data?.length ?? 0,
    byContainer: Object.entries(byContainer).sort((a, b) => b[1] - a[1]),
    byTier,
    top20,
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
  const { data, error } = await supabase.from("pages").select("*").eq("id", pageId).single();
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
  value_low: number | null;
  value_high: number | null;
  value_source: string | null;
  value_confidence: number | null;
  value_basis: string | null;
  value_estimated_at: string | null;
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

export const ITEM_TYPE_OPTIONS = ["postage", "revenue", "cinderella", "label", "unknown"] as const;

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
  research_brief: string | null;
  research_brief_generated_at: string | null;
  value_low: number | null;
  value_high: number | null;
  value_source: string | null;
  value_confidence: number | null;
  value_basis: string | null;
  value_estimated_at: string | null;
  created_at: string | null;
  page_label: string;
  container_label: string;
  members: SetMember[];
  member_count: number;
};

export type SetMember = { id: string; bbox: unknown; photo_path: string | null };

export async function fetchAllSets() {
  return fetchReviewSets(null);
}

export async function fetchReviewSets(statuses: string[] | null = ["pending", "flagged_expert"]) {
  let query = supabase.from("stamp_sets").select("*, pages!inner(label, containers!inner(label))");
  if (statuses) query = query.in("review_status", statuses);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & { pages: { label: string; containers: { label: string } } }
  >;

  const setIds = rows.map((row) => String(row["id"]));
  const membersBySet: Record<string, SetMember[]> = {};
  const paths = new Set<string>();

  if (setIds.length > 0) {
    const { data: memberRows, error: memberError } = await supabase
      .from("stamps")
      .select("id, set_id, bbox, pages!inner(photo_path)")
      .in("set_id", setIds)
      .order("position_index", { ascending: true });
    if (memberError) throw memberError;
    for (const row of (memberRows ?? []) as unknown as Array<{
      id: string;
      set_id: string | null;
      bbox: unknown;
      pages: { photo_path: string | null };
    }>) {
      if (!row.set_id) continue;
      const list = (membersBySet[row.set_id] ??= []);
      list.push({ id: row.id, bbox: row.bbox, photo_path: row.pages.photo_path });
      if (row.pages.photo_path) paths.add(row.pages.photo_path);
    }
  }

  const photoUrls: Record<string, string> = {};
  if (paths.size > 0) {
    const signed = await supabase.storage
      .from("captures")
      .createSignedUrls(Array.from(paths), 3600);
    if (signed.error) throw signed.error;
    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) photoUrls[item.path] = item.signedUrl;
    }
  }

  const sets = rows.map((row) => {
    const { pages, ...rest } = row;
    const members = membersBySet[String(row["id"])] ?? [];
    return {
      ...(rest as unknown as ReviewSet),
      page_label: pages.label,
      container_label: pages.containers.label,
      members: members.filter((member) => parseBbox(member.bbox) !== null),
      member_count: members.length,
    } as ReviewSet;
  });

  return { sets, photoUrls };
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

export type BrowseStamp = ReviewStamp & {
  set_id: string | null;
  set_name: string | null;
  set_member_count: number;
};

export async function fetchBrowseStamps() {
  const { data, error } = await supabase
    .from("stamps")
    .select("*, pages!inner(label, photo_path, containers!inner(label)), stamp_sets(set_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<
    Record<string, unknown> & {
      pages: { label: string; photo_path: string | null; containers: { label: string } };
      stamp_sets: { set_name: string } | null;
    }
  >;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    const setId = row["set_id"] as string | null;
    if (setId) counts[setId] = (counts[setId] ?? 0) + 1;
  }

  const stamps = rows.map((row) => {
    const { pages, stamp_sets, ...rest } = row;
    const setId = (row["set_id"] as string | null) ?? null;
    return {
      ...(rest as unknown as ReviewStamp),
      page_label: pages.label,
      page_photo_path: pages.photo_path,
      container_label: pages.containers.label,
      set_id: setId,
      set_name: stamp_sets?.set_name ?? null,
      set_member_count: setId ? (counts[setId] ?? 0) : 0,
    } as BrowseStamp;
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

export async function recalculatePriorities() {
  const [stampsResult, setsResult] = await Promise.all([
    supabase
      .from("stamps")
      .select(
        "id, set_id, confidence, year_estimate, format, country, denomination, currency, item_type, is_overprinted, priority_score, priority_reasons",
      ),
    supabase.from("stamp_sets").select("id, item_count"),
  ]);
  if (stampsResult.error) throw stampsResult.error;
  if (setsResult.error) throw setsResult.error;

  const stamps = (stampsResult.data ?? []) as Array<Record<string, unknown>>;
  const sets = (setsResult.data ?? []) as Array<Record<string, unknown>>;

  const computed = new Map<string, { score: number; reasons: string[]; set_id: string | null }>();
  for (const row of stamps) {
    const priority = computePriority({
      confidence: row["confidence"] === null ? null : Number(row["confidence"]),
      year_estimate: row["year_estimate"] as number | null,
      format: row["format"] as string | null,
      country: row["country"] as string | null,
      denomination: row["denomination"] as string | null,
      currency: row["currency"] as string | null,
      item_type: row["item_type"] as string | null,
      is_overprinted: row["is_overprinted"] === true,
    });
    computed.set(String(row["id"]), {
      ...priority,
      set_id: row["set_id"] ? String(row["set_id"]) : null,
    });
  }

  let setsUpdated = 0;
  for (const set of sets) {
    const setId = String(set["id"]);
    const members = [...computed.entries()].filter(([, value]) => value.set_id === setId);
    const expected = set["item_count"] === null ? null : Number(set["item_count"]);
    const present = members.length;
    const isComplete = expected !== null && expected > 0 ? present >= expected : null;
    const priority = computeSetPriority({
      members: members.map(([, value]) => ({ score: value.score, reasons: value.reasons })),
      is_complete: isComplete,
      present_count: present,
      expected_count: expected,
    });
    const { error } = await supabase
      .from("stamp_sets")
      .update({ priority_score: priority.score, priority_reasons: priority.reasons })
      .eq("id", setId);
    if (error) throw error;
    setsUpdated += 1;
    for (const [memberId, value] of members) {
      computed.set(memberId, { ...value, score: priority.score, reasons: priority.reasons });
    }
  }

  let stampsUpdated = 0;
  for (const [id, value] of computed) {
    const { error } = await supabase
      .from("stamps")
      .update({ priority_score: value.score, priority_reasons: value.reasons })
      .eq("id", id);
    if (error) throw error;
    stampsUpdated += 1;
  }

  return { stampsUpdated, setsUpdated };
}

export type ExportStamp = {
  id: string;
  container_label: string;
  page_label: string;
  page_photo_path: string | null;
  position_index: number | null;
  bbox: unknown;
  country: string | null;
  country_inscription: string | null;
  denomination: string | null;
  currency: string | null;
  year_estimate: number | null;
  issue_name: string | null;
  catalogue_system: string | null;
  catalogue_number: string | null;
  item_type: string;
  format: string;
  is_overprinted: boolean;
  mint_or_used: string | null;
  faults: string[] | null;
  confidence: number | null;
  priority_score: number;
  priority_reasons: string[] | null;
  set_id: string | null;
  set_name: string | null;
  quantity: number;
  notes: string | null;
  market_notes: string | null;
};

export type ExportSet = {
  id: string;
  container_label: string;
  page_label: string;
  set_name: string;
  catalogue_system: string | null;
  catalogue_range: string | null;
  item_count: number | null;
  present_count: number;
  is_complete: boolean | null;
  priority_score: number;
  member_ids: string[];
};

export type ExportPage = {
  id: string;
  container_label: string;
  page_label: string;
  capture_type: string | null;
  photo_path: string | null;
  identify_status: string;
  stamp_count: number;
  page_notes: string | null;
};

export type ExportData = {
  stamps: ExportStamp[];
  sets: ExportSet[];
  pages: ExportPage[];
  photoUrls: Record<string, string>;
};

/** Everything the export route needs, optionally limited to one container. */
export async function fetchExportData(containerId?: string): Promise<ExportData> {
  const [containersResult, pagesResult] = await Promise.all([
    supabase.from("containers").select("id, label"),
    containerId
      ? supabase.from("pages").select("*").eq("container_id", containerId)
      : supabase.from("pages").select("*"),
  ]);
  if (containersResult.error) throw containersResult.error;
  if (pagesResult.error) throw pagesResult.error;

  const containerLabels = new Map((containersResult.data ?? []).map((row) => [row.id, row.label]));
  const pageRows = (pagesResult.data ?? []) as Array<Page>;
  pageRows.sort((a, b) => a.label.localeCompare(b.label));
  const pageIds = pageRows.map((page) => page.id);
  const pageMeta = new Map(
    pageRows.map((page) => [
      page.id,
      {
        page_label: page.label,
        container_label: containerLabels.get(page.container_id) ?? "Unknown",
        photo_path: page.photo_path,
      },
    ]),
  );

  if (pageIds.length === 0) return { stamps: [], sets: [], pages: [], photoUrls: {} };

  const [stampsResult, setsResult] = await Promise.all([
    supabase
      .from("stamps")
      .select("*, stamp_sets(set_name)")
      .in("page_id", pageIds)
      .order("position_index", { ascending: true }),
    supabase.from("stamp_sets").select("*").in("page_id", pageIds),
  ]);
  if (stampsResult.error) throw stampsResult.error;
  if (setsResult.error) throw setsResult.error;

  const stampRows = (stampsResult.data ?? []) as unknown as Array<
    Record<string, unknown> & { stamp_sets: { set_name: string } | null }
  >;

  const stamps: ExportStamp[] = stampRows
    .filter((row) => row["review_status"] !== "rejected")
    .map((row) => {
      const meta = pageMeta.get(String(row["page_id"]))!;
      return {
        id: String(row["id"]),
        container_label: meta.container_label,
        page_label: meta.page_label,
        page_photo_path: meta.photo_path,
        position_index: (row["position_index"] as number | null) ?? null,
        bbox: row["bbox"],
        country: (row["country"] as string | null) ?? null,
        country_inscription: (row["country_inscription"] as string | null) ?? null,
        denomination: (row["denomination"] as string | null) ?? null,
        currency: (row["currency"] as string | null) ?? null,
        year_estimate: (row["year_estimate"] as number | null) ?? null,
        issue_name: (row["issue_name"] as string | null) ?? null,
        catalogue_system: (row["catalogue_system"] as string | null) ?? null,
        catalogue_number: (row["catalogue_number"] as string | null) ?? null,
        item_type: String(row["item_type"]),
        format: String(row["format"]),
        is_overprinted: row["is_overprinted"] === true,
        mint_or_used: (row["mint_or_used"] as string | null) ?? null,
        faults: (row["faults"] as string[] | null) ?? null,
        confidence: row["confidence"] === null ? null : Number(row["confidence"]),
        priority_score: Number(row["priority_score"] ?? 0),
        priority_reasons: (row["priority_reasons"] as string[] | null) ?? null,
        set_id: (row["set_id"] as string | null) ?? null,
        set_name: row.stamp_sets?.set_name ?? null,
        quantity: Number(row["quantity"] ?? 1),
        notes: (row["notes"] as string | null) ?? null,
        market_notes: (row["market_notes"] as string | null) ?? null,
      };
    });

  const membersBySet: Record<string, string[]> = {};
  for (const stamp of stamps) {
    if (stamp.set_id) (membersBySet[stamp.set_id] ??= []).push(stamp.id);
  }

  const sets: ExportSet[] = (
    (setsResult.data ?? []) as unknown as Array<Record<string, unknown>>
  ).map((row) => {
    const id = String(row["id"]);
    const meta = pageMeta.get(String(row["page_id"]))!;
    const members = membersBySet[id] ?? [];
    const expected = row["item_count"] === null ? null : Number(row["item_count"]);
    return {
      id,
      container_label: meta.container_label,
      page_label: meta.page_label,
      set_name: String(row["set_name"]),
      catalogue_system: (row["catalogue_system"] as string | null) ?? null,
      catalogue_range: (row["catalogue_range"] as string | null) ?? null,
      item_count: expected,
      present_count: members.length,
      is_complete: expected !== null && expected > 0 ? members.length >= expected : null,
      priority_score: Number(row["priority_score"] ?? 0),
      member_ids: members,
    };
  });

  const countByPage: Record<string, number> = {};
  for (const row of stampRows) {
    const pageId = String(row["page_id"]);
    countByPage[pageId] = (countByPage[pageId] ?? 0) + 1;
  }

  const pages: ExportPage[] = pageRows.map((page) => ({
    id: page.id,
    container_label: containerLabels.get(page.container_id) ?? "Unknown",
    page_label: page.label,
    capture_type: page.capture_type,
    photo_path: page.photo_path,
    identify_status: page.identify_status,
    stamp_count: countByPage[page.id] ?? 0,
    page_notes: page.page_notes,
  }));

  const paths = Array.from(
    new Set(pageRows.map((page) => page.photo_path).filter((p): p is string => !!p)),
  );
  const photoUrls: Record<string, string> = {};
  if (paths.length > 0) {
    const signed = await supabase.storage.from("captures").createSignedUrls(paths, 3600);
    if (signed.error) throw signed.error;
    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) photoUrls[item.path] = item.signedUrl;
    }
  }

  return { stamps, sets, pages, photoUrls };
}

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
  year_estimate: number | null;
  item_type: string;
  review_status: string;
  quantity: number;
  confidence: number | null;
};

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

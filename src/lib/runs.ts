import { supabase } from "@/integrations/supabase/client";

export type RunError = { page_id: string; label: string; message: string };

export type IdentifyRun = {
  id: string;
  page_ids: string[];
  current_index: number;
  status: "running" | "done" | "cancelled";
  started_at: string;
  finished_at: string | null;
  errors: RunError[];
};

function toRun(row: Record<string, unknown>): IdentifyRun {
  return {
    id: String(row["id"]),
    page_ids: (row["page_ids"] as string[] | null) ?? [],
    current_index: Number(row["current_index"] ?? 0),
    status: row["status"] as IdentifyRun["status"],
    started_at: String(row["started_at"]),
    finished_at: (row["finished_at"] as string | null) ?? null,
    errors: Array.isArray(row["errors"]) ? (row["errors"] as RunError[]) : [],
  };
}

export async function fetchLatestRun(): Promise<IdentifyRun | null> {
  const { data, error } = await supabase
    .from("identify_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? toRun(row as unknown as Record<string, unknown>) : null;
}

export async function createRun(pageIds: string[]): Promise<IdentifyRun> {
  const { data, error } = await supabase
    .from("identify_runs")
    .insert({ page_ids: pageIds, current_index: 0, status: "running" } as never)
    .select("*")
    .single();
  if (error) throw error;
  return toRun(data as unknown as Record<string, unknown>);
}

export async function patchRun(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("identify_runs")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function requestCancel(id: string) {
  await patchRun(id, { status: "cancelled", finished_at: new Date().toISOString() });
}

export async function fetchRunStatus(id: string) {
  const { data, error } = await supabase
    .from("identify_runs")
    .select("status")
    .eq("id", id)
    .single();
  if (error) throw error;
  return (data as { status: string }).status;
}

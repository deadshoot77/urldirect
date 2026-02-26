import "server-only";
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { PixelLogInput, PixelType, RedirectRule, RedirectStatus, ResolvedRedirect } from "@/lib/types";

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdminClient: SupabaseClient | undefined;
}

interface RedirectRuleRow {
  id: number;
  slug: string;
  target_url: string;
  status_code: number;
  is_active: boolean;
  pixel_enabled: boolean;
  pixel_type: PixelType | null;
  pixel_config: unknown;
  created_at: string;
  updated_at: string;
}

interface ResolveRedirectRow {
  resolved_slug: string;
  target_url: string;
  status_code: number;
  pixel_enabled: boolean;
  pixel_type: PixelType | null;
  pixel_config: unknown;
  rule_id: number | null;
}

function createAdminClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (!globalThis.__supabaseAdminClient) {
    globalThis.__supabaseAdminClient = createAdminClient();
  }
  return globalThis.__supabaseAdminClient;
}

function assertNoError(error: PostgrestError | null, context: string): void {
  if (!error) return;
  throw new Error(`${context}: ${error.message}`);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toStatusCode(value: unknown, fallback: RedirectStatus): RedirectStatus {
  const parsed = toNumber(value, fallback);
  return parsed === 301 ? 301 : 302;
}

function normalizeSlugValue(slug: string | null): string {
  if (!slug) return "/";
  const normalized = slug.trim().toLowerCase();
  return normalized || "/";
}

function serializeJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseJsonString(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error("pixel_config must be valid JSON");
  }
}

function mapRule(row: RedirectRuleRow): RedirectRule {
  return {
    id: toNumber(row.id),
    slug: toString(row.slug),
    targetUrl: toString(row.target_url),
    statusCode: toStatusCode(row.status_code, 302),
    isActive: Boolean(row.is_active),
    pixelEnabled: Boolean(row.pixel_enabled),
    pixelType: row.pixel_type,
    pixelConfig: serializeJson(row.pixel_config),
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at)
  };
}

export interface UpsertRuleInput {
  slug: string;
  targetUrl: string;
  statusCode: RedirectStatus;
  isActive: boolean;
  pixelEnabled: boolean;
  pixelType: RedirectRule["pixelType"];
  pixelConfig: string | null;
}

export interface ResolveRedirectRpcInput {
  slug: string | null;
  defaultUrl: string;
  defaultStatus: RedirectStatus;
  userAgent: string | null;
  referer: string | null;
  ipHash: string;
  country: string;
  queryString: string;
}

export async function getRedirectRuleBySlug(slug: string): Promise<RedirectRule | null> {
  const normalized = normalizeSlugValue(slug);
  if (normalized === "/") return null;

  const { data, error } = await getSupabaseAdminClient()
    .from("redirect_rules")
    .select(
      "id, slug, target_url, status_code, is_active, pixel_enabled, pixel_type, pixel_config, created_at, updated_at"
    )
    .eq("slug", normalized)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  assertNoError(error, "getRedirectRuleBySlug failed");
  return data ? mapRule(data as RedirectRuleRow) : null;
}

export async function listRedirectRules(): Promise<RedirectRule[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("redirect_rules")
    .select(
      "id, slug, target_url, status_code, is_active, pixel_enabled, pixel_type, pixel_config, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  assertNoError(error, "listRedirectRules failed");
  return (data ?? []).map((row) => mapRule(row as RedirectRuleRow));
}

export async function upsertRedirectRule(input: UpsertRuleInput): Promise<void> {
  const normalizedSlug = normalizeSlugValue(input.slug);
  if (normalizedSlug === "/") {
    throw new Error("slug cannot be empty");
  }

  const pixelEnabled = input.pixelEnabled;
  const pixelType = pixelEnabled ? input.pixelType : null;
  const pixelConfig = pixelEnabled ? parseJsonString(input.pixelConfig) : null;

  const { error } = await getSupabaseAdminClient().from("redirect_rules").upsert(
    {
      slug: normalizedSlug,
      target_url: input.targetUrl,
      status_code: input.statusCode,
      is_active: input.isActive,
      pixel_enabled: pixelEnabled,
      pixel_type: pixelType,
      pixel_config: pixelConfig
    },
    {
      onConflict: "slug"
    }
  );

  assertNoError(error, "upsertRedirectRule failed");
}

export async function deleteRedirectRule(slug: string): Promise<void> {
  const normalized = normalizeSlugValue(slug);
  if (normalized === "/") {
    throw new Error("slug cannot be empty");
  }

  const { error } = await getSupabaseAdminClient().from("redirect_rules").delete().eq("slug", normalized);
  assertNoError(error, "deleteRedirectRule failed");
}

export async function insertPixelLog(input: PixelLogInput): Promise<void> {
  const { error } = await getSupabaseAdminClient().from("pixel_logs").insert({
    rule_id: input.ruleId,
    slug: input.slug,
    pixel_type: input.pixelType,
    event_name: input.eventName,
    status: input.status,
    response_code: input.responseCode,
    response_body: input.responseBody,
    error_message: input.errorMessage,
    payload: input.payload
  });

  assertNoError(error, "insertPixelLog failed");
}

export async function resolveRedirect(input: ResolveRedirectRpcInput): Promise<ResolvedRedirect> {
  const fallbackSlug = normalizeSlugValue(input.slug);

  const { data, error } = await getSupabaseAdminClient().rpc("resolve_redirect", {
    p_slug: input.slug,
    p_default_url: input.defaultUrl,
    p_default_status: input.defaultStatus,
    p_user_agent: input.userAgent,
    p_referer: input.referer,
    p_ip_hash: input.ipHash,
    p_country: input.country,
    p_query_string: input.queryString
  });

  assertNoError(error, "resolve_redirect rpc failed");

  const row = (Array.isArray(data) ? data[0] : data) as ResolveRedirectRow | null;
  if (!row) {
    return {
      slug: fallbackSlug,
      targetUrl: input.defaultUrl,
      statusCode: input.defaultStatus,
      pixelEnabled: false,
      pixelType: null,
      pixelConfig: null,
      ruleId: null
    };
  }

  return {
    slug: toString(row.resolved_slug, fallbackSlug),
    targetUrl: toString(row.target_url, input.defaultUrl),
    statusCode: toStatusCode(row.status_code, input.defaultStatus),
    pixelEnabled: Boolean(row.pixel_enabled),
    pixelType: row.pixel_type,
    pixelConfig: serializeJson(row.pixel_config),
    ruleId: row.rule_id === null || row.rule_id === undefined ? null : toNumber(row.rule_id)
  };
}

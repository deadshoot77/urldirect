import "server-only";
import { getSupabaseAdminClient } from "@/lib/db";
import { env } from "@/lib/env";
import type {
  AdminPlan,
  AdminSettings,
  DeepLinksConfig,
  LinkOverviewStats,
  RedirectStatus,
  RetargetingScript,
  RoutingRule,
  ShortLink,
  ShortLinkListItem,
  TimeSeriesPoint,
  TrackingLimitBehavior
} from "@/lib/types";

interface ShortLinkRow {
  id: string;
  slug: string;
  destination_url: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  title: string | null;
  is_favorite: boolean;
  tags: unknown;
  redirect_type: number;
  routing_rules: unknown;
  deep_links: unknown;
  retargeting_scripts: unknown;
  is_active: boolean;
}

interface ShortLinkListRow {
  id: string;
  slug: string;
  destination_url: string;
  created_at: string;
  is_favorite: boolean;
  tags: unknown;
  redirect_type: number;
  clicks_received: number;
  clicks_today: number;
  last_click_at: string | null;
}

interface SettingsRow {
  plan: AdminPlan;
  click_limit_monthly: number;
  tracking_enabled: boolean;
  limit_behavior: TrackingLimitBehavior;
}

interface OverviewRow {
  total_clicks: number;
  qr_scans: number;
  clicks_today: number;
  last_click_at: string | null;
  unique_clicks: number;
  non_unique_clicks: number;
}

interface TimeSeriesRow {
  bucket_at: string;
  label: string;
  clicks: number;
}

interface LabelCountRow {
  label: string;
  clicks: number;
}

export interface LabelCount {
  label: string;
  clicks: number;
}

export interface LinkAnalyticsData {
  overview: LinkOverviewStats;
  timeseries: {
    hours: TimeSeriesPoint[];
    days: TimeSeriesPoint[];
    months: TimeSeriesPoint[];
  };
  worldMap: LabelCount[];
  topCities: LabelCount[];
  topRegions: LabelCount[];
  topDays: LabelCount[];
  popularHours: LabelCount[];
  clickType: LabelCount[];
  topSocialPlatforms: LabelCount[];
  topSources: LabelCount[];
  topBrowsers: LabelCount[];
  topDevices: LabelCount[];
  topLanguages: LabelCount[];
  topPlatforms: LabelCount[];
}

export interface PaginatedShortLinks {
  items: ShortLinkListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateShortLinkInput {
  slug: string;
  destinationUrl: string;
  redirectType: RedirectStatus;
  title?: string | null;
  isFavorite?: boolean;
  tags?: string[];
  routingRules?: RoutingRule[];
  deepLinks?: DeepLinksConfig;
  retargetingScripts?: RetargetingScript[];
  isActive?: boolean;
}

export interface UpdateShortLinkInput {
  slug?: string;
  destinationUrl?: string;
  redirectType?: RedirectStatus;
  title?: string | null;
  isFavorite?: boolean;
  tags?: string[];
  routingRules?: RoutingRule[];
  deepLinks?: DeepLinksConfig;
  retargetingScripts?: RetargetingScript[];
  isActive?: boolean;
}

export interface InsertClickEventInput {
  linkId: string;
  slug: string;
  referrer: string | null;
  ua: string | null;
  ipHash: string;
  country: string;
  region: string | null;
  city: string | null;
  device: string;
  os: string;
  browser: string;
  platform: string;
  language: string;
  queryParams: Record<string, string | string[]>;
  isUnique: boolean;
  source: string;
  utm: Record<string, string>;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toString(entry).trim())
    .filter((entry) => entry.length > 0);
}

function parseRoutingRules(value: unknown): RoutingRule[] {
  if (!Array.isArray(value)) return [];
  const output: RoutingRule[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const destinationUrl = toString(raw.destination_url).trim();
    if (!destinationUrl) {
      continue;
    }
    output.push({
      id: toStringOrNull(raw.id) ?? undefined,
      name: toStringOrNull(raw.name) ?? undefined,
      destination_url: destinationUrl,
      devices: toStringArray(raw.devices),
      countries: toStringArray(raw.countries),
      languages: toStringArray(raw.languages),
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled)
    });
  }
  return output;
}

function parseDeepLinks(value: unknown): DeepLinksConfig {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  return {
    ios_url: toStringOrNull(raw.ios_url) ?? undefined,
    android_url: toStringOrNull(raw.android_url) ?? undefined,
    fallback_url: toStringOrNull(raw.fallback_url) ?? undefined
  };
}

function parseRetargetingScripts(value: unknown): RetargetingScript[] {
  if (!Array.isArray(value)) return [];
  const output: RetargetingScript[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const raw = entry as Record<string, unknown>;
    output.push({
      id: toStringOrNull(raw.id) ?? undefined,
      name: toStringOrNull(raw.name) ?? undefined,
      type:
        raw.type === "inline" || raw.type === "external" || raw.type === "pixel"
          ? raw.type
          : ("inline" as const),
      content: toStringOrNull(raw.content) ?? undefined,
      src: toStringOrNull(raw.src) ?? undefined,
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled)
    });
  }
  return output;
}

function mapShortLink(row: ShortLinkRow): ShortLink {
  return {
    id: row.id,
    slug: toString(row.slug),
    destinationUrl: toString(row.destination_url),
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
    createdBy: toStringOrNull(row.created_by),
    title: toStringOrNull(row.title),
    isFavorite: Boolean(row.is_favorite),
    tags: toStringArray(row.tags),
    redirectType: toNumber(row.redirect_type) === 301 ? 301 : 302,
    routingRules: parseRoutingRules(row.routing_rules),
    deepLinks: parseDeepLinks(row.deep_links),
    retargetingScripts: parseRetargetingScripts(row.retargeting_scripts),
    isActive: Boolean(row.is_active)
  };
}

function mapLabelCounts(rows: LabelCountRow[]): LabelCount[] {
  return rows.map((row) => ({
    label: toString(row.label) || "unknown",
    clicks: toNumber(row.clicks)
  }));
}

async function runRpcList<T>(name: string, args?: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await getSupabaseAdminClient().rpc(name, args ?? {});
  if (error) {
    throw new Error(`${name} failed: ${error.message}`);
  }
  if (!data) return [];
  return Array.isArray(data) ? (data as T[]) : ([data] as T[]);
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function normalizePlan(value: string | null | undefined): AdminPlan {
  return value === "pro" ? "pro" : env.ADMIN_PLAN_DEFAULT;
}

function normalizeLimitBehavior(value: string | null | undefined): TrackingLimitBehavior {
  return value === "minimal" ? "minimal" : env.TRACKING_LIMIT_BEHAVIOR;
}

export async function getCurrentMonthClicks(): Promise<number> {
  const rows = await runRpcList<{ total_clicks: number }>("current_month_clicks");
  return toNumber(rows[0]?.total_clicks);
}

export async function getAdminSettings(): Promise<AdminSettings> {
  let row: SettingsRow | undefined;
  try {
    const rows = await runRpcList<SettingsRow>("get_admin_settings");
    row = rows[0];
  } catch {
    row = undefined;
  }

  const usageThisMonth = await getCurrentMonthClicks().catch(() => 0);
  const clickLimit = toNumber(row?.click_limit_monthly ?? env.CLICK_LIMIT_MONTHLY);
  const trackingEnabled = row?.tracking_enabled ?? env.TRACKING_ENABLED_DEFAULT;
  const plan = normalizePlan(row?.plan);
  const limitBehavior = normalizeLimitBehavior(row?.limit_behavior);

  return {
    plan,
    clickLimitMonthly: clickLimit,
    trackingEnabled,
    limitBehavior,
    usageThisMonth,
    limitReached: usageThisMonth >= clickLimit
  };
}

export async function listShortLinksWithStats(page = 1, pageSize = 20): Promise<PaginatedShortLinks> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const offset = (safePage - 1) * safeSize;

  const [{ count, error: totalError }, rows] = await Promise.all([
    getSupabaseAdminClient().from("short_links").select("id", { head: true, count: "exact" }).eq("is_active", true),
    runRpcList<ShortLinkListRow>("list_short_links_with_stats", {
      p_limit: safeSize,
      p_offset: offset
    })
  ]);

  if (totalError) {
    throw new Error(`listShortLinksWithStats total failed: ${totalError.message}`);
  }

  const items = rows.map((row) => ({
    id: row.id,
    slug: toString(row.slug),
    destinationUrl: toString(row.destination_url),
    createdAt: toString(row.created_at),
    updatedAt: toString(row.created_at),
    createdBy: null,
    title: null,
    isFavorite: Boolean(row.is_favorite),
    tags: toStringArray(row.tags),
    redirectType: (toNumber(row.redirect_type) === 301 ? 301 : 302) as RedirectStatus,
    routingRules: [],
    deepLinks: {},
    retargetingScripts: [],
    isActive: true,
    clicksReceived: toNumber(row.clicks_received),
    clicksToday: toNumber(row.clicks_today),
    lastClickAt: toStringOrNull(row.last_click_at)
  }));

  const safeTotal = totalError ? items.length : toNumber(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize));

  return {
    items,
    page: safePage,
    pageSize: safeSize,
    total: safeTotal,
    totalPages
  };
}

export async function getShortLinkById(id: string): Promise<ShortLink | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("short_links")
    .select(
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, is_active"
    )
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getShortLinkById failed: ${error.message}`);
  }
  return data ? mapShortLink(data as ShortLinkRow) : null;
}

export async function getShortLinkBySlug(slug: string): Promise<ShortLink | null> {
  const normalized = normalizeSlug(slug);
  const { data, error } = await getSupabaseAdminClient()
    .from("short_links")
    .select(
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, is_active"
    )
    .eq("slug", normalized)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getShortLinkBySlug failed: ${error.message}`);
  }
  return data ? mapShortLink(data as ShortLinkRow) : null;
}

function buildMutationPayload(input: UpdateShortLinkInput | CreateShortLinkInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ("slug" in input && typeof input.slug === "string") {
    payload.slug = normalizeSlug(input.slug);
  }
  if ("destinationUrl" in input && typeof input.destinationUrl === "string") {
    payload.destination_url = input.destinationUrl;
  }
  if ("redirectType" in input && (input.redirectType === 301 || input.redirectType === 302)) {
    payload.redirect_type = input.redirectType;
  }
  if ("title" in input) {
    payload.title = input.title ?? null;
  }
  if ("isFavorite" in input && typeof input.isFavorite === "boolean") {
    payload.is_favorite = input.isFavorite;
  }
  if ("tags" in input && Array.isArray(input.tags)) {
    payload.tags = input.tags;
  }
  if ("routingRules" in input && Array.isArray(input.routingRules)) {
    payload.routing_rules = input.routingRules;
  }
  if ("deepLinks" in input && input.deepLinks) {
    payload.deep_links = input.deepLinks;
  }
  if ("retargetingScripts" in input && Array.isArray(input.retargetingScripts)) {
    payload.retargeting_scripts = input.retargetingScripts;
  }
  if ("isActive" in input && typeof input.isActive === "boolean") {
    payload.is_active = input.isActive;
  }
  return payload;
}

export async function createShortLink(input: CreateShortLinkInput): Promise<ShortLink> {
  const payload = buildMutationPayload(input);

  const { data, error } = await getSupabaseAdminClient()
    .from("short_links")
    .insert(payload)
    .select(
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, is_active"
    )
    .limit(1)
    .single();

  if (error) {
    throw new Error(`createShortLink failed: ${error.message}`);
  }
  return mapShortLink(data as ShortLinkRow);
}

export async function updateShortLink(id: string, input: UpdateShortLinkInput): Promise<ShortLink> {
  const payload = buildMutationPayload(input);
  if (Object.keys(payload).length === 0) {
    const existing = await getShortLinkById(id);
    if (!existing) {
      throw new Error("Link not found");
    }
    return existing;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("short_links")
    .update(payload)
    .eq("id", id)
    .select(
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, is_active"
    )
    .limit(1)
    .single();

  if (error) {
    throw new Error(`updateShortLink failed: ${error.message}`);
  }
  return mapShortLink(data as ShortLinkRow);
}

export async function getLinkOverview(linkId: string): Promise<LinkOverviewStats> {
  const rows = await runRpcList<OverviewRow>("get_link_overview", { p_link_id: linkId });
  const row = rows[0];
  return {
    totalClicks: toNumber(row?.total_clicks),
    qrScans: toNumber(row?.qr_scans),
    clicksToday: toNumber(row?.clicks_today),
    lastClickAt: toStringOrNull(row?.last_click_at),
    uniqueClicks: toNumber(row?.unique_clicks),
    nonUniqueClicks: toNumber(row?.non_unique_clicks)
  };
}

export async function getLinkTimeseries(
  linkId: string,
  granularity: "hours" | "days" | "months",
  points: number
): Promise<TimeSeriesPoint[]> {
  const rows = await runRpcList<TimeSeriesRow>("get_link_timeseries", {
    p_link_id: linkId,
    p_granularity: granularity,
    p_points: points
  });
  return rows.map((row) => ({
    bucketAt: toString(row.bucket_at),
    label: toString(row.label),
    clicks: toNumber(row.clicks)
  }));
}

export async function getLinkTopDimension(
  linkId: string,
  dimension: "country" | "region" | "city" | "source" | "browser" | "device" | "os" | "language" | "platform" | "social",
  limit = 10
): Promise<LabelCount[]> {
  const rows = await runRpcList<LabelCountRow>("get_link_top_dimension", {
    p_link_id: linkId,
    p_dimension: dimension,
    p_limit: limit
  });
  return mapLabelCounts(rows);
}

export async function getLinkDayBreakdown(linkId: string): Promise<LabelCount[]> {
  const rows = await runRpcList<LabelCountRow>("get_link_day_breakdown", {
    p_link_id: linkId
  });
  return mapLabelCounts(rows);
}

export async function getLinkHourBreakdown(linkId: string): Promise<LabelCount[]> {
  const rows = await runRpcList<LabelCountRow>("get_link_hour_breakdown", {
    p_link_id: linkId
  });
  return mapLabelCounts(rows);
}

export async function getLinkAnalyticsData(linkId: string): Promise<LinkAnalyticsData> {
  const [
    overview,
    hoursSeries,
    daysSeries,
    monthsSeries,
    topCountries,
    topCities,
    topRegions,
    topSources,
    topBrowsers,
    topDevices,
    topLanguages,
    topPlatforms,
    topSocialPlatforms,
    topDays,
    popularHours
  ] = await Promise.all([
    getLinkOverview(linkId),
    getLinkTimeseries(linkId, "hours", 24),
    getLinkTimeseries(linkId, "days", 30),
    getLinkTimeseries(linkId, "months", 12),
    getLinkTopDimension(linkId, "country", 12),
    getLinkTopDimension(linkId, "city", 8),
    getLinkTopDimension(linkId, "region", 8),
    getLinkTopDimension(linkId, "source", 8),
    getLinkTopDimension(linkId, "browser", 8),
    getLinkTopDimension(linkId, "device", 6),
    getLinkTopDimension(linkId, "language", 8),
    getLinkTopDimension(linkId, "platform", 8),
    getLinkTopDimension(linkId, "social", 8),
    getLinkDayBreakdown(linkId),
    getLinkHourBreakdown(linkId)
  ]);

  const clickType: LabelCount[] = [
    { label: "Unique", clicks: overview.uniqueClicks },
    { label: "Non-Unique", clicks: overview.nonUniqueClicks }
  ];

  return {
    overview,
    timeseries: {
      hours: hoursSeries,
      days: daysSeries,
      months: monthsSeries
    },
    worldMap: topCountries,
    topCities,
    topRegions,
    topDays,
    popularHours,
    clickType,
    topSocialPlatforms,
    topSources,
    topBrowsers,
    topDevices,
    topLanguages,
    topPlatforms
  };
}

export async function isUniqueClick(linkId: string, ipHash: string): Promise<boolean> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdminClient()
    .from("click_events")
    .select("id")
    .eq("link_id", linkId)
    .eq("ip_hash", ipHash)
    .gte("created_at", sinceIso)
    .limit(1);

  if (error) {
    throw new Error(`isUniqueClick failed: ${error.message}`);
  }
  return !data || data.length === 0;
}

export async function insertClickEvent(input: InsertClickEventInput, minimal = false): Promise<void> {
  const payload: Record<string, unknown> = {
    link_id: input.linkId,
    slug: input.slug,
    ip_hash: input.ipHash,
    is_unique: input.isUnique,
    source: input.source
  };

  if (!minimal) {
    payload.referrer = input.referrer;
    payload.ua = input.ua;
    payload.country = input.country;
    payload.region = input.region;
    payload.city = input.city;
    payload.device = input.device;
    payload.os = input.os;
    payload.browser = input.browser;
    payload.platform = input.platform;
    payload.language = input.language;
    payload.query_params = input.queryParams;
    payload.utm = input.utm;
  }

  const { error } = await getSupabaseAdminClient().from("click_events").insert(payload);
  if (error) {
    throw new Error(`insertClickEvent failed: ${error.message}`);
  }
}

export async function updateAdminSettings(
  patch: Partial<{
    plan: AdminPlan;
    clickLimitMonthly: number;
    trackingEnabled: boolean;
    limitBehavior: TrackingLimitBehavior;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.plan) payload.plan = patch.plan;
  if (typeof patch.clickLimitMonthly === "number") payload.click_limit_monthly = patch.clickLimitMonthly;
  if (typeof patch.trackingEnabled === "boolean") payload.tracking_enabled = patch.trackingEnabled;
  if (patch.limitBehavior) payload.limit_behavior = patch.limitBehavior;
  if (Object.keys(payload).length === 0) return;

  const { error } = await getSupabaseAdminClient().from("admin_settings").update(payload).eq("id", 1);
  if (error) {
    throw new Error(`updateAdminSettings failed: ${error.message}`);
  }
}

import "server-only";
import { getSupabaseAdminClient } from "@/lib/db";
import { env } from "@/lib/env";
import type {
  AdminSettings,
  DeepLinksConfig,
  LandingMode,
  LinkOverviewStats,
  RedirectStatus,
  RetargetingScript,
  RoutingRule,
  ShortLink,
  ShortLinkListItem,
  TimeSeriesPoint,
  TrackingEventType,
  TrackingLimitBehavior,
  TrafficCategory
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
  landing_mode: string | null;
  background_url: string | null;
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
  tracking_enabled: boolean;
  landing_enabled: boolean;
  global_background_url: string | null;
  limit_behavior: TrackingLimitBehavior;
}

interface OverviewRow {
  total_clicks: number;
  qr_scans: number;
  clicks_today: number;
  last_click_at: string | null;
  unique_clicks: number;
  non_unique_clicks: number;
  visits: number;
  landing_views: number;
  human_clicks: number;
  redirects: number;
  direct_redirects: number;
  bot_hits: number;
  prefetch_hits: number;
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

export interface GlobalLinksStats {
  totalLinks: number;
  totalClicks: number;
  clicksToday: number;
  clicksLast7Days: number;
  uniqueClicks: number;
  topLinks: LabelCount[];
  topCountries: LabelCount[];
  topSources: LabelCount[];
}

export interface GlobalAnalyticsData extends LinkAnalyticsData {
  totalLinks: number;
  clicksLast7Days: number;
  topLinks: LabelCount[];
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
  landingMode?: LandingMode;
  backgroundUrl?: string | null;
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
  landingMode?: LandingMode;
  backgroundUrl?: string | null;
  isActive?: boolean;
}

export interface InsertClickEventInput {
  linkId: string;
  slug: string;
  eventType: TrackingEventType;
  trafficCategory: TrafficCategory;
  requestMethod: string;
  isBot: boolean;
  isPrefetch: boolean;
  dedupKey: string | null;
  requestHeaders: Record<string, string>;
  metadata: Record<string, unknown>;
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

interface ClickEventStatRow {
  slug: string | null;
  created_at: string;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  device: string | null;
  language: string | null;
  platform: string | null;
  source: string | null;
  is_unique: boolean;
  event_type: string | null;
  traffic_category: string | null;
  request_method: string | null;
  is_bot: boolean | null;
  is_prefetch: boolean | null;
  metadata: unknown;
}

interface AggregatedGlobalAnalyticsData {
  overview: LinkOverviewStats;
  clicksLast7Days: number;
  topLinks: LabelCount[];
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SOCIAL_SOURCES = new Set([
  "facebook",
  "instagram",
  "tiktok",
  "twitter",
  "x",
  "linkedin",
  "youtube",
  "reddit",
  "snapchat",
  "pinterest"
]);

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
    landingMode: normalizeLandingMode(row.landing_mode),
    backgroundUrl: toStringOrNull(row.background_url),
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

function normalizeLimitBehavior(value: string | null | undefined): TrackingLimitBehavior {
  return value === "minimal" ? "minimal" : env.TRACKING_LIMIT_BEHAVIOR;
}

function normalizeLandingMode(value: string | null | undefined): LandingMode {
  if (value === "on" || value === "off") return value;
  return "inherit";
}

function normalizeTrackingEventType(value: string | null | undefined): TrackingEventType {
  if (value === "visit" || value === "landing_view" || value === "human_click" || value === "redirect") {
    return value;
  }
  return "redirect";
}

function normalizeTrafficCategory(
  value: string | null | undefined,
  isBot = false,
  isPrefetch = false
): TrafficCategory {
  if (isPrefetch) return "prefetch";
  if (isBot) return "bot";
  if (value === "human" || value === "bot" || value === "prefetch" || value === "unknown") {
    return value;
  }
  return "unknown";
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
  const trackingEnabled = row?.tracking_enabled ?? env.TRACKING_ENABLED_DEFAULT;
  const landingEnabled = row?.landing_enabled ?? false;
  const globalBackgroundUrl = toStringOrNull(row?.global_background_url);
  const limitBehavior = normalizeLimitBehavior(row?.limit_behavior);

  return {
    plan: "pro",
    clickLimitMonthly: Number.MAX_SAFE_INTEGER,
    trackingEnabled,
    landingEnabled,
    globalBackgroundUrl,
    limitBehavior,
    usageThisMonth,
    limitReached: false
  };
}

function incrementCounter(counter: Map<string, number>, label: string): void {
  counter.set(label, (counter.get(label) ?? 0) + 1);
}

function toSortedLabelCounts(counter: Map<string, number>, limit = 8): LabelCount[] {
  return [...counter.entries()]
    .map(([label, clicks]) => ({ label, clicks }))
    .sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, limit));
}

function normalizeSlugLabel(value: string | null): string {
  const normalized = toString(value).trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeCountryLabel(value: string | null): string {
  const normalized = toString(value).trim().toUpperCase();
  if (!normalized || normalized === "UNK" || normalized === "UNKNOWN") {
    return "Unknown";
  }
  return normalized;
}

function normalizeSourceLabel(value: string | null): string {
  const normalized = toString(value).trim().toLowerCase();
  if (!normalized || normalized === "unknown") {
    return "direct";
  }
  return normalized;
}

function normalizeGenericLabel(value: string | null): string {
  const normalized = toString(value).trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeSocialSourceLabel(value: string | null): string {
  const source = normalizeSourceLabel(value);
  return SOCIAL_SOURCES.has(source) ? source : "other";
}

function incrementNumericCounter(counter: Map<number, number>, key: number): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function formatTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function startOfUtcHour(epochMs: number): number {
  const date = new Date(epochMs);
  date.setUTCMinutes(0, 0, 0);
  return date.getTime();
}

function startOfUtcDay(epochMs: number): number {
  const date = new Date(epochMs);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfUtcMonth(epochMs: number): number {
  const date = new Date(epochMs);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function buildHoursSeries(counter: Map<number, number>, start: number, end: number): TimeSeriesPoint[] {
  const output: TimeSeriesPoint[] = [];
  for (let bucket = start; bucket <= end; bucket += HOUR_MS) {
    const date = new Date(bucket);
    output.push({
      bucketAt: date.toISOString(),
      label: `${formatTwoDigits(date.getUTCHours())}:00`,
      clicks: counter.get(bucket) ?? 0
    });
  }
  return output;
}

function buildDaysSeries(counter: Map<number, number>, start: number, end: number): TimeSeriesPoint[] {
  const output: TimeSeriesPoint[] = [];
  for (let bucket = start; bucket <= end; bucket += DAY_MS) {
    const date = new Date(bucket);
    output.push({
      bucketAt: date.toISOString(),
      label: `${formatTwoDigits(date.getUTCMonth() + 1)}-${formatTwoDigits(date.getUTCDate())}`,
      clicks: counter.get(bucket) ?? 0
    });
  }
  return output;
}

function buildMonthsSeries(counter: Map<number, number>, start: number, points: number): TimeSeriesPoint[] {
  const output: TimeSeriesPoint[] = [];
  const cursor = new Date(start);
  for (let index = 0; index < points; index += 1) {
    const bucket = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1);
    output.push({
      bucketAt: new Date(bucket).toISOString(),
      label: `${cursor.getUTCFullYear()}-${formatTwoDigits(cursor.getUTCMonth() + 1)}`,
      clicks: counter.get(bucket) ?? 0
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return output;
}

async function aggregateGlobalAnalytics(batchSize = 1000): Promise<AggregatedGlobalAnalyticsData> {
  const safeBatchSize = Math.max(100, Math.min(batchSize, 2000));
  const nowMs = Date.now();
  const utcHourEnd = startOfUtcHour(nowMs);
  const utcDayEnd = startOfUtcDay(nowMs);
  const utcMonthEnd = startOfUtcMonth(nowMs);

  const utcHourStart = utcHourEnd - 23 * HOUR_MS;
  const utcDayStart = utcDayEnd - 29 * DAY_MS;
  const monthStartDate = new Date(utcMonthEnd);
  monthStartDate.setUTCMonth(monthStartDate.getUTCMonth() - 11);
  const utcMonthStart = monthStartDate.getTime();

  const utcTodayStart = utcDayEnd;
  const last7DaysStart = utcTodayStart - 6 * DAY_MS;

  let redirects = 0;
  let visits = 0;
  let landingViews = 0;
  let humanClicks = 0;
  let directRedirects = 0;
  let botHits = 0;
  let prefetchHits = 0;
  let clicksToday = 0;
  let clicksLast7Days = 0;
  let uniqueClicks = 0;
  let nonUniqueClicks = 0;
  let lastClickAt: string | null = null;
  let lastClickAtMs = Number.NEGATIVE_INFINITY;
  let offset = 0;
  let batchCount = 0;

  const linksCounter = new Map<string, number>();
  const countriesCounter = new Map<string, number>();
  const citiesCounter = new Map<string, number>();
  const regionsCounter = new Map<string, number>();
  const socialCounter = new Map<string, number>();
  const sourcesCounter = new Map<string, number>();
  const browsersCounter = new Map<string, number>();
  const devicesCounter = new Map<string, number>();
  const languagesCounter = new Map<string, number>();
  const platformsCounter = new Map<string, number>();
  const hourSeriesCounter = new Map<number, number>();
  const daySeriesCounter = new Map<number, number>();
  const monthSeriesCounter = new Map<number, number>();
  const dayBreakdown = Array.from({ length: DAY_LABELS.length }, () => 0);
  const hourBreakdown = Array.from({ length: 24 }, () => 0);

  while (true) {
    const { data, error } = await getSupabaseAdminClient()
      .from("click_events")
      .select(
        "slug, created_at, country, region, city, source, browser, device, language, platform, is_unique, event_type, traffic_category, request_method, is_bot, is_prefetch, metadata"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + safeBatchSize - 1);

    if (error) {
      throw new Error(`aggregateGlobalAnalytics failed: ${error.message}`);
    }

    const rows = (data ?? []) as ClickEventStatRow[];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const eventType = normalizeTrackingEventType(row.event_type);
      const trafficCategory = normalizeTrafficCategory(row.traffic_category, Boolean(row.is_bot), Boolean(row.is_prefetch));
      const requestMethod = toString(row.request_method || "GET").trim().toUpperCase() || "GET";

      if (eventType === "visit") {
        visits += 1;
      } else if (eventType === "landing_view") {
        landingViews += 1;
      } else if (eventType === "human_click") {
        humanClicks += 1;
      }

      if (trafficCategory === "bot") {
        botHits += 1;
      } else if (trafficCategory === "prefetch") {
        prefetchHits += 1;
      }

      const isHumanRedirect = eventType === "redirect" && trafficCategory === "human" && requestMethod === "GET";
      if (!isHumanRedirect) {
        continue;
      }

      redirects += 1;
      if (row.is_unique) {
        uniqueClicks += 1;
      } else {
        nonUniqueClicks += 1;
      }

      const metadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      if (metadata?.redirect_path === "direct") {
        directRedirects += 1;
      }

      incrementCounter(linksCounter, normalizeSlugLabel(row.slug));
      incrementCounter(countriesCounter, normalizeCountryLabel(row.country));
      incrementCounter(citiesCounter, normalizeGenericLabel(row.city));
      incrementCounter(regionsCounter, normalizeGenericLabel(row.region));
      incrementCounter(sourcesCounter, normalizeSourceLabel(row.source));
      incrementCounter(socialCounter, normalizeSocialSourceLabel(row.source));
      incrementCounter(browsersCounter, normalizeGenericLabel(row.browser).toLowerCase());
      incrementCounter(devicesCounter, normalizeGenericLabel(row.device).toLowerCase());
      incrementCounter(languagesCounter, normalizeGenericLabel(row.language).toLowerCase());
      incrementCounter(platformsCounter, normalizeGenericLabel(row.platform).toLowerCase());

      const eventAt = Date.parse(toString(row.created_at));
      if (!Number.isNaN(eventAt)) {
        if (eventAt > lastClickAtMs) {
          lastClickAtMs = eventAt;
          lastClickAt = new Date(eventAt).toISOString();
        }

        if (eventAt >= utcTodayStart) {
          clicksToday += 1;
        }
        if (eventAt >= last7DaysStart) {
          clicksLast7Days += 1;
        }

        const eventDate = new Date(eventAt);
        dayBreakdown[eventDate.getUTCDay()] += 1;
        hourBreakdown[eventDate.getUTCHours()] += 1;

        const hourBucket = startOfUtcHour(eventAt);
        if (hourBucket >= utcHourStart && hourBucket <= utcHourEnd) {
          incrementNumericCounter(hourSeriesCounter, hourBucket);
        }

        const dayBucket = startOfUtcDay(eventAt);
        if (dayBucket >= utcDayStart && dayBucket <= utcDayEnd) {
          incrementNumericCounter(daySeriesCounter, dayBucket);
        }

        const monthBucket = Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), 1);
        if (monthBucket >= utcMonthStart && monthBucket <= utcMonthEnd) {
          incrementNumericCounter(monthSeriesCounter, monthBucket);
        }
      }
    }

    if (rows.length < safeBatchSize) {
      break;
    }

    offset += safeBatchSize;
    batchCount += 1;
    if (batchCount > 2000) {
      break;
    }
  }

  const topDays: LabelCount[] = DAY_LABELS.map((label, index) => ({
    label,
    clicks: dayBreakdown[index] ?? 0
  }));

  const popularHours: LabelCount[] = hourBreakdown.map((clicks, index) => ({
    label: `${formatTwoDigits(index)}:00`,
    clicks
  }));

  const overview: LinkOverviewStats = {
    totalClicks: redirects,
    qrScans: 0,
    clicksToday,
    lastClickAt,
    uniqueClicks,
    nonUniqueClicks,
    visits,
    landingViews,
    humanClicks,
    redirects,
    directRedirects,
    botHits,
    prefetchHits
  };

  return {
    overview,
    clicksLast7Days,
    topLinks: toSortedLabelCounts(linksCounter, 8),
    timeseries: {
      hours: buildHoursSeries(hourSeriesCounter, utcHourStart, utcHourEnd),
      days: buildDaysSeries(daySeriesCounter, utcDayStart, utcDayEnd),
      months: buildMonthsSeries(monthSeriesCounter, utcMonthStart, 12)
    },
    worldMap: toSortedLabelCounts(countriesCounter, 12),
    topCities: toSortedLabelCounts(citiesCounter, 8),
    topRegions: toSortedLabelCounts(regionsCounter, 8),
    topDays,
    popularHours,
    clickType: [
      { label: "Visits", clicks: visits },
      { label: "Landing Views", clicks: landingViews },
      { label: "Human Clicks", clicks: humanClicks },
      { label: "Redirects (human)", clicks: redirects },
      { label: "Bots", clicks: botHits },
      { label: "Prefetch", clicks: prefetchHits }
    ],
    topSocialPlatforms: toSortedLabelCounts(socialCounter, 8),
    topSources: toSortedLabelCounts(sourcesCounter, 8),
    topBrowsers: toSortedLabelCounts(browsersCounter, 8),
    topDevices: toSortedLabelCounts(devicesCounter, 6),
    topLanguages: toSortedLabelCounts(languagesCounter, 8),
    topPlatforms: toSortedLabelCounts(platformsCounter, 8)
  };
}

export async function getGlobalAnalyticsData(): Promise<GlobalAnalyticsData> {
  const [{ count, error }, aggregated] = await Promise.all([
    getSupabaseAdminClient().from("short_links").select("id", { head: true, count: "exact" }).eq("is_active", true),
    aggregateGlobalAnalytics()
  ]);

  if (error) {
    throw new Error(`getGlobalAnalyticsData total links failed: ${error.message}`);
  }

  return {
    totalLinks: toNumber(count ?? 0),
    clicksLast7Days: aggregated.clicksLast7Days,
    topLinks: aggregated.topLinks,
    overview: aggregated.overview,
    timeseries: aggregated.timeseries,
    worldMap: aggregated.worldMap,
    topCities: aggregated.topCities,
    topRegions: aggregated.topRegions,
    topDays: aggregated.topDays,
    popularHours: aggregated.popularHours,
    clickType: aggregated.clickType,
    topSocialPlatforms: aggregated.topSocialPlatforms,
    topSources: aggregated.topSources,
    topBrowsers: aggregated.topBrowsers,
    topDevices: aggregated.topDevices,
    topLanguages: aggregated.topLanguages,
    topPlatforms: aggregated.topPlatforms
  };
}

export async function getGlobalLinksStats(): Promise<GlobalLinksStats> {
  const global = await getGlobalAnalyticsData();

  return {
    totalLinks: global.totalLinks,
    totalClicks: global.overview.totalClicks,
    clicksToday: global.overview.clicksToday,
    clicksLast7Days: global.clicksLast7Days,
    uniqueClicks: global.overview.uniqueClicks,
    topLinks: global.topLinks,
    topCountries: global.worldMap,
    topSources: global.topSources
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
    landingMode: "inherit" as LandingMode,
    backgroundUrl: null,
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
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, landing_mode, background_url, is_active"
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
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, landing_mode, background_url, is_active"
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
  if ("landingMode" in input && input.landingMode) {
    payload.landing_mode = normalizeLandingMode(input.landingMode);
  }
  if ("backgroundUrl" in input && input.backgroundUrl !== undefined) {
    payload.background_url = input.backgroundUrl ?? null;
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
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, landing_mode, background_url, is_active"
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
      "id, slug, destination_url, created_at, updated_at, created_by, title, is_favorite, tags, redirect_type, routing_rules, deep_links, retargeting_scripts, landing_mode, background_url, is_active"
    )
    .limit(1)
    .single();

  if (error) {
    throw new Error(`updateShortLink failed: ${error.message}`);
  }
  return mapShortLink(data as ShortLinkRow);
}

export async function deleteShortLink(id: string): Promise<void> {
  const { error } = await getSupabaseAdminClient().from("short_links").update({ is_active: false }).eq("id", id);
  if (error) {
    throw new Error(`deleteShortLink failed: ${error.message}`);
  }
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
    nonUniqueClicks: toNumber(row?.non_unique_clicks),
    visits: toNumber(row?.visits),
    landingViews: toNumber(row?.landing_views),
    humanClicks: toNumber(row?.human_clicks),
    redirects: toNumber(row?.redirects),
    directRedirects: toNumber(row?.direct_redirects),
    botHits: toNumber(row?.bot_hits),
    prefetchHits: toNumber(row?.prefetch_hits)
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
    { label: "Visits", clicks: overview.visits },
    { label: "Landing Views", clicks: overview.landingViews },
    { label: "Human Clicks", clicks: overview.humanClicks },
    { label: "Redirects (human)", clicks: overview.redirects },
    { label: "Bots", clicks: overview.botHits },
    { label: "Prefetch", clicks: overview.prefetchHits }
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
    .eq("event_type", "redirect")
    .eq("traffic_category", "human")
    .eq("request_method", "GET")
    .gte("created_at", sinceIso)
    .limit(1);

  if (!error) {
    return !data || data.length === 0;
  }

  const fallback = await getSupabaseAdminClient()
    .from("click_events")
    .select("id")
    .eq("link_id", linkId)
    .eq("ip_hash", ipHash)
    .gte("created_at", sinceIso)
    .limit(1);
  if (fallback.error) {
    throw new Error(`isUniqueClick failed: ${fallback.error.message}`);
  }
  return !fallback.data || fallback.data.length === 0;
}

export async function insertClickEvent(input: InsertClickEventInput, minimal = false): Promise<void> {
  const payload: Record<string, unknown> = {
    link_id: input.linkId,
    slug: input.slug,
    event_type: input.eventType,
    traffic_category: input.trafficCategory,
    request_method: input.requestMethod,
    is_bot: input.isBot,
    is_prefetch: input.isPrefetch,
    dedup_key: input.dedupKey,
    request_headers: input.requestHeaders,
    metadata: input.metadata,
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

  let error: { message: string } | null = null;
  if (input.dedupKey) {
    const upsertResult = await getSupabaseAdminClient().from("click_events").upsert(payload, {
      onConflict: "event_type,dedup_key",
      ignoreDuplicates: true
    });
    error = upsertResult.error;

    if (error && /no unique|no unique or exclusion|there is no unique|42P10/i.test(error.message)) {
      const existingResult = await getSupabaseAdminClient()
        .from("click_events")
        .select("id")
        .eq("event_type", input.eventType)
        .eq("dedup_key", input.dedupKey)
        .limit(1);

      if (existingResult.error) {
        throw new Error(`insertClickEvent dedup fallback failed: ${existingResult.error.message}`);
      }
      if (existingResult.data && existingResult.data.length > 0) {
        return;
      }

      const insertResult = await getSupabaseAdminClient().from("click_events").insert(payload);
      error = insertResult.error;
    }
  } else {
    const insertResult = await getSupabaseAdminClient().from("click_events").insert(payload);
    error = insertResult.error;
  }

  if (error) {
    throw new Error(`insertClickEvent failed: ${error.message}`);
  }
}

export async function updateAdminSettings(
  patch: Partial<{
    trackingEnabled: boolean;
    landingEnabled: boolean;
    globalBackgroundUrl: string | null;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (typeof patch.trackingEnabled === "boolean") payload.tracking_enabled = patch.trackingEnabled;
  if (typeof patch.landingEnabled === "boolean") payload.landing_enabled = patch.landingEnabled;
  if (patch.globalBackgroundUrl !== undefined) payload.global_background_url = patch.globalBackgroundUrl;
  if (Object.keys(payload).length === 0) return;

  const { error } = await getSupabaseAdminClient().from("admin_settings").update(payload).eq("id", 1);
  if (error) {
    throw new Error(`updateAdminSettings failed: ${error.message}`);
  }
}

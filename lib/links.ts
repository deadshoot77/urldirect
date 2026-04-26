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
}

interface ShortLinkListBaseRow {
  id: string;
  slug: string;
  destination_url: string;
  created_at: string;
  is_favorite: boolean;
  tags: unknown;
  redirect_type: number;
}

interface SettingsRow {
  tracking_enabled: boolean;
  landing_enabled: boolean;
  global_background_url: string | null;
  limit_behavior: TrackingLimitBehavior;
}

interface GetAdminSettingsOptions {
  includeUsage?: boolean;
}

interface OverviewRow {
  total_clicks: number;
  qr_scans: number;
  clicks_today: number;
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

export type AnalyticsRange = "today" | "this_week" | "last_week" | "this_month";

export interface LinkRedirectSummary {
  clicksReceived: number;
  clicksToday: number;
}

export interface LinkRedirectSummariesResult {
  stats: Record<string, LinkRedirectSummary>;
  fallback: boolean;
}

interface LinkRedirectSummaryRpcRow {
  link_id: string | null;
  clicks_received: number | null;
  clicks_today: number | null;
}

export function createEmptyGlobalAnalyticsData(totalLinks = 0): GlobalAnalyticsData {
  const topDays: LabelCount[] = DAY_LABELS.map((label) => ({
    label,
    clicks: 0
  }));
  const popularHours: LabelCount[] = Array.from({ length: 24 }, (_, hour) => ({
    label: `${formatTwoDigits(hour)}:00`,
    clicks: 0
  }));

  return {
    totalLinks: Math.max(0, Math.floor(totalLinks)),
    clicksLast7Days: 0,
    topLinks: [],
    overview: {
      totalClicks: 0,
      qrScans: 0,
      clicksToday: 0,
      uniqueClicks: 0,
      nonUniqueClicks: 0,
      visits: 0,
      landingViews: 0,
      humanClicks: 0,
      redirects: 0,
      directRedirects: 0,
      botHits: 0,
      prefetchHits: 0
    },
    timeseries: {
      hours: [],
      days: [],
      months: []
    },
    worldMap: [],
    topCities: [],
    topRegions: [],
    topDays,
    popularHours,
    clickType: [
      { label: "Visits (human)", clicks: 0 },
      { label: "Landing Views", clicks: 0 },
      { label: "Human Clicks", clicks: 0 },
      { label: "Redirects (human)", clicks: 0 },
      { label: "Redirects (legacy)", clicks: 0 },
      { label: "Bots", clicks: 0 },
      { label: "Prefetch", clicks: 0 }
    ],
    topSocialPlatforms: [],
    topSources: [],
    topBrowsers: [],
    topDevices: [],
    topLanguages: [],
    topPlatforms: []
  };
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
  id?: string | null;
  link_id?: string | null;
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
const ADMIN_SETTINGS_CACHE_TTL_MS = 60_000;
const GLOBAL_ANALYTICS_CACHE_TTL_MS = 30_000;
const LINK_LIST_STATS_CACHE_TTL_MS = 30_000;
const LINK_ANALYTICS_CACHE_TTL_MS = 30_000;
const DEFAULT_ANALYTICS_TIME_ZONE = "Europe/Paris";
const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = "today";
const GLOBAL_ANALYTICS_BATCH_SIZE = 1000;
const CLICK_EVENTS_SCAN_BATCH_SIZE = 1000;
const LINK_LIST_STATS_QUERY_TIMEOUT_MS = 10_000;
const LINK_ANALYTICS_QUERY_TIMEOUT_MS = 7_000;
const LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS = 1_500;
const VERIFIED_REDIRECT_PATHS = ["direct", "landing_continue"] as const;
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

let cachedRuntimeAdminSettings:
  | {
      trackingEnabled: boolean;
      landingEnabled: boolean;
      globalBackgroundUrl: string | null;
      limitBehavior: TrackingLimitBehavior;
      expiresAt: number;
    }
  | null = null;
let cachedRuntimeGlobalAnalytics:
  | {
      data: GlobalAnalyticsData;
      expiresAt: number;
      timeZone: string;
      range: AnalyticsRange;
    }
  | null = null;
const cachedRuntimeLinkListStats = new Map<
  string,
  {
    clicksReceived: number;
    clicksToday: number;
    expiresAt: number;
  }
>();
const cachedRuntimeLinkAnalytics = new Map<
  string,
  {
    data: LinkAnalyticsData;
    expiresAt: number;
  }
>();

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSafePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized >= 1 ? normalized : fallback;
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

function isHumanRedirectTrafficCategory(category: TrafficCategory): boolean {
  return category !== "bot" && category !== "prefetch";
}

function isHumanRedirectEvent(
  eventType: TrackingEventType,
  trafficCategory: TrafficCategory,
  requestMethod: string
): boolean {
  return eventType === "redirect" && requestMethod === "GET" && isHumanRedirectTrafficCategory(trafficCategory);
}

function getRedirectPath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).redirect_path;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isVerifiedHumanRedirectRow(
  eventType: TrackingEventType,
  trafficCategory: TrafficCategory,
  requestMethod: string,
  metadata: unknown
): boolean {
  if (eventType !== "redirect" || requestMethod !== "GET" || trafficCategory !== "human") {
    return false;
  }
  const redirectPath = getRedirectPath(metadata);
  return redirectPath === "direct" || redirectPath === "landing_continue";
}

function createEmptyLinkRedirectSummary(): LinkRedirectSummary {
  return {
    clicksReceived: 0,
    clicksToday: 0
  };
}

function createUniqueLinkIdList(linkIds: string[]): string[] {
  const uniqueLinkIds = new Set<string>();

  for (const linkId of linkIds) {
    if (typeof linkId !== "string") {
      continue;
    }

    const normalizedLinkId = linkId.trim();
    if (normalizedLinkId.length === 0) {
      continue;
    }

    uniqueLinkIds.add(normalizedLinkId);
  }

  return Array.from(uniqueLinkIds);
}

async function getLinkRedirectSummariesViaRpc(
  linkIds: string[],
  timeZone: string
): Promise<Record<string, LinkRedirectSummary>> {
  const rows = await withTimeout(
    runRpcList<LinkRedirectSummaryRpcRow>("get_links_redirect_summaries_batch", {
      p_link_ids: linkIds,
      p_time_zone: timeZone
    }),
    LINK_LIST_STATS_QUERY_TIMEOUT_MS,
    `get_links_redirect_summaries_batch(${linkIds.length})`
  );

  const output = Object.fromEntries(
    linkIds.map((linkId) => [linkId, createEmptyLinkRedirectSummary()])
  ) as Record<string, LinkRedirectSummary>;

  for (const row of rows) {
    const linkId = toStringOrNull(row.link_id);
    if (!linkId || !output[linkId]) {
      continue;
    }

    output[linkId] = {
      clicksReceived: toNumber(row.clicks_received),
      clicksToday: toNumber(row.clicks_today)
    };
  }

  return output;
}

async function getLinkAnalyticsDataFromEvents(linkId: string, timeZone: string): Promise<LinkAnalyticsData> {
  const nowMs = Date.now();
  const dayKeyFormatter = createDayKeyFormatter(timeZone);
  const todayKey = toDayKey(nowMs, dayKeyFormatter);
  const utcHourEnd = startOfUtcHour(nowMs);
  const utcHourStart = utcHourEnd - 23 * HOUR_MS;
  const utcDayEnd = startOfUtcDay(nowMs);
  const utcDayStart = utcDayEnd - 29 * DAY_MS;
  const utcMonthEnd = startOfUtcMonth(nowMs);
  const utcMonthStartDate = new Date(utcMonthEnd);
  utcMonthStartDate.setUTCMonth(utcMonthStartDate.getUTCMonth() - 11);
  const utcMonthStart = utcMonthStartDate.getTime();
  const monthPoints = 12;

  let redirects = 0;
  let legacyRedirects = 0;
  let visits = 0;
  let humanVisits = 0;
  let landingViews = 0;
  let humanClicks = 0;
  let directRedirects = 0;
  let botHits = 0;
  let prefetchHits = 0;
  let clicksToday = 0;
  let uniqueClicks = 0;
  let nonUniqueClicks = 0;

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

  await scanClickEvents<ClickEventStatRow>({
    select:
      "created_at, country, region, city, source, browser, device, language, platform, is_unique, event_type, traffic_category, request_method, is_bot, is_prefetch, metadata",
    applyFilters: (query) => query.eq("link_id", linkId),
    onBatch: (rows) => {
      for (const row of rows) {
        const eventType = normalizeTrackingEventType(row.event_type);
        const trafficCategory = normalizeTrafficCategory(row.traffic_category, Boolean(row.is_bot), Boolean(row.is_prefetch));
        const requestMethod = toString(row.request_method || "GET").trim().toUpperCase() || "GET";

        if (eventType === "visit") {
          visits += 1;
          if (isHumanRedirectTrafficCategory(trafficCategory)) {
            humanVisits += 1;
          }
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

        const isVerifiedHumanRedirect = isVerifiedHumanRedirectRow(eventType, trafficCategory, requestMethod, row.metadata);
        const isLegacyHumanRedirect =
          isHumanRedirectEvent(eventType, trafficCategory, requestMethod) &&
          !isVerifiedHumanRedirect;

        if (isLegacyHumanRedirect) {
          legacyRedirects += 1;
        }

        if (!isVerifiedHumanRedirect) {
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
        if (Number.isNaN(eventAt)) {
          continue;
        }

        if (toDayKey(eventAt, dayKeyFormatter) === todayKey) {
          clicksToday += 1;
        }

        const zonedParts = getZonedDateTimeParts(eventAt, timeZone);
        dayBreakdown[zonedParts.weekday] += 1;
        hourBreakdown[zonedParts.hour] += 1;

        const hourBucket = startOfUtcHour(eventAt);
        if (hourBucket >= utcHourStart && hourBucket <= utcHourEnd) {
          incrementNumericCounter(hourSeriesCounter, hourBucket);
        }

        const dayBucket = startOfUtcDay(eventAt);
        if (dayBucket >= utcDayStart && dayBucket <= utcDayEnd) {
          incrementNumericCounter(daySeriesCounter, dayBucket);
        }

        const monthBucket = Date.UTC(zonedParts.year, zonedParts.month - 1, 1);
        if (monthBucket >= utcMonthStart && monthBucket <= utcMonthEnd) {
          incrementNumericCounter(monthSeriesCounter, monthBucket);
        }
      }
    }
  });

  const overview: LinkOverviewStats = {
    totalClicks: redirects,
    qrScans: 0,
    clicksToday,
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
    timeseries: {
      hours: buildHoursSeries(hourSeriesCounter, utcHourStart, utcHourEnd),
      days: buildDaysSeries(daySeriesCounter, utcDayStart, utcDayEnd),
      months: buildMonthsSeries(monthSeriesCounter, utcMonthStart, monthPoints)
    },
    worldMap: toSortedLabelCounts(countriesCounter, 12),
    topCities: toSortedLabelCounts(citiesCounter, 8),
    topRegions: toSortedLabelCounts(regionsCounter, 8),
    topDays: DAY_LABELS.map((label, index) => ({ label, clicks: dayBreakdown[index] ?? 0 })),
    popularHours: hourBreakdown.map((clicks, hour) => ({ label: `${formatTwoDigits(hour)}:00`, clicks })),
    clickType: [
      { label: "Visits (human)", clicks: humanVisits },
      { label: "Landing Views", clicks: landingViews },
      { label: "Human Clicks", clicks: humanClicks },
      { label: "Redirects (human)", clicks: redirects },
      { label: "Redirects (legacy)", clicks: legacyRedirects },
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

export async function getCurrentMonthClicks(): Promise<number> {
  const rows = await runRpcList<{ total_clicks: number }>("current_month_clicks");
  return toNumber(rows[0]?.total_clicks);
}

export async function getAdminSettings(options?: GetAdminSettingsOptions): Promise<AdminSettings> {
  const includeUsage = options?.includeUsage ?? false;
  const nowMs = Date.now();

  if (!includeUsage && cachedRuntimeAdminSettings && cachedRuntimeAdminSettings.expiresAt > nowMs) {
    return {
      plan: "pro",
      clickLimitMonthly: Number.MAX_SAFE_INTEGER,
      trackingEnabled: cachedRuntimeAdminSettings.trackingEnabled,
      landingEnabled: cachedRuntimeAdminSettings.landingEnabled,
      globalBackgroundUrl: cachedRuntimeAdminSettings.globalBackgroundUrl,
      limitBehavior: cachedRuntimeAdminSettings.limitBehavior,
      usageThisMonth: 0,
      limitReached: false
    };
  }

  let row: SettingsRow | undefined;
  try {
    const rows = await runRpcList<SettingsRow>("get_admin_settings");
    row = rows[0];
  } catch {
    row = undefined;
  }

  const trackingEnabled = row?.tracking_enabled ?? env.TRACKING_ENABLED_DEFAULT;
  const landingEnabled = row?.landing_enabled ?? false;
  const globalBackgroundUrl = toStringOrNull(row?.global_background_url);
  const limitBehavior = normalizeLimitBehavior(row?.limit_behavior);

  if (!includeUsage) {
    cachedRuntimeAdminSettings = {
      trackingEnabled,
      landingEnabled,
      globalBackgroundUrl,
      limitBehavior,
      expiresAt: nowMs + ADMIN_SETTINGS_CACHE_TTL_MS
    };
  }

  const usageThisMonth = includeUsage ? await getCurrentMonthClicks().catch(() => 0) : 0;

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

function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function resolveAnalyticsTimeZone(timeZone?: string): string {
  const normalized = toString(timeZone).trim();
  if (normalized.length > 0 && isValidIanaTimeZone(normalized)) {
    return normalized;
  }
  return DEFAULT_ANALYTICS_TIME_ZONE;
}

function createDayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function toDayKey(epochMs: number, formatter: Intl.DateTimeFormat): string {
  return formatter.format(new Date(epochMs));
}

interface AnalyticsWindow {
  range: AnalyticsRange;
  timeZone: string;
  startAtMs: number;
  endAtMs: number;
}

function normalizeAnalyticsRange(value: string | null | undefined): AnalyticsRange {
  if (value === "today" || value === "this_week" || value === "last_week" || value === "this_month") {
    return value;
  }
  return DEFAULT_ANALYTICS_RANGE;
}

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const zonedDateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getZonedDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zonedDateTimeFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short"
  });
  zonedDateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getZonedDateTimeParts(epochMs: number, timeZone: string): ZonedDateTimeParts {
  const parts = getZonedDateTimeFormatter(timeZone).formatToParts(new Date(epochMs));

  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let weekday = 0;

  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    if (part.type === "month") month = Number(part.value);
    if (part.type === "day") day = Number(part.value);
    if (part.type === "hour") hour = Number(part.value);
    if (part.type === "minute") minute = Number(part.value);
    if (part.type === "second") second = Number(part.value);
    if (part.type === "weekday") {
      const short = part.value.slice(0, 3).toLowerCase();
      if (short === "sun") weekday = 0;
      if (short === "mon") weekday = 1;
      if (short === "tue") weekday = 2;
      if (short === "wed") weekday = 3;
      if (short === "thu") weekday = 4;
      if (short === "fri") weekday = 5;
      if (short === "sat") weekday = 6;
    }
  }

  return { year, month, day, hour, minute, second, weekday };
}

function getTimeZoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = getZonedDateTimeParts(epochMs, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - epochMs;
}

function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMs(guess, timeZone);
    const next = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
    if (Math.abs(next - guess) < 1000) {
      return next;
    }
    guess = next;
  }
  return guess;
}

function getAnalyticsWindow(range: AnalyticsRange, timeZone: string, nowMs = Date.now()): AnalyticsWindow {
  const nowParts = getZonedDateTimeParts(nowMs, timeZone);
  const currentCivilDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 0, 0, 0));
  const tomorrowCivilDate = new Date(currentCivilDate.getTime());
  tomorrowCivilDate.setUTCDate(tomorrowCivilDate.getUTCDate() + 1);

  const todayStartMs = zonedDateTimeToUtcMs(
    currentCivilDate.getUTCFullYear(),
    currentCivilDate.getUTCMonth() + 1,
    currentCivilDate.getUTCDate(),
    0,
    0,
    0,
    timeZone
  );
  const tomorrowStartMs = zonedDateTimeToUtcMs(
    tomorrowCivilDate.getUTCFullYear(),
    tomorrowCivilDate.getUTCMonth() + 1,
    tomorrowCivilDate.getUTCDate(),
    0,
    0,
    0,
    timeZone
  );

  if (range === "today") {
    return {
      range,
      timeZone,
      startAtMs: todayStartMs,
      endAtMs: Math.min(nowMs, tomorrowStartMs)
    };
  }

  const mondayOffset = (nowParts.weekday + 6) % 7;
  const weekStartCivilDate = new Date(currentCivilDate.getTime());
  weekStartCivilDate.setUTCDate(weekStartCivilDate.getUTCDate() - mondayOffset);
  const weekStartMs = zonedDateTimeToUtcMs(
    weekStartCivilDate.getUTCFullYear(),
    weekStartCivilDate.getUTCMonth() + 1,
    weekStartCivilDate.getUTCDate(),
    0,
    0,
    0,
    timeZone
  );

  if (range === "this_week") {
    return {
      range,
      timeZone,
      startAtMs: weekStartMs,
      endAtMs: Math.min(nowMs, tomorrowStartMs)
    };
  }

  if (range === "last_week") {
    const lastWeekStartCivilDate = new Date(weekStartCivilDate.getTime());
    lastWeekStartCivilDate.setUTCDate(lastWeekStartCivilDate.getUTCDate() - 7);
    const lastWeekStartMs = zonedDateTimeToUtcMs(
      lastWeekStartCivilDate.getUTCFullYear(),
      lastWeekStartCivilDate.getUTCMonth() + 1,
      lastWeekStartCivilDate.getUTCDate(),
      0,
      0,
      0,
      timeZone
    );
    return {
      range,
      timeZone,
      startAtMs: lastWeekStartMs,
      endAtMs: weekStartMs
    };
  }

  const monthStartCivilDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, 1, 0, 0, 0));
  const monthStartMs = zonedDateTimeToUtcMs(
    monthStartCivilDate.getUTCFullYear(),
    monthStartCivilDate.getUTCMonth() + 1,
    monthStartCivilDate.getUTCDate(),
    0,
    0,
    0,
    timeZone
  );

  return {
    range,
    timeZone,
    startAtMs: monthStartMs,
    endAtMs: Math.min(nowMs, tomorrowStartMs)
  };
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function safeTimed<T>(label: string, operation: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  try {
    return await withTimeout(operation, timeoutMs, label);
  } catch (error) {
    console.error(`${label} fallback`, error);
    return fallback;
  }
}

async function exactCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string): Promise<number> {
  const result = await query;
  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  return toNumber(result.count ?? 0);
}

async function countWithFallback(
  label: string,
  buildQuery: (countMode: "exact" | "planned") => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  timeoutMs: number,
  options?: {
    usePlannedFallback?: boolean;
  }
): Promise<number> {
  try {
    return await withTimeout(exactCount(buildQuery("exact"), label), timeoutMs, label);
  } catch (error) {
    console.error(`${label} fallback`, error);
    if (!options?.usePlannedFallback) {
      return 0;
    }
  }

  try {
    return await exactCount(buildQuery("planned"), `${label}(planned)`);
  } catch (error) {
    console.error(`${label}(planned) fallback`, error);
    return 0;
  }
}

function createVerifiedHumanRedirectCountQuery(
  linkId: string,
  redirectPath: (typeof VERIFIED_REDIRECT_PATHS)[number],
  countMode: "exact" | "planned" = "exact"
) {
  return getSupabaseAdminClient()
    .from("click_events")
    .select("id", { head: true, count: countMode })
    .eq("link_id", linkId)
    .eq("event_type", "redirect")
    .eq("request_method", "GET")
    .eq("traffic_category", "human")
    .contains("metadata", {
      redirect_path: redirectPath
    });
}

function createRedirectCandidateCountQuery(linkId: string, countMode: "exact" | "planned" = "exact") {
  return getSupabaseAdminClient()
    .from("click_events")
    .select("id", { head: true, count: countMode })
    .eq("link_id", linkId)
    .eq("event_type", "redirect")
    .eq("request_method", "GET")
    .or("traffic_category.eq.human,traffic_category.eq.unknown,traffic_category.is.null");
}

function createHumanVisitCountQuery(linkId: string, countMode: "exact" | "planned" = "exact") {
  return getSupabaseAdminClient()
    .from("click_events")
    .select("id", { head: true, count: countMode })
    .eq("link_id", linkId)
    .eq("event_type", "visit")
    .or("traffic_category.eq.human,traffic_category.eq.unknown,traffic_category.is.null");
}

function createTrafficCategoryCountQuery(
  linkId: string,
  trafficCategory: "bot" | "prefetch",
  countMode: "exact" | "planned" = "exact"
) {
  return getSupabaseAdminClient()
    .from("click_events")
    .select("id", { head: true, count: countMode })
    .eq("link_id", linkId)
    .eq("traffic_category", trafficCategory);
}

function createEventTypeCountQuery(
  linkId: string,
  eventType: "visit" | "landing_view" | "human_click",
  countMode: "exact" | "planned" = "exact"
) {
  return getSupabaseAdminClient()
    .from("click_events")
    .select("id", { head: true, count: countMode })
    .eq("link_id", linkId)
    .eq("event_type", eventType);
}

export async function getLinksRedirectSummariesBatch(
  linkIds: string[],
  timeZone?: string
): Promise<LinkRedirectSummariesResult> {
  const resolvedTimeZone = resolveAnalyticsTimeZone(timeZone);
  const uniqueLinkIds = createUniqueLinkIdList(linkIds);
  const output: Record<string, LinkRedirectSummary> = {};
  const startedAt = Date.now();
  const nowMs = Date.now();

  if (uniqueLinkIds.length === 0) {
    return {
      stats: output,
      fallback: false
    };
  }

  const uncachedLinkIds: string[] = [];

  for (const linkId of uniqueLinkIds) {
    const cached = cachedRuntimeLinkListStats.get(`${linkId}:${resolvedTimeZone}`);
    if (cached && cached.expiresAt > nowMs) {
      output[linkId] = {
        clicksReceived: cached.clicksReceived,
        clicksToday: cached.clicksToday
      };
      continue;
    }

    uncachedLinkIds.push(linkId);
  }

  try {
    if (uncachedLinkIds.length > 0) {
      const fetchedStats = await getLinkRedirectSummariesViaRpc(uncachedLinkIds, resolvedTimeZone);

      for (const linkId of uncachedLinkIds) {
        const stats = fetchedStats[linkId] ?? createEmptyLinkRedirectSummary();
        output[linkId] = stats;
        cachedRuntimeLinkListStats.set(`${linkId}:${resolvedTimeZone}`, {
          clicksReceived: stats.clicksReceived,
          clicksToday: stats.clicksToday,
          expiresAt: nowMs + LINK_LIST_STATS_CACHE_TTL_MS
        });
      }
    }
  } catch (error) {
    console.error("getLinksRedirectSummariesBatch failed", {
      linksCount: uniqueLinkIds.length,
      queriedCount: uncachedLinkIds.length,
      timeZone: resolvedTimeZone,
      durationMs: Date.now() - startedAt,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }

  for (const linkId of uniqueLinkIds) {
    output[linkId] ??= createEmptyLinkRedirectSummary();
  }

  console.info("getLinksRedirectSummariesBatch resolved", {
    linksCount: uniqueLinkIds.length,
    queriedCount: uncachedLinkIds.length,
    timeZone: resolvedTimeZone,
    durationMs: Date.now() - startedAt,
    fallbackUsed: false
  });

  return {
    stats: output,
    fallback: false
  };
}

export async function getLinksRedirectSummaries(
  linkIds: string[],
  timeZone?: string
): Promise<Record<string, LinkRedirectSummary>> {
  const result = await getLinksRedirectSummariesBatch(linkIds, timeZone);
  return result.stats;
}

function sumCurrentDayClicks(points: TimeSeriesPoint[], timeZone: string): number {
  const formatter = createDayKeyFormatter(timeZone);
  const today = toDayKey(Date.now(), formatter);
  return points.reduce((total, point) => {
    const bucketMs = Date.parse(point.bucketAt);
    if (Number.isNaN(bucketMs)) return total;
    return toDayKey(bucketMs, formatter) === today ? total + toNumber(point.clicks) : total;
  }, 0);
}

async function scanClickEvents<T extends ClickEventStatRow>(options: {
  select: string;
  applyFilters?: (query: any) => any;
  batchSize?: number;
  onBatch: (rows: T[]) => void | Promise<void>;
}): Promise<void> {
  const batchSize = Math.max(1, Math.min(CLICK_EVENTS_SCAN_BATCH_SIZE, options.batchSize ?? CLICK_EVENTS_SCAN_BATCH_SIZE));
  let cursorCreatedAt: string | null = null;

  while (true) {
    let query = getSupabaseAdminClient().from("click_events").select(options.select).order("created_at", { ascending: false }).limit(batchSize);
    if (options.applyFilters) {
      query = options.applyFilters(query);
    }
    if (cursorCreatedAt) {
      query = query.lt("created_at", cursorCreatedAt);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`scanClickEvents failed: ${error.message}`);
    }

    const rows = ((data ?? []) as unknown) as T[];
    if (rows.length === 0) {
      break;
    }

    await options.onBatch(rows);

    if (rows.length < batchSize) {
      break;
    }

    const nextCursorCreatedAt = toStringOrNull(rows[rows.length - 1]?.created_at);
    if (!nextCursorCreatedAt || nextCursorCreatedAt === cursorCreatedAt) {
      break;
    }

    cursorCreatedAt = nextCursorCreatedAt;
  }
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

async function aggregateGlobalAnalytics(window: AnalyticsWindow): Promise<AggregatedGlobalAnalyticsData> {
  const safeBatchSize = GLOBAL_ANALYTICS_BATCH_SIZE;
  const startAtMs = window.startAtMs;
  const endAtMs = window.endAtMs;

  const utcHourEnd = startOfUtcHour(Math.max(startAtMs, endAtMs - 1));
  const utcHourStart = Math.max(startOfUtcHour(startAtMs), utcHourEnd - 23 * HOUR_MS);
  const utcDayStart = startOfUtcDay(startAtMs);
  const utcDayEnd = startOfUtcDay(Math.max(startAtMs, endAtMs - 1));
  const utcMonthStart = startOfUtcMonth(startAtMs);
  const endMonthStart = startOfUtcMonth(Math.max(startAtMs, endAtMs - 1));
  const utcMonthEnd = endMonthStart;
  const monthDiff =
    (new Date(endMonthStart).getUTCFullYear() - new Date(utcMonthStart).getUTCFullYear()) * 12 +
    (new Date(endMonthStart).getUTCMonth() - new Date(utcMonthStart).getUTCMonth());
  const monthPoints = Math.max(1, monthDiff + 1);

  let redirects = 0;
  let redirectCandidates = 0;
  let visits = 0;
  let humanVisits = 0;
  let landingViews = 0;
  let humanClicks = 0;
  let directRedirects = 0;
  let botHits = 0;
  let prefetchHits = 0;
  let clicksToday = 0;
  let clicksLast7Days = 0;
  let uniqueClicks = 0;
  let nonUniqueClicks = 0;

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
  await scanClickEvents<ClickEventStatRow>({
    select:
      "slug, created_at, country, region, city, source, browser, device, language, platform, is_unique, event_type, traffic_category, request_method, is_bot, is_prefetch, metadata",
    batchSize: safeBatchSize,
    applyFilters: (query) => query.gte("created_at", new Date(startAtMs).toISOString()).lt("created_at", new Date(endAtMs).toISOString()),
    onBatch: (rows) => {
      for (const row of rows) {
        const eventType = normalizeTrackingEventType(row.event_type);
        const trafficCategory = normalizeTrafficCategory(row.traffic_category, Boolean(row.is_bot), Boolean(row.is_prefetch));
        const requestMethod = toString(row.request_method || "GET").trim().toUpperCase() || "GET";

        if (eventType === "visit") {
          visits += 1;
          if (isHumanRedirectTrafficCategory(trafficCategory)) {
            humanVisits += 1;
          }
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

        if (isHumanRedirectEvent(eventType, trafficCategory, requestMethod)) {
          redirectCandidates += 1;
        }

        const isHumanRedirect = isVerifiedHumanRedirectRow(eventType, trafficCategory, requestMethod, row.metadata);
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
          const zonedParts = getZonedDateTimeParts(eventAt, window.timeZone);
          dayBreakdown[zonedParts.weekday] += 1;
          hourBreakdown[zonedParts.hour] += 1;

          const hourBucket = startOfUtcHour(eventAt);
          if (hourBucket >= utcHourStart && hourBucket <= utcHourEnd) {
            incrementNumericCounter(hourSeriesCounter, hourBucket);
          }

          const dayBucket = startOfUtcDay(eventAt);
          if (dayBucket >= utcDayStart && dayBucket <= utcDayEnd) {
            incrementNumericCounter(daySeriesCounter, dayBucket);
          }

          const monthBucket = Date.UTC(zonedParts.year, zonedParts.month - 1, 1);
          if (monthBucket >= utcMonthStart && monthBucket <= utcMonthEnd) {
            incrementNumericCounter(monthSeriesCounter, monthBucket);
          }
        }
      }
    }
  });

  const topDays: LabelCount[] = DAY_LABELS.map((label, index) => ({
    label,
    clicks: dayBreakdown[index] ?? 0
  }));

  const popularHours: LabelCount[] = hourBreakdown.map((clicks, index) => ({
    label: `${formatTwoDigits(index)}:00`,
    clicks
  }));

  clicksToday = redirects;
  clicksLast7Days = redirects;
  const legacyRedirects = Math.max(0, redirectCandidates - redirects);

  const overview: LinkOverviewStats = {
    totalClicks: redirects,
    qrScans: 0,
    clicksToday,
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
      months: buildMonthsSeries(monthSeriesCounter, utcMonthStart, monthPoints)
    },
    worldMap: toSortedLabelCounts(countriesCounter, 12),
    topCities: toSortedLabelCounts(citiesCounter, 8),
    topRegions: toSortedLabelCounts(regionsCounter, 8),
    topDays,
    popularHours,
    clickType: [
      { label: "Visits (human)", clicks: humanVisits },
      { label: "Landing Views", clicks: landingViews },
      { label: "Human Clicks", clicks: humanClicks },
      { label: "Redirects (human)", clicks: redirects },
      { label: "Redirects (legacy)", clicks: legacyRedirects },
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

export async function getGlobalAnalyticsData(options?: {
  timeZone?: string;
  range?: string | null;
}): Promise<GlobalAnalyticsData> {
  const nowMs = Date.now();
  const resolvedTimeZone = resolveAnalyticsTimeZone(options?.timeZone);
  const resolvedRange = normalizeAnalyticsRange(options?.range);
  if (
    cachedRuntimeGlobalAnalytics &&
    cachedRuntimeGlobalAnalytics.expiresAt > nowMs &&
    cachedRuntimeGlobalAnalytics.timeZone === resolvedTimeZone &&
    cachedRuntimeGlobalAnalytics.range === resolvedRange
  ) {
    return cachedRuntimeGlobalAnalytics.data;
  }

  const startedAt = Date.now();
  try {
    const window = getAnalyticsWindow(resolvedRange, resolvedTimeZone, nowMs);
    const [{ count, error }, aggregated] = await Promise.all([
      getSupabaseAdminClient().from("short_links").select("id", { head: true, count: "exact" }).eq("is_active", true),
      aggregateGlobalAnalytics(window)
    ]);

    if (error) {
      throw new Error(`getGlobalAnalyticsData total links failed: ${error.message}`);
    }

    const data: GlobalAnalyticsData = {
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

    cachedRuntimeGlobalAnalytics = {
      data,
      expiresAt: Date.now() + GLOBAL_ANALYTICS_CACHE_TTL_MS,
      timeZone: resolvedTimeZone,
      range: resolvedRange
    };

    console.info("getGlobalAnalyticsData resolved", {
      durationMs: Date.now() - startedAt,
      range: resolvedRange,
      timeZone: resolvedTimeZone,
      linksCount: data.totalLinks,
      fallbackUsed: false
    });

    return data;
  } catch (error) {
    console.error("getGlobalAnalyticsData failed", {
      durationMs: Date.now() - startedAt,
      range: resolvedRange,
      timeZone: resolvedTimeZone,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
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

function mapShortLinkListItem(
  row: ShortLinkListBaseRow & Partial<Pick<ShortLinkListRow, "clicks_received" | "clicks_today">>
): ShortLinkListItem {
  return {
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
    clicksToday: toNumber(row.clicks_today)
  };
}

// Intentionally lightweight; admin surfaces should prefer listShortLinksWithStats.
export async function listShortLinksPage(page = 1, pageSize = 20): Promise<PaginatedShortLinks> {
  const safePage = toSafePositiveInt(page, 1);
  const safeSize = Math.min(100, toSafePositiveInt(pageSize, 20));
  const offset = (safePage - 1) * safeSize;

  const [{ data, error }, totalResult] = await Promise.all([
    getSupabaseAdminClient()
      .from("short_links")
      .select("id, slug, destination_url, created_at, is_favorite, tags, redirect_type")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + safeSize - 1),
    getSupabaseAdminClient().from("short_links").select("id", { head: true, count: "exact" }).eq("is_active", true)
  ]);

  if (error) {
    throw new Error(`listShortLinksPage failed: ${error.message}`);
  }

  const rows = (data ?? []) as ShortLinkListBaseRow[];
  const total = totalResult.error ? Math.max(offset + rows.length, rows.length) : toNumber(totalResult.count ?? 0);

  return {
    items: rows.map((row) =>
      mapShortLinkListItem({
        ...row,
        clicks_received: 0,
        clicks_today: 0
      })
    ),
    page: safePage,
    pageSize: safeSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeSize))
  };
}

async function listShortLinksWithoutRpc(
  safePage: number,
  safeSize: number,
  knownTotal: number | null,
  timeZone: string
): Promise<PaginatedShortLinks> {
  const offset = (safePage - 1) * safeSize;
  const { data, error } = await getSupabaseAdminClient()
    .from("short_links")
    .select("id, slug, destination_url, created_at, is_favorite, tags, redirect_type")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + safeSize - 1);

  if (error) {
    throw new Error(`listShortLinksWithStats fallback failed: ${error.message}`);
  }

  const rows = (data ?? []) as ShortLinkListBaseRow[];
  const { stats: statsByLinkId } = await getLinksRedirectSummariesBatch(
    rows.map((row) => row.id),
    timeZone
  );

  let safeTotal = knownTotal;
  if (safeTotal === null) {
    const { count, error: countError } = await getSupabaseAdminClient()
      .from("short_links")
      .select("id", { head: true, count: "exact" })
      .eq("is_active", true);
    if (countError) {
      console.error("listShortLinksWithStats fallback count failed", countError);
      safeTotal = Math.max(offset + rows.length, rows.length);
    } else {
      safeTotal = toNumber(count ?? 0);
    }
  }

  const items = rows.map((row) =>
    mapShortLinkListItem({
      ...row,
      clicks_received: statsByLinkId[row.id]?.clicksReceived ?? 0,
      clicks_today: statsByLinkId[row.id]?.clicksToday ?? 0
    })
  );
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize));

  return {
    items,
    page: safePage,
    pageSize: safeSize,
    total: safeTotal,
    totalPages
  };
}

export async function listShortLinksWithStats(page = 1, pageSize = 20, timeZone?: string): Promise<PaginatedShortLinks> {
  const safePage = toSafePositiveInt(page, 1);
  const safeSize = Math.min(100, toSafePositiveInt(pageSize, 20));
  const resolvedTimeZone = resolveAnalyticsTimeZone(timeZone);
  const totalPromise = getSupabaseAdminClient().from("short_links").select("id", { head: true, count: "exact" }).eq("is_active", true);
  const { count, error: totalError } = await totalPromise;
  return listShortLinksWithoutRpc(safePage, safeSize, totalError ? null : toNumber(count ?? 0), resolvedTimeZone);
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

export type TruncatableTable = "logs" | "click_events";

export async function truncateTrackingTable(table: TruncatableTable): Promise<number> {
  const { error, count } = await getSupabaseAdminClient()
    .from(table)
    .delete({ count: "exact" })
    .gte("created_at", "1970-01-01");
  if (error) {
    throw new Error(`truncate ${table} failed: ${error.message}`);
  }
  return count ?? 0;
}

export async function getLinkOverview(linkId: string): Promise<LinkOverviewStats> {
  const rows = await runRpcList<OverviewRow>("get_link_overview", { p_link_id: linkId });
  const row = rows[0];
  return {
    totalClicks: toNumber(row?.total_clicks),
    qrScans: toNumber(row?.qr_scans),
    clicksToday: toNumber(row?.clicks_today),
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

function createEmptyLinkTimeSeries(granularity: "hours" | "days" | "months", points: number): TimeSeriesPoint[] {
  const safePoints = Math.max(1, Math.floor(points));
  if (granularity === "hours") {
    const end = startOfUtcHour(Date.now());
    const start = end - (safePoints - 1) * HOUR_MS;
    return buildHoursSeries(new Map<number, number>(), start, end);
  }
  if (granularity === "months") {
    const end = startOfUtcMonth(Date.now());
    const startDate = new Date(end);
    startDate.setUTCMonth(startDate.getUTCMonth() - (safePoints - 1));
    return buildMonthsSeries(new Map<number, number>(), startDate.getTime(), safePoints);
  }
  const end = startOfUtcDay(Date.now());
  const start = end - (safePoints - 1) * DAY_MS;
  return buildDaysSeries(new Map<number, number>(), start, end);
}

export function createEmptyLinkAnalyticsData(): LinkAnalyticsData {
  return {
    overview: {
      totalClicks: 0,
      qrScans: 0,
      clicksToday: 0,
      uniqueClicks: 0,
      nonUniqueClicks: 0,
      visits: 0,
      landingViews: 0,
      humanClicks: 0,
      redirects: 0,
      directRedirects: 0,
      botHits: 0,
      prefetchHits: 0
    },
    timeseries: {
      hours: createEmptyLinkTimeSeries("hours", 24),
      days: createEmptyLinkTimeSeries("days", 30),
      months: createEmptyLinkTimeSeries("months", 12)
    },
    worldMap: [],
    topCities: [],
    topRegions: [],
    topDays: DAY_LABELS.map((label) => ({ label, clicks: 0 })),
    popularHours: Array.from({ length: 24 }, (_, hour) => ({ label: `${formatTwoDigits(hour)}:00`, clicks: 0 })),
    clickType: [
      { label: "Visits (human)", clicks: 0 },
      { label: "Landing Views", clicks: 0 },
      { label: "Human Clicks", clicks: 0 },
      { label: "Redirects (human)", clicks: 0 },
      { label: "Redirects (legacy)", clicks: 0 },
      { label: "Bots", clicks: 0 },
      { label: "Prefetch", clicks: 0 }
    ],
    topSocialPlatforms: [],
    topSources: [],
    topBrowsers: [],
    topDevices: [],
    topLanguages: [],
    topPlatforms: []
  };
}

async function getLinkOverviewViaQueries(linkId: string, timeZone: string): Promise<LinkOverviewStats> {
  const todayStartIso = new Date(getAnalyticsWindow("today", timeZone).startAtMs).toISOString();

  const redirectCandidatesPromise = countWithFallback(
    "count_redirect_candidates",
    (countMode) => createRedirectCandidateCountQuery(linkId, countMode),
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const directRedirectsPromise = safeTimed(
    "count_direct_redirects",
    exactCount(createVerifiedHumanRedirectCountQuery(linkId, "direct"), "count_direct_redirects"),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const landingContinueRedirectsPromise = safeTimed(
    "count_landing_continue_redirects",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "landing_continue"),
      "count_landing_continue_redirects"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const directClicksTodayPromise = safeTimed(
    "count_direct_redirects_today",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "direct").gte("created_at", todayStartIso),
      "count_direct_redirects_today"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const landingContinueClicksTodayPromise = safeTimed(
    "count_landing_continue_redirects_today",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "landing_continue").gte("created_at", todayStartIso),
      "count_landing_continue_redirects_today"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const directUniqueClicksPromise = safeTimed(
    "count_direct_unique_redirects",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "direct").eq("is_unique", true),
      "count_direct_unique_redirects"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const landingContinueUniqueClicksPromise = safeTimed(
    "count_landing_continue_unique_redirects",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "landing_continue").eq("is_unique", true),
      "count_landing_continue_unique_redirects"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const directNonUniqueClicksPromise = safeTimed(
    "count_direct_non_unique_redirects",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "direct").eq("is_unique", false),
      "count_direct_non_unique_redirects"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const landingContinueNonUniqueClicksPromise = safeTimed(
    "count_landing_continue_non_unique_redirects",
    exactCount(
      createVerifiedHumanRedirectCountQuery(linkId, "landing_continue").eq("is_unique", false),
      "count_landing_continue_non_unique_redirects"
    ),
    0,
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );
  const visitsPromise = countWithFallback(
    "count_visits",
    (countMode) => createEventTypeCountQuery(linkId, "visit", countMode),
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS,
    { usePlannedFallback: true }
  );
  const landingViewsPromise = safeTimed(
    "count_landing_views",
    exactCount(createEventTypeCountQuery(linkId, "landing_view"), "count_landing_views"),
    0,
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS
  );
  const humanClicksPromise = safeTimed(
    "count_human_clicks",
    exactCount(createEventTypeCountQuery(linkId, "human_click"), "count_human_clicks"),
    0,
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS
  );
  const botHitsPromise = safeTimed(
    "count_bot_hits",
    exactCount(createTrafficCategoryCountQuery(linkId, "bot"), "count_bot_hits"),
    0,
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS
  );
  const prefetchHitsPromise = countWithFallback(
    "count_prefetch_hits",
    (countMode) => createTrafficCategoryCountQuery(linkId, "prefetch", countMode),
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS,
    { usePlannedFallback: true }
  );
  const humanVisitsPromise = countWithFallback(
    "count_human_visits",
    (countMode) => createHumanVisitCountQuery(linkId, countMode),
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS,
    { usePlannedFallback: true }
  );

  const [
    redirectCandidates,
    directRedirects,
    landingContinueRedirects,
    directClicksToday,
    landingContinueClicksToday,
    directUniqueClicks,
    landingContinueUniqueClicks,
    directNonUniqueClicks,
    landingContinueNonUniqueClicks,
    visits,
    landingViews,
    humanClicks,
    botHits,
    prefetchHits,
    humanVisits
  ] = await Promise.all([
    redirectCandidatesPromise,
    directRedirectsPromise,
    landingContinueRedirectsPromise,
    directClicksTodayPromise,
    landingContinueClicksTodayPromise,
    directUniqueClicksPromise,
    landingContinueUniqueClicksPromise,
    directNonUniqueClicksPromise,
    landingContinueNonUniqueClicksPromise,
    visitsPromise,
    landingViewsPromise,
    humanClicksPromise,
    botHitsPromise,
    prefetchHitsPromise,
    humanVisitsPromise
  ]);

  const redirects = directRedirects + landingContinueRedirects;
  const clicksToday = directClicksToday + landingContinueClicksToday;
  const uniqueClicks = directUniqueClicks + landingContinueUniqueClicks;
  const nonUniqueClicks = directNonUniqueClicks + landingContinueNonUniqueClicks;
  const legacyRedirects = Math.max(0, redirectCandidates - redirects);

  return {
    totalClicks: redirects,
    qrScans: 0,
    clicksToday,
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
}

async function getLinkAnalyticsDataViaQueries(linkId: string, timeZone: string): Promise<LinkAnalyticsData> {
  const cacheKey = `${linkId}:${timeZone}`;
  const nowMs = Date.now();
  const cached = cachedRuntimeLinkAnalytics.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return cached.data;
  }

  const fallback = createEmptyLinkAnalyticsData();
  const humanVisitsPromise = countWithFallback(
    "count_human_visits(click_type)",
    (countMode) => createHumanVisitCountQuery(linkId, countMode),
    LINK_ANALYTICS_OPTIONAL_COUNT_TIMEOUT_MS,
    { usePlannedFallback: true }
  );
  const legacyRedirectsPromise = countWithFallback(
    "count_redirect_candidates(click_type)",
    (countMode) => createRedirectCandidateCountQuery(linkId, countMode),
    LINK_ANALYTICS_QUERY_TIMEOUT_MS
  );

  const [
    overview,
    humanVisits,
    redirectCandidates,
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
    getLinkOverviewViaQueries(linkId, timeZone),
    humanVisitsPromise,
    legacyRedirectsPromise,
    safeTimed("get_link_timeseries(hours)", getLinkTimeseries(linkId, "hours", 24), fallback.timeseries.hours, LINK_ANALYTICS_QUERY_TIMEOUT_MS),
    safeTimed("get_link_timeseries(days)", getLinkTimeseries(linkId, "days", 30), fallback.timeseries.days, LINK_ANALYTICS_QUERY_TIMEOUT_MS),
    safeTimed(
      "get_link_timeseries(months)",
      getLinkTimeseries(linkId, "months", 12),
      fallback.timeseries.months,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(country)",
      getLinkTopDimension(linkId, "country", 12),
      fallback.worldMap,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed("get_link_top_dimension(city)", getLinkTopDimension(linkId, "city", 8), fallback.topCities, LINK_ANALYTICS_QUERY_TIMEOUT_MS),
    safeTimed(
      "get_link_top_dimension(region)",
      getLinkTopDimension(linkId, "region", 8),
      fallback.topRegions,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(source)",
      getLinkTopDimension(linkId, "source", 8),
      fallback.topSources,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(browser)",
      getLinkTopDimension(linkId, "browser", 8),
      fallback.topBrowsers,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(device)",
      getLinkTopDimension(linkId, "device", 6),
      fallback.topDevices,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(language)",
      getLinkTopDimension(linkId, "language", 8),
      fallback.topLanguages,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(platform)",
      getLinkTopDimension(linkId, "platform", 8),
      fallback.topPlatforms,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed(
      "get_link_top_dimension(social)",
      getLinkTopDimension(linkId, "social", 8),
      fallback.topSocialPlatforms,
      LINK_ANALYTICS_QUERY_TIMEOUT_MS
    ),
    safeTimed("get_link_day_breakdown", getLinkDayBreakdown(linkId), fallback.topDays, LINK_ANALYTICS_QUERY_TIMEOUT_MS),
    safeTimed("get_link_hour_breakdown", getLinkHourBreakdown(linkId), fallback.popularHours, LINK_ANALYTICS_QUERY_TIMEOUT_MS)
  ]);

  const normalizedOverview: LinkOverviewStats = {
    ...overview
  };
  const legacyRedirects = Math.max(0, redirectCandidates - normalizedOverview.redirects);

  const data: LinkAnalyticsData = {
    overview: normalizedOverview,
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
    clickType: [
      { label: "Visits (human)", clicks: humanVisits },
      { label: "Landing Views", clicks: normalizedOverview.landingViews },
      { label: "Human Clicks", clicks: normalizedOverview.humanClicks },
      { label: "Redirects (human)", clicks: normalizedOverview.redirects },
      { label: "Redirects (legacy)", clicks: legacyRedirects },
      { label: "Bots", clicks: normalizedOverview.botHits },
      { label: "Prefetch", clicks: normalizedOverview.prefetchHits }
    ],
    topSocialPlatforms,
    topSources,
    topBrowsers,
    topDevices,
    topLanguages,
    topPlatforms
  };

  cachedRuntimeLinkAnalytics.set(cacheKey, {
    data,
    expiresAt: nowMs + LINK_ANALYTICS_CACHE_TTL_MS
  });

  return data;
}

export async function getLinkAnalyticsData(linkId: string, timeZone?: string): Promise<LinkAnalyticsData> {
  const resolvedTimeZone = resolveAnalyticsTimeZone(timeZone);
  const cacheKey = `${linkId}:${resolvedTimeZone}`;
  const nowMs = Date.now();
  const cached = cachedRuntimeLinkAnalytics.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return cached.data;
  }

  const startedAt = Date.now();
  try {
    const data = await getLinkAnalyticsDataFromEvents(linkId, resolvedTimeZone);
    cachedRuntimeLinkAnalytics.set(cacheKey, {
      data,
      expiresAt: Date.now() + LINK_ANALYTICS_CACHE_TTL_MS
    });

    console.info("getLinkAnalyticsData resolved", {
      linkId,
      timeZone: resolvedTimeZone,
      durationMs: Date.now() - startedAt,
      fallbackUsed: false
    });

    return data;
  } catch (error) {
    console.error("getLinkAnalyticsData failed", {
      linkId,
      timeZone: resolvedTimeZone,
      durationMs: Date.now() - startedAt,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
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

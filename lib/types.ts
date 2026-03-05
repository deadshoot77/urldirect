export type RedirectStatus = 301 | 302;
export type DeviceType = "mobile" | "desktop" | "bot" | "unknown";
export type PixelType = "meta" | "tiktok" | "google" | "postback";
export type AdminPlan = "free" | "pro";
export type TrackingLimitBehavior = "drop" | "minimal";
export type LandingMode = "inherit" | "on" | "off";
export type TrackingEventType = "visit" | "landing_view" | "human_click" | "redirect";
export type TrafficCategory = "human" | "bot" | "prefetch" | "unknown";
export type AnalyticsGranularity = "hours" | "days" | "months";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: JsonValue;
    }
  | JsonValue[];

export interface RedirectRule {
  id: number;
  slug: string;
  targetUrl: string;
  statusCode: RedirectStatus;
  isActive: boolean;
  pixelEnabled: boolean;
  pixelType: PixelType | null;
  pixelConfig: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedRedirect {
  slug: string;
  targetUrl: string;
  statusCode: RedirectStatus;
  pixelEnabled: boolean;
  pixelType: PixelType | null;
  pixelConfig: string | null;
  ruleId: number | null;
}

export interface PixelLogInput {
  ruleId: number | null;
  slug: string;
  pixelType: PixelType;
  eventName: string;
  status: "success" | "error";
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  payload: Record<string, JsonValue> | null;
}

export interface PixelConfig {
  id: string;
  token?: string;
  event_name: string;
  custom_params?: Record<string, string | number | boolean>;
}

export interface RoutingRule {
  id?: string;
  name?: string;
  destination_url: string;
  devices?: string[];
  countries?: string[];
  languages?: string[];
  enabled?: boolean;
}

export interface DeepLinksConfig {
  ios_url?: string;
  android_url?: string;
  fallback_url?: string;
}

export interface RetargetingScript {
  id?: string;
  name?: string;
  type?: "inline" | "external" | "pixel";
  content?: string;
  src?: string;
  enabled?: boolean;
}

export interface ShortLink {
  id: string;
  slug: string;
  destinationUrl: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  title: string | null;
  isFavorite: boolean;
  tags: string[];
  redirectType: RedirectStatus;
  routingRules: RoutingRule[];
  deepLinks: DeepLinksConfig;
  retargetingScripts: RetargetingScript[];
  landingMode: LandingMode;
  backgroundUrl: string | null;
  isActive: boolean;
}

export interface ShortLinkListItem extends ShortLink {
  clicksReceived: number;
  clicksToday: number;
  lastClickAt: string | null;
}

export interface AdminSettings {
  plan: AdminPlan;
  clickLimitMonthly: number;
  trackingEnabled: boolean;
  landingEnabled: boolean;
  globalBackgroundUrl: string | null;
  limitBehavior: TrackingLimitBehavior;
  usageThisMonth: number;
  limitReached: boolean;
}

export interface LinkOverviewStats {
  totalClicks: number;
  qrScans: number;
  clicksToday: number;
  lastClickAt: string | null;
  uniqueClicks: number;
  nonUniqueClicks: number;
  visits: number;
  landingViews: number;
  humanClicks: number;
  redirects: number;
  directRedirects: number;
  botHits: number;
  prefetchHits: number;
}

export interface TimeSeriesPoint {
  bucketAt: string;
  label: string;
  clicks: number;
}

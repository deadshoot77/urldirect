import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { DeviceType, TrafficCategory } from "@/lib/types";

const BOT_REGEX = /(bot|crawler|spider|crawling|headless|preview)/i;
const MOBILE_REGEX = /(android|iphone|ipad|ipod|mobile|windows phone)/i;
const TABLET_REGEX = /(ipad|tablet|kindle|silk)/i;
const EXTRA_BOT_REGEX =
  /(discordbot|telegrambot|slackbot|twitterbot|facebookexternalhit|facebot|linkedinbot|whatsapp|scanner|curl|wget|python-requests|postmanruntime)/i;
const PREFETCH_UA_REGEX =
  /(preview|prerender|prefetch|headless|facebookexternalhit|discordbot|telegrambot|slackbot|whatsapp|skypeuripreview)/i;
const IN_APP_BROWSER_REGEX =
  /(tiktok|musical_ly|ttwebview|bytedance|instagram|fbav|fb_iab|line\/|micromessenger|snapchat|wv\)|webview|gsa\/|linkedinapp)/i;
const TIKTOK_IN_APP_REGEX = /(tiktok|musical_ly|bytedance|ttwebview|bytedancewebview)/i;
const PREFETCH_HEADER_KEYS = [
  "purpose",
  "sec-purpose",
  "x-purpose",
  "x-moz",
  "x-prefetch",
  "x-prerender"
] as const;
const PREFETCH_HEADER_HINTS = /(prefetch|prerender|preview|next-page|safe-preview|link-preview)/i;
const TRACKING_HEADER_KEYS = [
  "purpose",
  "sec-purpose",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-dest",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "x-forwarded-for",
  "x-real-ip",
  "x-nf-client-connection-ip",
  "x-nf-country",
  "x-nf-geo",
  "referer",
  "accept-language"
] as const;

export interface UserAgentProfile {
  device: string;
  os: string;
  browser: string;
  platform: string;
  isBot: boolean;
}

export interface GeoData {
  country: string;
  region: string | null;
  city: string | null;
}

export interface TrafficClassification {
  category: TrafficCategory;
  isBot: boolean;
  isPrefetch: boolean;
  prefetchSignals: string[];
  botSignals: string[];
}

interface ParsedNetlifyGeoData {
  country: string | null;
  region: string | null;
  city: string | null;
}

function normalizeToken(value: string | null | undefined, fallback = "unknown"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toNullableToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  if (padding === 0) return normalized;
  return normalized.padEnd(normalized.length + (4 - padding), "=");
}

function decodeBase64(value: string): string | null {
  try {
    return Buffer.from(normalizeBase64(value), "base64").toString("utf8");
  } catch {
    return null;
  }
}

function extractCountryCode(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return toNullableToken(value);
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return (
    toNullableToken(raw.code) ??
    toNullableToken(raw.iso_code) ??
    toNullableToken(raw.country_code) ??
    toNullableToken(raw.alpha2) ??
    toNullableToken(raw.alpha3)
  );
}

function extractRegion(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return toNullableToken(value);
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return toNullableToken(raw.code) ?? toNullableToken(raw.name);
}

function parseNetlifyGeoHeader(rawHeader: string | null): ParsedNetlifyGeoData | null {
  if (!rawHeader) return null;
  const trimmed = rawHeader.trim();
  if (!trimmed) return null;

  const jsonCandidates = [trimmed];
  let decodedUriValue: string | null = null;
  try {
    const decodedUri = decodeURIComponent(trimmed);
    if (decodedUri !== trimmed) {
      jsonCandidates.push(decodedUri);
      decodedUriValue = decodedUri;
    }
  } catch {
    // ignore malformed URI payloads
  }

  const decodedBase64 = decodeBase64(trimmed);
  if (decodedBase64) {
    jsonCandidates.push(decodedBase64);
  }
  if (decodedUriValue) {
    const decodedBase64FromUri = decodeBase64(decodedUriValue);
    if (decodedBase64FromUri) {
      jsonCandidates.push(decodedBase64FromUri);
    }
  }

  for (const candidate of jsonCandidates) {
    const parsed = parseJsonObject(candidate);
    if (!parsed) {
      continue;
    }
    const country =
      extractCountryCode(parsed.country) ??
      toNullableToken(parsed.country_code) ??
      toNullableToken(parsed.countryCode);
    const region =
      toNullableToken(parsed.region) ??
      toNullableToken(parsed.region_code) ??
      extractRegion(parsed.subdivision) ??
      toNullableToken(parsed.state);
    const city = toNullableToken(parsed.city);

    return { country, region, city };
  }

  return null;
}

function detectOs(userAgent: string): string {
  if (/android/i.test(userAgent)) return "Android";
  if (/(iphone|ipad|ipod)/i.test(userAgent)) return "iOS";
  if (/windows nt/i.test(userAgent)) return "Windows";
  if (/(macintosh|mac os x)/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  if (/cros/i.test(userAgent)) return "ChromeOS";
  return "Unknown";
}

function detectBrowser(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/opr\//i.test(userAgent) || /opera/i.test(userAgent)) return "Opera";
  if (/samsungbrowser\//i.test(userAgent)) return "Samsung Internet";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)) return "Chrome";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
  return "Unknown";
}

function detectPlatform(os: string, userAgent: string): string {
  if (/facebook/i.test(userAgent)) return "Facebook In-App";
  if (/instagram/i.test(userAgent)) return "Instagram In-App";
  if (/tiktok/i.test(userAgent)) return "TikTok In-App";
  if (os === "Unknown") return "web";
  return os.toLowerCase();
}

export function getClientIp(request: NextRequest): string | null {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const xRealIp = request.headers.get("x-real-ip")?.trim();
  if (xRealIp) return xRealIp;

  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  const netlifyIp = request.headers.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp) return netlifyIp;

  return null;
}

export function anonymizeIp(ip: string | null): string {
  const source = ip || "unknown";
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${source}`).digest("hex");
}

export function parseUserAgent(userAgent: string | null): UserAgentProfile {
  if (!userAgent) {
    return {
      device: "unknown",
      os: "Unknown",
      browser: "Unknown",
      platform: "web",
      isBot: false
    };
  }

  const isBot = BOT_REGEX.test(userAgent) || EXTRA_BOT_REGEX.test(userAgent);
  let device = "desktop";
  if (isBot) {
    device = "bot";
  } else if (TABLET_REGEX.test(userAgent)) {
    device = "tablet";
  } else if (MOBILE_REGEX.test(userAgent)) {
    device = "mobile";
  }

  const os = detectOs(userAgent);
  return {
    device,
    os,
    browser: detectBrowser(userAgent),
    platform: detectPlatform(os, userAgent),
    isBot
  };
}

export function detectDeviceType(userAgent: string | null): DeviceType {
  const parsed = parseUserAgent(userAgent);
  if (parsed.device === "bot") return "bot";
  if (parsed.device === "mobile" || parsed.device === "tablet") return "mobile";
  if (parsed.device === "desktop") return "desktop";
  return "unknown";
}

function getPrefetchSignals(request: NextRequest, userAgent: string | null): string[] {
  const signals: string[] = [];
  for (const key of PREFETCH_HEADER_KEYS) {
    const value = request.headers.get(key);
    if (value && PREFETCH_HEADER_HINTS.test(value)) {
      signals.push(`${key}:${value.toLowerCase()}`);
    }
  }

  const secFetchMode = request.headers.get("sec-fetch-mode");
  if (secFetchMode && /prefetch/i.test(secFetchMode)) {
    signals.push(`sec-fetch-mode:${secFetchMode.toLowerCase()}`);
  }

  if (request.method.toUpperCase() === "HEAD") {
    signals.push("method:head");
  }

  if (userAgent && PREFETCH_UA_REGEX.test(userAgent)) {
    signals.push("ua:prefetch");
  }

  return signals;
}

function getBotSignals(userAgent: string | null, uaProfile: UserAgentProfile): string[] {
  const signals: string[] = [];
  if (uaProfile.isBot) {
    signals.push("ua:bot");
  }
  if (userAgent && EXTRA_BOT_REGEX.test(userAgent)) {
    signals.push("ua:known-bot");
  }
  return signals;
}

export function classifyTraffic(
  request: NextRequest,
  userAgent: string | null,
  uaProfile = parseUserAgent(userAgent)
): TrafficClassification {
  const prefetchSignals = getPrefetchSignals(request, userAgent);
  const botSignals = getBotSignals(userAgent, uaProfile);
  const isPrefetch = prefetchSignals.length > 0;
  const isBot = botSignals.length > 0;

  let category: TrafficCategory = "unknown";
  if (isPrefetch) {
    category = "prefetch";
  } else if (isBot) {
    category = "bot";
  } else if (request.method.toUpperCase() === "GET") {
    category = "human";
  }

  return {
    category,
    isBot,
    isPrefetch,
    prefetchSignals,
    botSignals
  };
}

export function isInAppBrowserRequest(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return IN_APP_BROWSER_REGEX.test(userAgent);
}

export function isTikTokInAppRequest(userAgent: string | null, referer: string | null): boolean {
  if (userAgent && TIKTOK_IN_APP_REGEX.test(userAgent)) {
    return true;
  }
  if (!referer) return false;
  return /tiktok\.com/i.test(referer);
}

export function getTrackingHeaders(request: NextRequest): Record<string, string> {
  const output: Record<string, string> = {};
  for (const key of TRACKING_HEADER_KEYS) {
    const value = request.headers.get(key);
    if (!value) continue;
    const normalized = value.trim();
    if (!normalized) continue;
    output[key] = normalized;
  }
  return output;
}

export function getCountryCode(request: NextRequest): string {
  const fromVercel = request.headers.get("x-vercel-ip-country");
  if (fromVercel) return fromVercel.toUpperCase();

  const fromCloudflare = request.headers.get("cf-ipcountry");
  if (fromCloudflare) return fromCloudflare.toUpperCase();

  const fromNetlify = request.headers.get("x-nf-country");
  if (fromNetlify) return fromNetlify.toUpperCase();

  const fallback = request.headers.get("x-country-code");
  if (fallback) return fallback.toUpperCase();

  return "UNK";
}

export function getGeoData(request: NextRequest): GeoData {
  const netlifyGeo = parseNetlifyGeoHeader(request.headers.get("x-nf-geo"));
  const country = normalizeToken(netlifyGeo?.country ?? getCountryCode(request), "UNK").toUpperCase();
  const region =
    netlifyGeo?.region ??
    request.headers.get("x-vercel-ip-country-region") ??
    request.headers.get("cf-region") ??
    request.headers.get("cf-region-code") ??
    request.headers.get("x-region");
  const city =
    netlifyGeo?.city ??
    request.headers.get("x-vercel-ip-city") ??
    request.headers.get("cf-ipcity") ??
    request.headers.get("cf-city") ??
    request.headers.get("x-city");

  return {
    country,
    region: region ? normalizeToken(region, "unknown") : null,
    city: city ? normalizeToken(city, "unknown") : null
  };
}

export function getPreferredLanguage(request: NextRequest): string {
  const raw = request.headers.get("accept-language");
  if (!raw) return "unknown";
  const first = raw.split(",")[0]?.trim().toLowerCase();
  return first || "unknown";
}

export function getRefererDomain(referer: string | null): string {
  if (!referer) return "direct";
  try {
    const parsed = new URL(referer);
    return parsed.hostname.toLowerCase() || "direct";
  } catch {
    return "direct";
  }
}

export function parseTrafficSource(referer: string | null): string {
  const host = getRefererDomain(referer);
  if (host === "direct") return "direct";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.")) return "facebook";
  if (host.includes("x.com") || host.includes("twitter") || host === "t.co") return "x";
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
  if (host.includes("reddit")) return "reddit";
  if (host.includes("snapchat")) return "snapchat";
  if (host.includes("pinterest")) return "pinterest";
  if (host.includes("google")) return "google";
  return host;
}

export function extractQueryParams(searchParams: URLSearchParams): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  const keys = new Set<string>();
  for (const key of searchParams.keys()) {
    keys.add(key);
  }

  for (const key of keys) {
    const values = searchParams.getAll(key);
    output[key] = values.length > 1 ? values : values[0] ?? "";
  }
  return output;
}

export function extractUtmParams(searchParams: URLSearchParams): Record<string, string> {
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
    "ttclid"
  ];
  const output: Record<string, string> = {};
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) {
      output[key] = value;
    }
  }
  return output;
}

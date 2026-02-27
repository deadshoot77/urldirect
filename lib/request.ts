import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { DeviceType } from "@/lib/types";

const BOT_REGEX = /(bot|crawler|spider|crawling|headless|preview)/i;
const MOBILE_REGEX = /(android|iphone|ipad|ipod|mobile|windows phone)/i;
const TABLET_REGEX = /(ipad|tablet|kindle|silk)/i;

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

function normalizeToken(value: string | null | undefined, fallback = "unknown"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
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

  const isBot = BOT_REGEX.test(userAgent);
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

export function getCountryCode(request: NextRequest): string {
  const fromVercel = request.headers.get("x-vercel-ip-country");
  if (fromVercel) return fromVercel.toUpperCase();

  const fromCloudflare = request.headers.get("cf-ipcountry");
  if (fromCloudflare) return fromCloudflare.toUpperCase();

  const fallback = request.headers.get("x-country-code");
  if (fallback) return fallback.toUpperCase();

  return "UNK";
}

export function getGeoData(request: NextRequest): GeoData {
  const country = getCountryCode(request);
  const region =
    request.headers.get("x-vercel-ip-country-region") ??
    request.headers.get("cf-region") ??
    request.headers.get("x-region");
  const city = request.headers.get("x-vercel-ip-city") ?? request.headers.get("cf-ipcity") ?? request.headers.get("x-city");

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

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { DeviceType } from "@/lib/types";

const BOT_REGEX = /(bot|crawler|spider|crawling|headless|preview)/i;
const MOBILE_REGEX = /(android|iphone|ipad|ipod|mobile|windows phone)/i;

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

export function detectDeviceType(userAgent: string | null): DeviceType {
  if (!userAgent) return "unknown";
  if (BOT_REGEX.test(userAgent)) return "bot";
  if (MOBILE_REGEX.test(userAgent)) return "mobile";
  return "desktop";
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

export function getRefererDomain(referer: string | null): string {
  if (!referer) return "direct";
  try {
    const parsed = new URL(referer);
    return parsed.hostname.toLowerCase() || "direct";
  } catch {
    return "direct";
  }
}

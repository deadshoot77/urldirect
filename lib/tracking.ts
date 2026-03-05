import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { LandingMode, TrackingEventType } from "@/lib/types";

const INTERNAL_QUERY_PARAMS = new Set(["rb_continue", "rb_token"]);
const DEFAULT_BUCKET_SECONDS = 30;
const EVENT_BUCKET_SECONDS: Record<TrackingEventType, number> = {
  visit: 30,
  landing_view: 30,
  human_click: 60,
  redirect: 30
};
const LANDING_TOKEN_VERSION = 1;

function normalizeToken(value: string | null | undefined): string {
  if (!value) return "unknown";
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "unknown";
}

export function shouldShowLanding(globalEnabled: boolean, mode: LandingMode): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return globalEnabled;
}

export function hasContinueSignal(searchParams: URLSearchParams): boolean {
  const value = searchParams.get("rb_continue");
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function stripInternalParams(searchParams: URLSearchParams): URLSearchParams {
  const cloned = new URLSearchParams(searchParams);
  for (const key of INTERNAL_QUERY_PARAMS) {
    cloned.delete(key);
  }
  return cloned;
}

export function buildContinueSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const cloned = stripInternalParams(searchParams);
  cloned.set("rb_continue", "1");
  return cloned;
}

export function buildDedupBucket(eventType: TrackingEventType, now = Date.now()): string {
  const seconds = EVENT_BUCKET_SECONDS[eventType] ?? DEFAULT_BUCKET_SECONDS;
  const bucketMs = Math.max(1000, seconds * 1000);
  const value = Math.floor(now / bucketMs) * bucketMs;
  return new Date(value).toISOString();
}

export function buildTrackingDedupKey(input: {
  linkId: string;
  slug: string;
  eventType: TrackingEventType;
  ipHash: string;
  userAgent: string | null;
  bucketIso: string;
  scopeHint?: string | null;
}): string {
  const normalizedUa = normalizeToken(input.userAgent).slice(0, 180);
  const raw = [
    input.linkId,
    normalizeToken(input.slug),
    input.eventType,
    normalizeToken(input.ipHash),
    normalizeToken(input.scopeHint),
    normalizedUa,
    input.bucketIso
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export function buildDedupScopeHint(input: {
  hasClientIp: boolean;
  userAgent: string | null;
  acceptLanguage: string;
  source: string;
  country: string;
  path: string;
  query: string;
  referer: string | null;
  secFetchSite: string | null;
  secFetchMode: string | null;
}): string {
  if (input.hasClientIp) {
    return "ip-present";
  }
  const raw = [
    normalizeToken(input.userAgent),
    normalizeToken(input.acceptLanguage),
    normalizeToken(input.source),
    normalizeToken(input.country),
    normalizeToken(input.path),
    normalizeToken(input.query),
    normalizeToken(input.referer),
    normalizeToken(input.secFetchSite),
    normalizeToken(input.secFetchMode)
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), "=");
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(secret: string, payloadBase64: string): string {
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

function hashUserAgent(userAgent: string | null): string {
  const normalized = normalizeToken(userAgent);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function signLandingContinueToken(input: {
  secret: string;
  linkId: string;
  slug: string;
  ipHash: string;
  userAgent: string | null;
  expiresInSeconds?: number;
  nowMs?: number;
}): string {
  const nowMs = input.nowMs ?? Date.now();
  const expiresInSeconds = Math.max(30, Math.min(input.expiresInSeconds ?? 120, 600));
  const payload = {
    v: LANDING_TOKEN_VERSION,
    lid: input.linkId,
    s: normalizeToken(input.slug),
    ip: normalizeToken(input.ipHash),
    ua: hashUserAgent(input.userAgent),
    exp: Math.floor(nowMs / 1000) + expiresInSeconds
  };
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(input.secret, payloadBase64);
  return `${payloadBase64}.${signature}`;
}

interface LandingTokenPayload {
  v: number;
  lid: string;
  s: string;
  ip: string;
  ua: string;
  exp: number;
}

export function verifyLandingContinueToken(
  token: string | null,
  input: {
    secret: string;
    linkId: string;
    slug: string;
    ipHash: string;
    userAgent: string | null;
    nowMs?: number;
  }
): { valid: boolean; reason: string } {
  if (!token) {
    return { valid: false, reason: "missing_token" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "invalid_format" };
  }

  const [payloadBase64, providedSignature] = parts;
  const expectedSignature = signPayload(input.secret, payloadBase64);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  const sameLength = providedBuffer.length === expectedBuffer.length;
  if (!sameLength || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false, reason: "invalid_signature" };
  }

  const decoded = fromBase64Url(payloadBase64);
  if (!decoded) {
    return { valid: false, reason: "invalid_payload_encoding" };
  }

  let payload: LandingTokenPayload;
  try {
    payload = JSON.parse(decoded) as LandingTokenPayload;
  } catch {
    return { valid: false, reason: "invalid_payload_json" };
  }

  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "invalid_payload_type" };
  }
  if (payload.v !== LANDING_TOKEN_VERSION) {
    return { valid: false, reason: "invalid_version" };
  }
  if (payload.lid !== input.linkId) {
    return { valid: false, reason: "link_mismatch" };
  }
  if (payload.s !== normalizeToken(input.slug)) {
    return { valid: false, reason: "slug_mismatch" };
  }
  if (payload.ip !== normalizeToken(input.ipHash)) {
    return { valid: false, reason: "ip_mismatch" };
  }
  if (payload.ua !== hashUserAgent(input.userAgent)) {
    return { valid: false, reason: "ua_mismatch" };
  }
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (payload.exp < nowSeconds) {
    return { valid: false, reason: "token_expired" };
  }

  return { valid: true, reason: "ok" };
}

import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirect } from "@/lib/db";
import { env } from "@/lib/env";
import { getAdminSettings, getShortLinkBySlug, insertClickEvent, isUniqueClick } from "@/lib/links";
import {
  buildRetargetingIntermediaryHtml,
  hasRetargetingScripts,
  resolveDeepLinkDestination,
  resolveDestinationWithRouting
} from "@/lib/link-routing";
import { triggerPixelTracking } from "@/lib/pixel";
import { mergeQueryParams, normalizeSlug } from "@/lib/redirect";
import {
  anonymizeIp,
  extractQueryParams,
  extractUtmParams,
  getClientIp,
  getGeoData,
  getPreferredLanguage,
  parseTrafficSource,
  parseUserAgent
} from "@/lib/request";
import type { RedirectRule, ResolvedRedirect } from "@/lib/types";

async function handleLegacyRedirectRequest(request: NextRequest, slug: string | null): Promise<NextResponse> {
  const normalizedSlug = slug ? normalizeSlug(slug) : null;
  const fallbackSlug = normalizedSlug || "/";
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const clientIp = getClientIp(request);
  const ipHash = anonymizeIp(clientIp);
  const geo = getGeoData(request);
  const queryString = request.nextUrl.searchParams.toString();

  let decision: ResolvedRedirect;
  try {
    decision = await resolveRedirect({
      slug: normalizedSlug,
      defaultUrl: env.DEFAULT_REDIRECT_URL,
      defaultStatus: env.DEFAULT_REDIRECT_STATUS,
      userAgent,
      referer,
      ipHash,
      country: geo.country,
      queryString
    });
  } catch (error) {
    console.error("Failed to resolve redirect rule via legacy rpc", error);
    decision = {
      slug: fallbackSlug,
      targetUrl: env.DEFAULT_REDIRECT_URL,
      statusCode: env.DEFAULT_REDIRECT_STATUS,
      pixelEnabled: false,
      pixelType: null,
      pixelConfig: null,
      ruleId: null
    };
  }

  let finalUrl = env.DEFAULT_REDIRECT_URL;
  try {
    finalUrl = mergeQueryParams(decision.targetUrl, request.nextUrl.searchParams);
  } catch (error) {
    console.error("Failed to merge query params with target URL (legacy)", error);
    finalUrl = mergeQueryParams(env.DEFAULT_REDIRECT_URL, request.nextUrl.searchParams);
  }

  if (decision.pixelEnabled && decision.pixelType && decision.pixelConfig) {
    const virtualRule: RedirectRule = {
      id: decision.ruleId ?? 0,
      slug: decision.slug,
      targetUrl: decision.targetUrl,
      statusCode: decision.statusCode,
      isActive: true,
      pixelEnabled: true,
      pixelType: decision.pixelType,
      pixelConfig: decision.pixelConfig,
      createdAt: "",
      updatedAt: ""
    };

    try {
      void triggerPixelTracking({
        slug: decision.slug,
        rule: virtualRule,
        finalUrl,
        originalUrl: request.url,
        ip: clientIp,
        userAgent,
        referer,
        country: geo.country,
        query: request.nextUrl.searchParams
      });
    } catch (error) {
      console.error("Failed to schedule legacy pixel tracking", error);
    }
  }

  return NextResponse.redirect(finalUrl, {
    status: decision.statusCode
  });
}

function applyWarningHeader(response: NextResponse, shouldWarn: boolean): NextResponse {
  if (shouldWarn) {
    response.headers.set("x-tracking-warning", "data may not be fully accurate");
  }
  return response;
}

export async function handleRedirectRequest(request: NextRequest, slug: string | null): Promise<NextResponse> {
  const normalizedSlug = slug ? normalizeSlug(slug) : null;
  if (!normalizedSlug) {
    return handleLegacyRedirectRequest(request, null);
  }

  let shortLink = null;
  try {
    shortLink = await getShortLinkBySlug(normalizedSlug);
  } catch (error) {
    console.error("getShortLinkBySlug failed", error);
  }

  if (!shortLink) {
    return handleLegacyRedirectRequest(request, normalizedSlug);
  }

  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const clientIp = getClientIp(request);
  const ipHash = anonymizeIp(clientIp);
  const geo = getGeoData(request);
  const language = getPreferredLanguage(request);
  const source = parseTrafficSource(referer);
  const uaProfile = parseUserAgent(userAgent);

  const routedDestination = resolveDestinationWithRouting(shortLink, {
    device: uaProfile.device,
    country: geo.country,
    language
  });
  const resolvedDestination = resolveDeepLinkDestination(routedDestination, shortLink.deepLinks, uaProfile);

  let finalUrl = env.DEFAULT_REDIRECT_URL;
  try {
    finalUrl = mergeQueryParams(resolvedDestination, request.nextUrl.searchParams);
  } catch (error) {
    console.error("Failed to merge query params with resolved destination", error);
    finalUrl = mergeQueryParams(env.DEFAULT_REDIRECT_URL, request.nextUrl.searchParams);
  }

  let limitReached = false;
  try {
    const settings = await getAdminSettings();
    limitReached = settings.limitReached;

    if (settings.trackingEnabled) {
      const shouldTrack = !settings.limitReached || settings.limitBehavior === "minimal";
      if (shouldTrack) {
        const unique = await isUniqueClick(shortLink.id, ipHash).catch(() => true);
        await insertClickEvent(
          {
            linkId: shortLink.id,
            slug: shortLink.slug,
            referrer: referer,
            ua: userAgent,
            ipHash,
            country: geo.country,
            region: geo.region,
            city: geo.city,
            device: uaProfile.device,
            os: uaProfile.os,
            browser: uaProfile.browser,
            platform: uaProfile.platform,
            language,
            queryParams: extractQueryParams(request.nextUrl.searchParams),
            isUnique: unique,
            source,
            utm: extractUtmParams(request.nextUrl.searchParams)
          },
          settings.limitReached && settings.limitBehavior === "minimal"
        );
      }
    }
  } catch (error) {
    console.error("Click tracking failed", error);
  }

  if (request.method === "GET" && hasRetargetingScripts(shortLink.retargetingScripts) && !uaProfile.isBot) {
    const html = buildRetargetingIntermediaryHtml(finalUrl, shortLink.retargetingScripts);
    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    });
    return applyWarningHeader(response, limitReached);
  }

  const response = NextResponse.redirect(finalUrl, {
    status: shortLink.redirectType
  });
  return applyWarningHeader(response, limitReached);
}

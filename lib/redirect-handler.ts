import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirect } from "@/lib/db";
import { env } from "@/lib/env";
import { getAdminSettings, getShortLinkBySlug, insertClickEvent, isUniqueClick } from "@/lib/links";
import {
  buildInAppLandingHtml,
  buildRetargetingIntermediaryHtml,
  hasRetargetingScripts,
  resolveDeepLinkDestination,
  resolveDestinationWithRouting
} from "@/lib/link-routing";
import { triggerPixelTracking } from "@/lib/pixel";
import { mergeQueryParams, normalizeSlug } from "@/lib/redirect";
import {
  anonymizeIp,
  classifyTraffic,
  extractQueryParams,
  extractUtmParams,
  getClientIp,
  getGeoData,
  getTrackingHeaders,
  isInAppBrowserRequest,
  isTikTokInAppRequest,
  getPreferredLanguage,
  parseTrafficSource,
  parseUserAgent
} from "@/lib/request";
import {
  buildDedupScopeHint,
  buildContinueSearchParams,
  buildDedupBucket,
  buildTrackingDedupKey,
  hasContinueSignal,
  signLandingContinueToken,
  shouldShowLanding,
  stripInternalParams,
  verifyLandingContinueToken
} from "@/lib/tracking";
import type { RedirectRule, ResolvedRedirect, ShortLink } from "@/lib/types";

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

export async function handleRedirectRequest(request: NextRequest, slug: string | null): Promise<NextResponse> {
  const normalizedSlug = slug ? normalizeSlug(slug) : null;
  if (!normalizedSlug) {
    return handleLegacyRedirectRequest(request, null);
  }

  let shortLink: ShortLink | null = null;
  try {
    shortLink = await getShortLinkBySlug(normalizedSlug);
  } catch (error) {
    console.error("getShortLinkBySlug failed", error);
  }

  if (!shortLink) {
    return handleLegacyRedirectRequest(request, normalizedSlug);
  }
  const activeLink = shortLink;

  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const isTikTokInApp = isTikTokInAppRequest(userAgent, referer);
  const isGenericInApp = isInAppBrowserRequest(userAgent);
  const isInAppBrowser = isTikTokInApp || isGenericInApp;
  const clientIp = getClientIp(request);
  const ipHash = anonymizeIp(clientIp);
  const geo = getGeoData(request);
  const language = getPreferredLanguage(request);
  const source = parseTrafficSource(referer);
  const uaProfile = parseUserAgent(userAgent);
  const traffic = classifyTraffic(request, userAgent, uaProfile);
  const trackingHeaders = getTrackingHeaders(request);
  const continueRequested = hasContinueSignal(request.nextUrl.searchParams);
  const continueToken = request.nextUrl.searchParams.get("rb_token");
  const outboundSearchParams = stripInternalParams(request.nextUrl.searchParams);
  const dedupScopeHint = buildDedupScopeHint({
    hasClientIp: Boolean(clientIp),
    userAgent,
    acceptLanguage: language,
    source,
    country: geo.country,
    path: request.nextUrl.pathname,
    query: outboundSearchParams.toString(),
    referer,
    secFetchSite: request.headers.get("sec-fetch-site"),
    secFetchMode: request.headers.get("sec-fetch-mode")
  });

  const routedDestination = resolveDestinationWithRouting(activeLink, {
    device: uaProfile.device,
    country: geo.country,
    language
  });
  const resolvedDestination = resolveDeepLinkDestination(routedDestination, activeLink.deepLinks, uaProfile);

  let finalUrl = env.DEFAULT_REDIRECT_URL;
  try {
    finalUrl = mergeQueryParams(resolvedDestination, outboundSearchParams);
  } catch (error) {
    console.error("Failed to merge query params with resolved destination", error);
    finalUrl = mergeQueryParams(env.DEFAULT_REDIRECT_URL, outboundSearchParams);
  }

  let settings = {
    trackingEnabled: true,
    landingEnabled: false,
    globalBackgroundUrl: null as string | null
  };

  try {
    const loaded = await getAdminSettings();
    settings = {
      trackingEnabled: loaded.trackingEnabled,
      landingEnabled: loaded.landingEnabled,
      globalBackgroundUrl: loaded.globalBackgroundUrl
    };
  } catch (error) {
    console.error("getAdminSettings failed", error);
  }

  const landingEnabledForSlug = shouldShowLanding(settings.landingEnabled, activeLink.landingMode);
  const requiresSignedContinue = landingEnabledForSlug && isInAppBrowser;
  const tokenSecret = env.TRACKING_TOKEN_SECRET ?? env.AUTH_SECRET;
  const continueTokenCheck =
    continueRequested && requiresSignedContinue
      ? verifyLandingContinueToken(continueToken, {
          secret: tokenSecret,
          linkId: activeLink.id,
          slug: activeLink.slug,
          ipHash,
          userAgent
        })
      : { valid: true, reason: continueRequested ? "token_not_required" : "not_requested" };
  const continueAllowed = !continueRequested || !requiresSignedContinue || continueTokenCheck.valid;

  async function trackEvent(eventType: "visit" | "landing_view" | "human_click" | "redirect", options?: {
    isUnique?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    if (!settings.trackingEnabled) return;
    const bucketIso = buildDedupBucket(eventType);
    const dedupKey = buildTrackingDedupKey({
      linkId: activeLink.id,
      slug: activeLink.slug,
      eventType,
      ipHash,
      userAgent,
      bucketIso,
      scopeHint: dedupScopeHint
    });

    await insertClickEvent({
      linkId: activeLink.id,
      slug: activeLink.slug,
      eventType,
      trafficCategory: traffic.category,
      requestMethod: request.method.toUpperCase(),
      isBot: traffic.isBot,
      isPrefetch: traffic.isPrefetch,
      dedupKey,
      requestHeaders: trackingHeaders,
      metadata: {
        prefetch_signals: traffic.prefetchSignals,
        bot_signals: traffic.botSignals,
        tiktok_in_app: isTikTokInApp,
        in_app_browser: isInAppBrowser,
        continue_signal: continueRequested,
        continue_token_required: requiresSignedContinue,
        continue_token_valid: continueTokenCheck.valid,
        continue_token_reason: continueTokenCheck.reason,
        ...(options?.metadata ?? {})
      },
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
      queryParams: extractQueryParams(outboundSearchParams),
      isUnique: options?.isUnique ?? true,
      source,
      utm: extractUtmParams(outboundSearchParams)
    });
  }

  const shouldTrackVisit = !continueRequested && (request.method !== "HEAD" || env.COUNT_HEAD_VISITS);
  try {
    if (shouldTrackVisit) {
      await trackEvent("visit", {
        metadata: {
          landing_mode: activeLink.landingMode
        }
      });
    }
  } catch (error) {
    console.error("Visit tracking failed", error);
  }

  const shouldDisplayLanding =
    request.method === "GET" &&
    landingEnabledForSlug &&
    isInAppBrowser &&
    traffic.category === "human" &&
    (!continueRequested || !continueAllowed);

  if (shouldDisplayLanding) {
    try {
      await trackEvent("landing_view", {
        metadata: {
          landing_background: activeLink.backgroundUrl ?? settings.globalBackgroundUrl
        }
      });
    } catch (error) {
      console.error("Landing view tracking failed", error);
    }

    const continueParams = buildContinueSearchParams(request.nextUrl.searchParams);
    const signedContinueToken = signLandingContinueToken({
      secret: tokenSecret,
      linkId: activeLink.id,
      slug: activeLink.slug,
      ipHash,
      userAgent,
      expiresInSeconds: 120
    });
    continueParams.set("rb_token", signedContinueToken);
    const continueQuery = continueParams.toString();
    const continueUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}${continueQuery ? `?${continueQuery}` : ""}`;
    const shortUrl = `${request.nextUrl.origin}/${activeLink.slug}`;
    const html = buildInAppLandingHtml({
      continueUrl,
      shortUrl,
      backgroundUrl: activeLink.backgroundUrl ?? settings.globalBackgroundUrl
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    });
  }

  const shouldTrackHumanClick =
    request.method === "GET" &&
    continueRequested &&
    traffic.category === "human" &&
    requiresSignedContinue &&
    continueAllowed;
  if (shouldTrackHumanClick) {
    try {
      await trackEvent("human_click", {
        metadata: {
          landing_mode: activeLink.landingMode
        }
      });
    } catch (error) {
      console.error("Human click tracking failed", error);
    }
  }

  const passedLandingStep = !requiresSignedContinue || continueRequested;
  const isRedirectEventEligible =
    request.method === "GET" && traffic.category === "human" && continueAllowed && passedLandingStep;
  if (isRedirectEventEligible) {
    try {
      const unique = await isUniqueClick(activeLink.id, ipHash).catch(() => true);
      await trackEvent("redirect", {
        isUnique: unique,
        metadata: {
          redirect_path: requiresSignedContinue && continueRequested ? "landing_continue" : "direct",
          retargeting_intermediary: hasRetargetingScripts(activeLink.retargetingScripts)
        }
      });
    } catch (error) {
      console.error("Redirect tracking failed", error);
    }
  }

  if (request.method === "GET" && hasRetargetingScripts(activeLink.retargetingScripts) && !uaProfile.isBot) {
    const html = buildRetargetingIntermediaryHtml(finalUrl, activeLink.retargetingScripts);
    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    });
    return response;
  }

  return NextResponse.redirect(finalUrl, {
    status: activeLink.redirectType
  });
}

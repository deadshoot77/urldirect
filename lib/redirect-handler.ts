import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirect } from "@/lib/db";
import { env } from "@/lib/env";
import { triggerPixelTracking } from "@/lib/pixel";
import { mergeQueryParams, normalizeSlug } from "@/lib/redirect";
import { anonymizeIp, getClientIp, getCountryCode } from "@/lib/request";
import type { RedirectRule, ResolvedRedirect } from "@/lib/types";

export async function handleRedirectRequest(request: NextRequest, slug: string | null): Promise<NextResponse> {
  const normalizedSlug = slug ? normalizeSlug(slug) : null;
  const fallbackSlug = normalizedSlug || "/";
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const clientIp = getClientIp(request);
  const ipHash = anonymizeIp(clientIp);
  const country = getCountryCode(request);
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
      country,
      queryString
    });
  } catch (error) {
    console.error("Failed to resolve redirect rule via rpc", error);
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
    console.error("Failed to merge query params with target URL", error);
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
        country,
        query: request.nextUrl.searchParams
      });
    } catch (error) {
      console.error("Failed to schedule pixel tracking", error);
    }
  }

  return NextResponse.redirect(finalUrl, {
    status: decision.statusCode
  });
}

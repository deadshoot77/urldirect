import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { loadAdminLinksPageData } from "@/lib/admin-links-page-data";
import {
  createShortLink,
  getAdminSettings,
  getGlobalAnalyticsData
} from "@/lib/links";
import type { AdminSettings } from "@/lib/types";
import { shortLinkCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GLOBAL_ANALYTICS_TIMEOUT_MS = 20_000;

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  plan: "pro",
  clickLimitMonthly: Number.MAX_SAFE_INTEGER,
  trackingEnabled: true,
  landingEnabled: false,
  globalBackgroundUrl: null,
  limitBehavior: "drop",
  usageThisMonth: 0,
  limitReached: false
};

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

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "20");
  const includeAnalytics = request.nextUrl.searchParams.get("includeAnalytics") === "1";
  const timeZone = request.nextUrl.searchParams.get("tz") ?? undefined;
  const range = request.nextUrl.searchParams.get("range");

  try {
    const [linksResult, settingsResult] = await Promise.allSettled([
      loadAdminLinksPageData(page, pageSize, {
        timeZone
      }),
      getAdminSettings({ includeUsage: false })
    ]);

    if (linksResult.status !== "fulfilled") {
      throw linksResult.reason;
    }

    const linksData = linksResult.value;
    const settings =
      settingsResult.status === "fulfilled"
        ? settingsResult.value
        : (() => {
            console.error("admin links settings fallback to defaults", {
              page,
              pageSize,
              error:
                settingsResult.reason instanceof Error ? settingsResult.reason.message : settingsResult.reason
            });
            return DEFAULT_ADMIN_SETTINGS;
          })();

    if (linksData.linkStatsFallback) {
      console.error("admin links stats fallback used", {
        page,
        pageSize,
        timeZone: timeZone ?? "default"
      });
    }

    let globalAnalytics: Awaited<ReturnType<typeof getGlobalAnalyticsData>> | null = null;
    let globalAnalyticsFallback = false;
    if (includeAnalytics) {
      try {
        globalAnalytics = await withTimeout(
          getGlobalAnalyticsData({
            timeZone,
            range
          }),
          GLOBAL_ANALYTICS_TIMEOUT_MS,
          "getGlobalAnalyticsData"
        );
      } catch (error) {
        globalAnalyticsFallback = true;
        console.error("admin links analytics fallback to empty payload", {
          page,
          pageSize,
          range: range ?? "today",
          timeZone: timeZone ?? "default",
          error: error instanceof Error ? error.message : error
        });
      }
    }

    return NextResponse.json({
      links: linksData.links,
      linkStatsFallback: linksData.linkStatsFallback,
      settings,
      ...(includeAnalytics ? { globalAnalytics, globalAnalyticsFallback } : {})
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list short links" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsed = shortLinkCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }

  try {
    const created = await createShortLink({
      slug: parsed.data.slug,
      destinationUrl: parsed.data.destination_url,
      redirectType: parsed.data.redirect_type,
      title: parsed.data.title ?? null,
      isFavorite: parsed.data.is_favorite,
      tags: parsed.data.tags,
      routingRules: parsed.data.routing_rules,
      deepLinks: parsed.data.deep_links,
      retargetingScripts: parsed.data.retargeting_scripts,
      landingMode: parsed.data.landing_mode,
      backgroundUrl: parsed.data.background_url ?? null,
      isActive: parsed.data.is_active
    });

    return NextResponse.json({ link: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create short link" },
      { status: 500 }
    );
  }
}

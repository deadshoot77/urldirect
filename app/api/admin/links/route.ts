import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createShortLink, getAdminSettings, getGlobalAnalyticsData, listShortLinksWithStats } from "@/lib/links";
import { shortLinkCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "20");

  try {
    const [links, globalAnalytics, settings] = await Promise.all([
      listShortLinksWithStats(page, pageSize),
      getGlobalAnalyticsData(),
      getAdminSettings()
    ]);
    return NextResponse.json({ links, globalAnalytics, settings });
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

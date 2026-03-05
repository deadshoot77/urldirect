import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { deleteShortLink, getLinkAnalyticsData, getShortLinkById, updateShortLink } from "@/lib/links";
import { shortLinkPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const resolved = await params;
  const includeAnalytics = request.nextUrl.searchParams.get("includeAnalytics") === "1";

  try {
    const link = await getShortLinkById(resolved.id);
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (!includeAnalytics) {
      return NextResponse.json({ link });
    }

    const analytics = await getLinkAnalyticsData(resolved.id);
    return NextResponse.json({ link, analytics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch link" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const resolved = await params;
  const payload = await request.json().catch(() => null);
  const parsed = shortLinkPatchSchema.safeParse(payload);
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
    const updated = await updateShortLink(resolved.id, {
      slug: parsed.data.slug,
      destinationUrl: parsed.data.destination_url,
      redirectType: parsed.data.redirect_type,
      title: parsed.data.title,
      isFavorite: parsed.data.is_favorite,
      tags: parsed.data.tags,
      routingRules: parsed.data.routing_rules,
      deepLinks: parsed.data.deep_links,
      retargetingScripts: parsed.data.retargeting_scripts,
      landingMode: parsed.data.landing_mode,
      backgroundUrl: parsed.data.background_url,
      isActive: parsed.data.is_active
    });
    return NextResponse.json({ link: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update link" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const resolved = await params;
  try {
    const link = await getShortLinkById(resolved.id);
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await deleteShortLink(resolved.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete link" },
      { status: 500 }
    );
  }
}

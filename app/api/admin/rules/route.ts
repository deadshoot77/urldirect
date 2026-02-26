import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { deleteRedirectRule, listRedirectRules, upsertRedirectRule } from "@/lib/db";
import { redirectRuleInputSchema, slugSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  try {
    const rules = await listRedirectRules();
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsed = redirectRuleInputSchema.safeParse(payload);

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
    await upsertRedirectRule({
      slug: parsed.data.slug,
      targetUrl: parsed.data.target_url,
      statusCode: parsed.data.status_code,
      isActive: parsed.data.is_active,
      pixelEnabled: parsed.data.pixel_enabled,
      pixelType: parsed.data.pixel_enabled ? parsed.data.pixel_type ?? null : null,
      pixelConfig:
        parsed.data.pixel_enabled && parsed.data.pixel_config
          ? JSON.stringify(parsed.data.pixel_config)
          : null
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const querySlug = request.nextUrl.searchParams.get("slug");
  const body = await request.json().catch(() => null);
  const bodySlug = typeof body?.slug === "string" ? body.slug : null;
  const parsed = slugSchema.safeParse(querySlug ?? bodySlug);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    await deleteRedirectRule(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete rule" },
      { status: 500 }
    );
  }
}

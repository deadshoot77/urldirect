import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getAdminSettings, updateAdminSettings } from "@/lib/links";
import { adminSettingsPatchSchema } from "@/lib/validation";

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
    const settings = await getAdminSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsed = adminSettingsPatchSchema.safeParse(payload);
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
    await updateAdminSettings({
      trackingEnabled: parsed.data.tracking_enabled,
      landingEnabled: parsed.data.landing_enabled,
      globalBackgroundUrl: parsed.data.global_background_url
    });
    const settings = await getAdminSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}

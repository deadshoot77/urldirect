import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getLinksRedirectSummaries } from "@/lib/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const rawIds = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = rawIds
    .split(",")
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ stats: {} });
  }

  try {
    const stats = await getLinksRedirectSummaries(ids);
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch link stats" },
      { status: 500 }
    );
  }
}

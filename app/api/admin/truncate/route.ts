import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { truncateTrackingTable, type TruncatableTable } from "@/lib/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TABLES: TruncatableTable[] = ["logs", "click_events"];

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const payload = (await request.json().catch(() => null)) as { table?: unknown } | null;
  const table = payload?.table;

  if (typeof table !== "string" || !ALLOWED_TABLES.includes(table as TruncatableTable)) {
    return NextResponse.json(
      { error: `Invalid table. Must be one of: ${ALLOWED_TABLES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const deleted = await truncateTrackingTable(table as TruncatableTable);
    return NextResponse.json({ ok: true, table, deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to truncate ${table}` },
      { status: 500 }
    );
  }
}

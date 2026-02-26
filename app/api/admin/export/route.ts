import { NextResponse, type NextRequest } from "next/server";
import { getLogsForCsv } from "@/lib/analytics";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(input: string | null, fallback: Date): Date {
  if (!input) return fallback;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
}

function escapeCsv(value: string | number): string {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 30);

  const from = parseDate(request.nextUrl.searchParams.get("from"), defaultFrom);
  const to = parseDate(request.nextUrl.searchParams.get("to"), now);
  const fromDate = from <= to ? from : to;
  const toDate = to >= from ? to : from;

  try {
    const rows = await getLogsForCsv(fromDate.toISOString(), toDate.toISOString());
    const header = [
      "created_at",
      "slug",
      "target_url",
      "status_code",
      "ip_hash",
      "referer",
      "referer_domain",
      "country",
      "device_type",
      "user_agent",
      "query_string"
    ];

    const lines = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.createdAt,
          row.slug,
          row.targetUrl,
          row.statusCode,
          row.ipHash,
          row.referer,
          row.refererDomain,
          row.country,
          row.deviceType,
          row.userAgent,
          row.queryString
        ]
          .map(escapeCsv)
          .join(",")
      )
    ];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="redirect-logs-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export logs" },
      { status: 500 }
    );
  }
}

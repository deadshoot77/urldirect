import type { NextRequest } from "next/server";
import { handleRedirectRequest } from "@/lib/redirect-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRedirectRequest(request, null);
}

export async function HEAD(request: NextRequest) {
  return handleRedirectRequest(request, null);
}

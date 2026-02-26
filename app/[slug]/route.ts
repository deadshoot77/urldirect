import type { NextRequest } from "next/server";
import { handleRedirectRequest } from "@/lib/redirect-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SlugParams {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(request: NextRequest, { params }: SlugParams) {
  const resolved = await params;
  return handleRedirectRequest(request, resolved.slug);
}

export async function HEAD(request: NextRequest, { params }: SlugParams) {
  const resolved = await params;
  return handleRedirectRequest(request, resolved.slug);
}

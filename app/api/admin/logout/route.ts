import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, buildAuthCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...buildAuthCookieOptions(),
    maxAge: 0
  });
  return response;
}

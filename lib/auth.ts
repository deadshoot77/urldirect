import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export const ADMIN_COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const jwtSecret = new TextEncoder().encode(env.AUTH_SECRET);

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function verifyPassword(password: string): boolean {
  const incoming = sha256(password);
  const expected = sha256(env.ADMIN_PASSWORD);
  return timingSafeEqual(incoming, expected);
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(jwtSecret);
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, jwtSecret, {
      algorithms: ["HS256"]
    });
    return true;
  } catch {
    return false;
  }
}

export function buildAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS
  };
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

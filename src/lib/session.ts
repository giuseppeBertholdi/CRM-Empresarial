import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export function getSessionFromRequest(request: NextRequest) {
  const cookieName = process.env.AUTH_COOKIE_NAME ?? "crm_session";
  const token = request.cookies.get(cookieName)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const cookieName = process.env.AUTH_COOKIE_NAME ?? "crm_session";
  const token = cookieStore.get(cookieName)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  return session;
}

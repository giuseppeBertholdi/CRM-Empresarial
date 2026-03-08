import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieConfig } from "@/lib/auth";
import { getSessionFromRequest } from "@/lib/session";
import { logAction } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  const { name } = getSessionCookieConfig();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  if (session) {
    await logAction({
      userId: session.userId,
      action: "AUTH_LOGOUT",
      entity: "AUTH",
    });
  }

  return response;
}

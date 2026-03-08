import jwt from "jsonwebtoken";
import { env } from "@/lib/env";
import { ROLES } from "@/lib/constants";

export type SessionRole = (typeof ROLES)[number];

export type SessionPayload = {
  userId: string;
  email: string;
  role: SessionRole;
  departmentId: string | null;
  name: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionCookieConfig() {
  return {
    name: env.AUTH_COOKIE_NAME,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

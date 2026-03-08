import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookieName = process.env.AUTH_COOKIE_NAME ?? "crm_session";
  const hasSessionCookie = Boolean(request.cookies.get(cookieName)?.value);

  if (!hasSessionCookie && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSessionCookie && isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};

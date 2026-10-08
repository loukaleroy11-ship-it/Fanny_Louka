import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PAGES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const COOKIE = "lingua_session";

async function hasValidSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF defence in depth (cookies are SameSite=Lax): state-changing API calls must come from our own origin.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/")) return NextResponse.next(); // routes enforce auth themselves

  const authed = await hasValidSession(req);
  if (PUBLIC_PAGES.includes(pathname)) {
    if (authed && pathname !== "/reset-password") return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }
  if (!authed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};

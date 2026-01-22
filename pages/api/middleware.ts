import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const LOGIN_PAGE = "/login";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public files and login page without auth
  if (
    pathname.startsWith("/_next") || // static assets
    pathname === LOGIN_PAGE ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check if cookie "token" exists (replace with your auth cookie name)
  const token = request.cookies.get("token");

  if (!token) {
    // Redirect to login if not authenticated
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PAGE;
    url.searchParams.set("from", pathname); // optional: to redirect back after login
    return NextResponse.redirect(url);
  }

  // Otherwise allow access
  return NextResponse.next();
}

// Apply to all routes except public files and login
export const config = {
  matcher: ["/roles/:path*", "/api/:path*"], // adjust paths to protect
};

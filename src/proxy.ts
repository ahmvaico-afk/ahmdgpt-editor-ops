import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const adminMatch = pathname.match(/^\/admin\/(dashboard|styles|editors)/);
  if (adminMatch) {
    if (!session || session.role !== "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  const portalMatch = pathname.match(/^\/portal\/([^/]+)\/dashboard/);
  if (portalMatch) {
    const editorCode = decodeURIComponent(portalMatch[1]).toLowerCase();
    if (!session || session.role !== "editor" || session.editorCode !== editorCode) {
      return NextResponse.redirect(new URL(`/portal/${portalMatch[1]}`, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};

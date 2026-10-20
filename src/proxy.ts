import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Every admin page that isn't the login itself. Pages also guard themselves,
  // but keeping this list current means an unauthenticated hit never renders.
  const adminMatch = pathname.match(
    /^\/admin\/(dashboard|styles|editors|reel|totals|invoices|leaderboard|meters|work-time|covers|applicants|rules|briefs)/
  );
  if (adminMatch) {
    if (!session || session.role !== "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  const portalMatch = pathname.match(/^\/portal\/([^/]+)\/(dashboard|invoice|leaderboard|swipe-lab|rules|briefs)/);
  if (portalMatch) {
    const editorCode = decodeURIComponent(portalMatch[1]).toLowerCase();
    if (!session || session.role !== "editor" || session.editorCode !== editorCode) {
      return NextResponse.redirect(new URL(`/portal/${portalMatch[1]}`, request.url));
    }
    return NextResponse.next();
  }

  // Static tools built into public/tools/* — any logged-in editor or the admin.
  if (pathname.startsWith("/tools/")) {
    if (!session) {
      return new NextResponse("Please log in to the AHMD.GPT portal first.", { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/tools/:path*"],
};

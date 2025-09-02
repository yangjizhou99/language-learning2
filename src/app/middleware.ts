import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // 放行管理员开通页面
  if (pathname === "/admin/setup") return NextResponse.next();

  // 允许携带的任一凭证
  const hasAuthHeader = !!req.headers.get("authorization");
  const hasSbCookie = !!req.cookies.get("sb-access-token")?.value;
  if (hasAuthHeader || hasSbCookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };



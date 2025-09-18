import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 只处理管理员路由
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  // 放行管理员开通页面
  if (pathname === '/admin/setup') return NextResponse.next();

  // 检查认证状态
  const hasAuthHeader = !!req.headers.get('authorization');
  const hasSbCookie = !!req.cookies.get('sb-access-token')?.value;

  // 如果有认证信息，允许访问
  if (hasAuthHeader || hasSbCookie) {
    return NextResponse.next();
  }

  // 没有认证信息，重定向到登录页面
  const url = req.nextUrl.clone();
  url.pathname = '/auth';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};

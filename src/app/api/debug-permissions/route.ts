import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions } from '@/lib/user-permissions-server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 获取用户权限
    const permissions = await getUserPermissions(userId);

    // 测试权限检查
    const testResult = {
      can_access_shadowing: permissions.can_access_shadowing,
      allowed_languages: permissions.allowed_languages,
      allowed_levels: permissions.allowed_levels,
      hasPermissionForZh: permissions.allowed_languages.includes('zh'),
      hasPermissionForLevel2: permissions.allowed_levels.includes(2),
      permissionsObject: permissions,
    };

    return NextResponse.json({
      success: true,
      permissions,
      testResult,
    });
  } catch (error) {
    console.error('Debug permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

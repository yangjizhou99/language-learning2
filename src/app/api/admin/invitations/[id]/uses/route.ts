import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getInvitationUses } from '@/lib/invitation';

// GET /api/admin/invitations/[id]/uses - 获取邀请码使用记录
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const { id } = await params;
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!id) {
      return NextResponse.json({ error: '邀请码ID不能为空' }, { status: 400 });
    }

    const result = await getInvitationUses(id, page, limit);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    console.error('获取邀请码使用记录失败:', error);
    return NextResponse.json({ error: '获取邀请码使用记录时发生错误' }, { status: 500 });
  }
}

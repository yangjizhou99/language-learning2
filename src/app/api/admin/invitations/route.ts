import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  createInvitationCode,
  getInvitationCodes,
  updateInvitationCode,
  deleteInvitationCode,
} from '@/lib/invitation';
import type { CreateInvitationRequest, UpdateInvitationRequest } from '@/types/invitation';

// GET /api/admin/invitations - 获取邀请码列表
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const createdBy = url.searchParams.get('created_by') || undefined;

    const result = await getInvitationCodes(page, limit, createdBy, adminCheck.supabase);

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
    console.error('获取邀请码列表失败:', error);
    return NextResponse.json({ error: '获取邀请码列表时发生错误' }, { status: 500 });
  }
}

// POST /api/admin/invitations - 创建邀请码
export async function POST(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const body: CreateInvitationRequest = await req.json();

    // 验证必填字段
    if (!body.max_uses || body.max_uses < 1) {
      return NextResponse.json({ error: '最大使用次数必须大于0' }, { status: 400 });
    }

    // 使用service role key绕过RLS
    const result = await createInvitationCode(body, adminCheck.user.id, adminCheck.supabase);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: '邀请码创建成功',
    });
  } catch (error) {
    console.error('创建邀请码失败:', error);
    return NextResponse.json({ error: '创建邀请码时发生错误' }, { status: 500 });
  }
}

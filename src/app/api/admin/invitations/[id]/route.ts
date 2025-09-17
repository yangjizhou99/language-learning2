import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { updateInvitationCode, deleteInvitationCode } from '@/lib/invitation';
import type { UpdateInvitationRequest } from '@/types/invitation';

// PUT /api/admin/invitations/[id] - 更新邀请码
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 }
      );
    }

    const body: UpdateInvitationRequest = await req.json();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: '邀请码ID不能为空' }, { status: 400 });
    }

    // 验证max_uses字段
    if (body.max_uses !== undefined && body.max_uses < 1) {
      return NextResponse.json(
        { error: '最大使用次数必须大于0' },
        { status: 400 }
      );
    }

    const result = await updateInvitationCode(id, body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: '邀请码更新成功'
    });
  } catch (error) {
    console.error('更新邀请码失败:', error);
    return NextResponse.json(
      { error: '更新邀请码时发生错误' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/invitations/[id] - 删除邀请码
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: '邀请码ID不能为空' }, { status: 400 });
    }

    const result = await deleteInvitationCode(id);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '邀请码删除成功'
    });
  } catch (error) {
    console.error('删除邀请码失败:', error);
    return NextResponse.json(
      { error: '删除邀请码时发生错误' },
      { status: 500 }
    );
  }
}

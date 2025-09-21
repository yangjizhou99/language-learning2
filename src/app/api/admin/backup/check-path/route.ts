import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { backupPath } = await req.json();

    if (!backupPath) {
      return NextResponse.json({ 
        error: '备份路径不能为空',
        suggestions: [
          '请提供有效的备份路径',
          '例如: /tmp/backups 或 C:\\backups'
        ]
      }, { status: 400 });
    }

    const results = {
      path: backupPath,
      exists: false,
      writable: false,
      isDirectory: false,
      permissions: null as any,
      suggestions: [] as string[],
      alternativePaths: [] as string[]
    };

    try {
      // 检查路径是否存在
      const stats = await fsPromises.stat(backupPath);
      results.exists = true;
      results.isDirectory = stats.isDirectory();
      
      if (!stats.isDirectory()) {
        results.suggestions.push('指定路径不是目录，请提供目录路径');
        return NextResponse.json({ 
          success: false, 
          ...results 
        });
      }
    } catch (err) {
      // 路径不存在，尝试创建
      try {
        await fsPromises.mkdir(backupPath, { recursive: true });
        results.exists = true;
        results.isDirectory = true;
        results.suggestions.push('目录创建成功');
      } catch (createErr) {
        results.suggestions.push(`无法创建目录: ${createErr instanceof Error ? createErr.message : '未知错误'}`);
        
        // 提供替代路径建议
        const alternatives = getAlternativePaths(backupPath);
        results.alternativePaths = alternatives;
        
        return NextResponse.json({ 
          success: false, 
          ...results 
        });
      }
    }

    // 检查写入权限
    try {
      const testFile = path.join(backupPath, '.backup-test-' + Date.now());
      await fsPromises.writeFile(testFile, 'test');
      await fsPromises.unlink(testFile);
      results.writable = true;
    } catch (err) {
      results.writable = false;
      results.suggestions.push(`目录无写入权限: ${err instanceof Error ? err.message : '未知错误'}`);
      
      // 提供权限修复建议
      results.suggestions.push('请检查目录权限，确保应用有写入权限');
      results.suggestions.push('在 Linux/Mac 上可以尝试: chmod 755 ' + backupPath);
      results.suggestions.push('在 Windows 上请以管理员身份运行或更改文件夹权限');
    }

    // 获取权限信息
    try {
      const stats = await fsPromises.stat(backupPath);
      results.permissions = {
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
        size: stats.size,
        mtime: stats.mtime
      };
    } catch (err) {
      // 忽略权限获取错误
    }

    return NextResponse.json({ 
      success: results.exists && results.writable,
      ...results 
    });

  } catch (error) {
    console.error('检查备份路径失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `检查备份路径失败: ${error instanceof Error ? error.message : '未知错误'}`,
        suggestions: [
          '请检查路径格式是否正确',
          '确保应用有访问该路径的权限',
          '尝试使用绝对路径'
        ]
      },
      { status: 500 }
    );
  }
}

function getAlternativePaths(originalPath: string): string[] {
  const alternatives: string[] = [];
  
  try {
    // 获取系统临时目录
    const tmpDir = os.tmpdir();
    alternatives.push(path.join(tmpDir, 'backups'));
    alternatives.push(path.join(tmpDir, 'language-learning-backups'));
    
    // 获取用户主目录
    const homeDir = os.homedir();
    alternatives.push(path.join(homeDir, 'backups'));
    alternatives.push(path.join(homeDir, 'language-learning-backups'));
    
    // 如果是相对路径，尝试转换为绝对路径
    if (!path.isAbsolute(originalPath)) {
      alternatives.push(path.resolve(originalPath));
    }
    
    // 添加当前工作目录的子目录
    alternatives.push(path.join(process.cwd(), 'backups'));
    alternatives.push(path.join(process.cwd(), 'data', 'backups'));
    
    // 添加一些常见的服务器路径
    alternatives.push('/var/backups');
    alternatives.push('/opt/backups');
    alternatives.push('/home/backups');
    alternatives.push('./backups');
    alternatives.push('../backups');
    
  } catch (err) {
    // 如果获取系统路径失败，提供一些通用建议
    alternatives.push('/tmp/backups');
    alternatives.push('./backups');
    alternatives.push('../backups');
  }
  
  return alternatives;
}

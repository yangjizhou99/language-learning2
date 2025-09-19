import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

async function getAllFilesFromBucket(supabase: any, bucketName: string, prefix: string = ''): Promise<string[]> {
  const allFiles: string[] = [];
  
  try {
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(prefix, { 
        limit: 1000, 
        sortBy: { column: 'name', order: 'asc' },
        offset: 0
      });

    if (error) {
      console.error(`获取存储桶 ${bucketName} 文件列表失败:`, error);
      return allFiles;
    }

    if (files) {
      for (const file of files) {
        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
        
        if (file.metadata && file.metadata.size !== undefined) {
          // 这是一个文件
          allFiles.push(fullPath);
        } else {
          // 这可能是一个目录，递归获取
          const subFiles = await getAllFilesFromBucket(supabase, bucketName, fullPath);
          allFiles.push(...subFiles);
        }
      }
    }
  } catch (err) {
    console.error(`递归获取存储桶 ${bucketName} 文件失败:`, err);
  }
  
  return allFiles;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

    // 获取所有存储桶
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      return NextResponse.json({ 
        error: '获取存储桶列表失败', 
        details: bucketsError 
      }, { status: 500 });
    }

    const bucketDetails = [];

    // 检查每个存储桶
    for (const bucket of buckets) {
      try {
        console.log(`检查存储桶: ${bucket.name}`);
        
        // 使用简单方式获取文件列表
        const { data: simpleFiles, error: simpleError } = await supabase.storage
          .from(bucket.name)
          .list('', { limit: 1000 });

        // 使用递归方式获取文件列表
        const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');

        bucketDetails.push({
          name: bucket.name,
          public: bucket.public,
          simpleFileCount: simpleFiles?.length || 0,
          recursiveFileCount: allFiles.length,
          simpleFiles: simpleFiles?.slice(0, 10) || [], // 只显示前10个
          allFiles: allFiles.slice(0, 20), // 只显示前20个
          simpleError: simpleError,
        });
      } catch (err) {
        bucketDetails.push({
          name: bucket.name,
          error: err instanceof Error ? err.message : '未知错误'
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalBuckets: buckets.length,
      buckets: bucketDetails,
      summary: {
        totalFiles: bucketDetails.reduce((sum, bucket) => sum + (bucket.recursiveFileCount || 0), 0),
        bucketsWithFiles: bucketDetails.filter(bucket => (bucket.recursiveFileCount || 0) > 0).length
      }
    });

  } catch (error) {
    console.error('测试存储桶失败:', error);
    return NextResponse.json(
      { error: '测试失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

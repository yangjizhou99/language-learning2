import { NextRequest, NextResponse } from 'next/server';
import { CacheManager } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 测试实际API缓存效果
    const testResults = [];
    
    // 1. 测试Shadowing API缓存
    const shadowingKey = CacheManager.generateKey("shadowing:next", { lang: "en", level: 2 });
    
    // 清除现有缓存
    await CacheManager.delete(shadowingKey);
    
    // 第一次调用（应该缓存未命中）
    const start1 = performance.now();
    const response1 = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shadowing/next?lang=en&level=2`);
    const duration1 = performance.now() - start1;
    const data1 = await response1.json();
    
    // 第二次调用（应该缓存命中）
    const start2 = performance.now();
    const response2 = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shadowing/next?lang=en&level=2`);
    const duration2 = performance.now() - start2;
    const data2 = await response2.json();
    
    // 检查缓存
    const cached = await CacheManager.get(shadowingKey);
    
    testResults.push({
      api: 'shadowing:next',
      firstCall: { duration: duration1, status: response1.status },
      secondCall: { duration: duration2, status: response2.status },
      cacheHit: !!cached,
      performanceImprovement: ((duration1 - duration2) / duration1 * 100).toFixed(1) + '%',
      cacheKey: shadowingKey
    });
    
    // 2. 测试Cloze API缓存
    const clozeKey = CacheManager.generateKey("cloze:next", { lang: "en", level: 2 });
    await CacheManager.delete(clozeKey);
    
    const start3 = performance.now();
    const response3 = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cloze/next?lang=en&level=2`);
    const duration3 = performance.now() - start3;
    
    const start4 = performance.now();
    const response4 = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cloze/next?lang=en&level=2`);
    const duration4 = performance.now() - start4;
    
    const cached2 = await CacheManager.get(clozeKey);
    
    testResults.push({
      api: 'cloze:next',
      firstCall: { duration: duration3, status: response3.status },
      secondCall: { duration: duration4, status: response4.status },
      cacheHit: !!cached2,
      performanceImprovement: ((duration3 - duration4) / duration3 * 100).toFixed(1) + '%',
      cacheKey: clozeKey
    });
    
    // 3. 获取详细缓存统计
    const stats = CacheManager.getStats();
    
    // 4. 检查所有缓存键
    const allKeys = Array.from((CacheManager as any).memoryCache['cache'].keys());
    
    return NextResponse.json({
      success: true,
      analysis: {
        testResults,
        stats,
        allKeys,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

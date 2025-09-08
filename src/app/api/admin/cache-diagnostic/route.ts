import { NextRequest, NextResponse } from 'next/server';
import { CacheManager } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 测试缓存基本功能
    const testKey = 'test:cache:diagnostic';
    const testData = { 
      timestamp: Date.now(), 
      message: 'Cache diagnostic test',
      random: Math.random()
    };

    // 1. 测试设置缓存
    await CacheManager.set(testKey, testData, 60);
    
    // 2. 测试获取缓存
    const retrieved = await CacheManager.get(testKey);
    
    // 3. 获取缓存统计
    const stats = CacheManager.getStats();
    
    // 4. 测试缓存键生成
    const generatedKey = CacheManager.generateKey('test', { lang: 'en', level: 2 });
    
    // 5. 测试请求去重
    const dedupeResult = await CacheManager.dedupe('test:dedupe', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { result: 'dedupe test', timestamp: Date.now() };
    });

    return NextResponse.json({
      success: true,
      diagnostic: {
        cacheSet: true,
        cacheGet: retrieved !== null,
        retrievedData: retrieved,
        originalData: testData,
        dataMatch: JSON.stringify(retrieved) === JSON.stringify(testData),
        stats,
        generatedKey,
        dedupeResult,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, key, value, ttl } = await req.json();

    switch (action) {
      case 'set':
        await CacheManager.set(key, value, ttl || 300);
        return NextResponse.json({ success: true, message: 'Cache set successfully' });
      
      case 'get':
        const result = await CacheManager.get(key);
        return NextResponse.json({ success: true, result });
      
      case 'delete':
        await CacheManager.delete(key);
        return NextResponse.json({ success: true, message: 'Cache deleted successfully' });
      
      case 'clear':
        await CacheManager.clear();
        return NextResponse.json({ success: true, message: 'Cache cleared successfully' });
      
      case 'stats':
        const stats = CacheManager.getStats();
        return NextResponse.json({ success: true, stats });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { CacheManager } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 测试用例配置
const TEST_CASES = {
  database: [
    {
      name: 'Shadowing题目查询',
      query: async (supabase: any) => {
        const start = performance.now();
        const { data, error } = await supabase
          .from('shadowing_items')
          .select('*')
          .eq('lang', 'en')
          .eq('level', 2)
          .order('created_at', { ascending: false })
          .limit(10);
        const duration = performance.now() - start;
        
        if (error) throw error;
        return { duration, recordCount: data?.length || 0, success: true };
      }
    },
    {
      name: 'Cloze题目查询',
      query: async (supabase: any) => {
        const start = performance.now();
        const { data, error } = await supabase
          .from('cloze_items')
          .select('*')
          .eq('lang', 'en')
          .eq('level', 2)
          .order('created_at', { ascending: false })
          .limit(10);
        const duration = performance.now() - start;
        
        if (error) throw error;
        return { duration, recordCount: data?.length || 0, success: true };
      }
    },
    {
      name: '用户练习记录查询',
      query: async (supabase: any) => {
        const start = performance.now();
        const { data, error } = await supabase
          .from('shadowing_attempts')
          .select('*')
          .eq('lang', 'en')
          .order('created_at', { ascending: false })
          .limit(20);
        const duration = performance.now() - start;
        
        if (error) throw error;
        return { duration, recordCount: data?.length || 0, success: true };
      }
    },
    {
      name: '文章草稿状态查询',
      query: async (supabase: any) => {
        const start = performance.now();
        const { data, error } = await supabase
          .from('article_drafts')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(10);
        const duration = performance.now() - start;
        
        if (error) throw error;
        return { duration, recordCount: data?.length || 0, success: true };
      }
    }
  ],
  api: [
    {
      name: 'Shadowing下一题API',
      query: async () => {
        const start = performance.now();
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shadowing/next?lang=en&level=2`);
        const duration = performance.now() - start;
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { duration, success: true, dataSize: JSON.stringify(data).length };
      }
    },
    {
      name: 'Cloze下一题API',
      query: async () => {
        const start = performance.now();
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cloze/next?lang=en&level=2`);
        const duration = performance.now() - start;
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { duration, success: true, dataSize: JSON.stringify(data).length };
      }
    }
  ],
  cache: [
    {
      name: '缓存命中率测试',
      query: async () => {
        const cacheKey = 'test:cache:hit-rate';
        const testData = { timestamp: Date.now(), data: 'test' };
        
        // 设置缓存
        await CacheManager.set(cacheKey, testData, 60);
        
        // 测试缓存命中
        const start = performance.now();
        const cached = await CacheManager.get(cacheKey);
        const duration = performance.now() - start;
        
        return { 
          duration, 
          success: !!cached, 
          hitRate: cached ? 100 : 0,
          cacheStats: CacheManager.getStats()
        };
      }
    }
  ]
};

export async function POST(req: NextRequest) {
  try {
    const { testType, testName } = await req.json();
    
    if (!testType || !testName) {
      return NextResponse.json({ error: 'Missing testType or testName' }, { status: 400 });
    }

    const testCase = TEST_CASES[testType as keyof typeof TEST_CASES]?.find(
      test => test.name === testName
    );

    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const startTime = Date.now();
    let result;

    try {
      if (testType === 'database') {
        const supabase = getServiceSupabase();
        result = await (testCase.query as any)(supabase);
      } else {
        result = await (testCase.query as any)();
      }

      const totalDuration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        testName,
        testType,
        duration: totalDuration,
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      return NextResponse.json({
        success: false,
        testName,
        testType,
        duration: totalDuration,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error', 
      detail: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testType = searchParams.get('type');
    const runAll = searchParams.get('runAll') === 'true';

    if (runAll) {
      // 运行所有测试
      const results = [];
      
      for (const [type, tests] of Object.entries(TEST_CASES)) {
        for (const test of tests) {
          const startTime = Date.now();
          let result;
          
          try {
            if (type === 'database') {
              const supabase = getServiceSupabase();
              result = await (test.query as any)(supabase);
            } else {
              result = await (test.query as any)();
            }
            
            results.push({
              testType: type,
              testName: test.name,
              success: true,
              duration: Date.now() - startTime,
              result,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            results.push({
              testType: type,
              testName: test.name,
              success: false,
              duration: Date.now() - startTime,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: results.length,
          passed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
        }
      });
    }

    if (testType) {
      // 返回特定类型的测试用例
      const tests = TEST_CASES[testType as keyof typeof TEST_CASES] || [];
      return NextResponse.json({
        success: true,
        testType,
        tests: tests.map(test => ({ name: test.name }))
      });
    }

    // 返回所有可用的测试类型
    return NextResponse.json({
      success: true,
      testTypes: Object.keys(TEST_CASES).map(type => ({
        type,
        testCount: TEST_CASES[type as keyof typeof TEST_CASES].length
      }))
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error', 
      detail: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

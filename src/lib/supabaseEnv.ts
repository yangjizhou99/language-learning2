import { createClient } from '@supabase/supabase-js';

export type DatabaseType = 'local' | 'prod' | 'supabase';

export function getSupabaseFor(databaseType: DatabaseType) {
  let url: string | undefined;
  let serviceKey: string | undefined;

  if (databaseType === 'prod') {
    // 使用生产环境的 Supabase 配置
    url = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;
  } else if (databaseType === 'local') {
    // 使用本地环境的 Supabase 配置（实际上就是默认配置）
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    // databaseType === 'supabase' 使用默认的本地 Supabase 配置
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!url || !serviceKey) {
    const envType = databaseType === 'prod' ? '生产环境' : databaseType === 'local' ? '本地环境' : '默认环境';
    throw new Error(`${envType} Supabase 环境变量缺失：请检查 ${databaseType === 'prod' ? 'NEXT_PUBLIC_SUPABASE_URL_PROD 和 SUPABASE_SERVICE_ROLE_KEY_PROD' : 'NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY'}`);
  }

  const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
  const envName = databaseType === 'prod' ? '生产环境' : isLocal ? '本地环境' : '云端环境';
  console.log(`使用 ${envName} Supabase: ${url}`);

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}



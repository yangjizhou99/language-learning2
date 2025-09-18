"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TestEnvPage() {
  // 从环境变量读取配置
  const localDbUrl = process.env.NEXT_PUBLIC_LOCAL_DB_URL || process.env.LOCAL_DB_URL || '未设置';
  const prodDbUrl = process.env.NEXT_PUBLIC_PROD_DB_URL || process.env.PROD_DB_URL || '未设置';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '未设置';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '未设置';

  // 解析数据库URL
  const parseDbUrl = (url: string) => {
    if (url === '未设置') return null;
    try {
      const urlObj = new URL(url);
      return {
        host: urlObj.hostname,
        port: parseInt(urlObj.port) || 5432,
        database: urlObj.pathname.slice(1),
        username: urlObj.username,
        password: urlObj.password ? '***' : '无',
        ssl: urlObj.searchParams.get('sslmode') === 'require'
      };
    } catch (error) {
      return null;
    }
  };

  const localDbInfo = parseDbUrl(localDbUrl);
  const prodDbInfo = parseDbUrl(prodDbUrl);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">环境变量测试</h1>
        <p className="text-gray-600">检查环境变量是否正确读取</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 本地数据库 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">本地数据库 (LOCAL_DB_URL)</CardTitle>
            <CardDescription>源数据库配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">状态:</span>
                <Badge variant={localDbInfo ? "default" : "destructive"} className="ml-2">
                  {localDbInfo ? "已配置" : "未配置"}
                </Badge>
              </div>
              {localDbInfo ? (
                <>
                  <div className="text-sm">
                    <span className="text-gray-600">主机:</span>
                    <span className="ml-2 font-mono">{localDbInfo.host}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">端口:</span>
                    <span className="ml-2 font-mono">{localDbInfo.port}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">数据库:</span>
                    <span className="ml-2 font-mono">{localDbInfo.database}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">用户名:</span>
                    <span className="ml-2 font-mono">{localDbInfo.username}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">SSL:</span>
                    <span className="ml-2 font-mono">{localDbInfo.ssl ? '启用' : '禁用'}</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-600">
                  无法解析数据库URL: {localDbUrl}
                </div>
              )}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 font-mono break-all">
                {localDbUrl}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 远程数据库 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">远程数据库 (PROD_DB_URL)</CardTitle>
            <CardDescription>目标数据库配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">状态:</span>
                <Badge variant={prodDbInfo ? "default" : "destructive"} className="ml-2">
                  {prodDbInfo ? "已配置" : "未配置"}
                </Badge>
              </div>
              {prodDbInfo ? (
                <>
                  <div className="text-sm">
                    <span className="text-gray-600">主机:</span>
                    <span className="ml-2 font-mono">{prodDbInfo.host}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">端口:</span>
                    <span className="ml-2 font-mono">{prodDbInfo.port}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">数据库:</span>
                    <span className="ml-2 font-mono">{prodDbInfo.database}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">用户名:</span>
                    <span className="ml-2 font-mono">{prodDbInfo.username}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">SSL:</span>
                    <span className="ml-2 font-mono">{prodDbInfo.ssl ? '启用' : '禁用'}</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-600">
                  无法解析数据库URL: {prodDbUrl}
                </div>
              )}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 font-mono break-all">
                {prodDbUrl}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supabase配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">Supabase配置</CardTitle>
            <CardDescription>存储和认证配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">URL状态:</span>
                <Badge variant={supabaseUrl !== '未设置' ? "default" : "destructive"} className="ml-2">
                  {supabaseUrl !== '未设置' ? "已配置" : "未配置"}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">密钥状态:</span>
                <Badge variant={supabaseKey !== '未设置' ? "default" : "destructive"} className="ml-2">
                  {supabaseKey !== '未设置' ? "已配置" : "未配置"}
                </Badge>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600">NEXT_PUBLIC_SUPABASE_URL</div>
                <div className="text-xs text-gray-800 font-mono break-all mt-1">
                  {supabaseUrl}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
                <div className="text-xs text-gray-800 font-mono break-all mt-1">
                  {supabaseKey !== '未设置' ? `${supabaseKey.substring(0, 20)}...` : '未设置'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 环境变量列表 */}
        <Card>
          <CardHeader>
            <CardTitle>所有相关环境变量</CardTitle>
            <CardDescription>当前读取到的环境变量值</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800">LOCAL_DB_URL</div>
                <div className="text-xs text-green-600 font-mono break-all mt-1">
                  {localDbUrl}
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800">PROD_DB_URL</div>
                <div className="text-xs text-blue-600 font-mono break-all mt-1">
                  {prodDbUrl}
                </div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm font-medium text-purple-800">NEXT_PUBLIC_SUPABASE_URL</div>
                <div className="text-xs text-purple-600 font-mono break-all mt-1">
                  {supabaseUrl}
                </div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm font-medium text-purple-800">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
                <div className="text-xs text-purple-600 font-mono break-all mt-1">
                  {supabaseKey !== '未设置' ? `${supabaseKey.substring(0, 30)}...` : '未设置'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

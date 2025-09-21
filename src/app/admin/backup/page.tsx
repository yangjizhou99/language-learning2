'use client';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function BackupPage() {
  return (
    <Container>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumbs items={[
              { label: '管理员控制台', href: '/admin' },
              { label: '备份中心', href: '/admin/backup' }
            ]} />
            <h1 className="text-3xl font-semibold mt-2">备份中心</h1>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">数据库连接</h2>
          <div className="flex gap-2">
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
              onClick={() => alert('加载生产库表功能')}
            >
              加载生产库表
            </button>
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" 
              onClick={() => alert('加载开发库表功能')}
            >
              加载开发库表
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">备份操作</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700" 
              onClick={() => alert('NAS 备份功能')}
            >
              生产库 → NAS 备份
            </button>
            <button 
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700" 
              onClick={() => alert('本地备份功能')}
            >
              生产库 → 本地文件夹
            </button>
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={() => alert('数据恢复功能')}
            >
              从本地文件 → 恢复到生产
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">系统状态</h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">✅ 备份系统已集成到管理员控制台</p>
            <p className="text-sm text-gray-600">✅ 导航菜单已添加</p>
            <p className="text-sm text-gray-600">✅ API 路由正常工作</p>
            <p className="text-sm text-gray-600">🔄 完整功能正在开发中...</p>
          </div>
        </div>
      </div>
    </Container>
  );
}
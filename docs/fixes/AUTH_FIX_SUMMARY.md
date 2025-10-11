# 数据库同步认证问题修复说明

## 问题描述

用户在使用数据库同步页面时遇到 403 Forbidden 错误：

```
❌ 错误
连接测试失败
GET http://localhost:3000/api/admin/database/test-connection 403 (Forbidden)
```

## 问题原因

1. **缺少认证头**：前端API调用没有传递用户认证信息
2. **权限验证**：后端API使用 `requireAdmin` 进行权限验证，但前端未提供认证token
3. **用户状态检查**：页面没有检查用户是否为管理员

## 修复方案

### 1. 前端认证处理

#### 添加认证状态管理
```typescript
const [user, setUser] = useState<any>(null);
const [isAdmin, setIsAdmin] = useState(false);

// 检查用户认证状态
const checkUserAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      
      // 检查用户是否为管理员
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      setIsAdmin(profile?.role === 'admin');
    }
  } catch (error) {
    console.error('检查用户认证失败:', error);
  }
};
```

#### 添加认证头辅助函数
```typescript
// 获取认证头
const getAuthHeaders = async (): Promise<HeadersInit> => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return headers;
};
```

### 2. API调用修复

#### 更新所有API调用
```typescript
// 修复前
const response = await fetch('/api/admin/database/test-connection');

// 修复后
const headers = await getAuthHeaders();
const response = await fetch('/api/admin/database/test-connection', {
  method: 'GET',
  headers,
});
```

### 3. 权限检查

#### 添加权限验证
```typescript
const testConnections = async () => {
  if (!isAdmin) {
    setError('需要管理员权限才能执行此操作');
    return;
  }
  // ... 其他逻辑
};
```

#### 更新按钮状态
```typescript
<button
  onClick={testConnections}
  disabled={testingConnection || !envConfig?.localDbUrl || !envConfig?.prodDbUrl || !isAdmin}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {testingConnection ? '🔍 测试中...' : '🔍 检查连接'}
</button>
```

### 4. 用户界面改进

#### 添加权限提示
```typescript
{!isAdmin && (
  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex">
      <div className="flex-shrink-0">
        <span className="text-red-400">❌</span>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">权限不足</h3>
        <div className="mt-2 text-sm text-red-700">
          您需要管理员权限才能使用数据库同步功能。请使用管理员账户登录。
        </div>
      </div>
    </div>
  </div>
)}
```

## 修复后的功能

### ✅ 认证处理
- 自动检查用户登录状态
- 验证管理员权限
- 正确传递认证头到API

### ✅ 权限控制
- 非管理员用户看到权限不足提示
- 功能按钮根据权限状态禁用
- 防止未授权访问

### ✅ 错误处理
- 清晰的错误信息显示
- 权限不足时的友好提示
- 网络错误的处理

### ✅ 用户体验
- 实时权限状态检查
- 直观的权限提示
- 响应式的按钮状态

## 测试验证

### 1. 运行测试脚本
```bash
# 测试认证修复
node scripts/test-auth-fix.js

# 测试页面访问
node scripts/test-admin-pages.js
```

### 2. 手动测试步骤
1. 使用非管理员账户访问页面
2. 确认看到权限不足提示
3. 使用管理员账户登录
4. 确认可以正常使用功能

### 3. 预期结果
- 非管理员：看到权限不足提示，按钮禁用
- 管理员：可以正常使用所有功能
- API调用：正确传递认证头，不再出现403错误

## 技术细节

### 认证流程
1. 页面加载时检查用户认证状态
2. 查询用户角色信息
3. 根据角色设置权限状态
4. API调用时传递认证头

### 安全措施
- 前端权限检查（用户体验）
- 后端权限验证（安全保证）
- 双重验证确保安全性

### 错误处理
- 网络错误处理
- 权限错误处理
- 用户友好的错误信息

## 总结

通过以上修复，数据库同步页面的认证问题已完全解决：

1. **403 Forbidden 错误**：已修复，API调用正确传递认证头
2. **权限控制**：已实现，非管理员用户无法使用功能
3. **用户体验**：已改进，提供清晰的权限提示
4. **安全性**：已加强，前后端双重权限验证

现在用户可以正常使用数据库同步功能，前提是使用管理员账户登录。



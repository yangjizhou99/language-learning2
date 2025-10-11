# 页面加载卡住问题综合修复

## 涉及页面

- Shadowing 练习页面 (`/practice/shadowing`)
- 个人资料页面 (`/profile`)
- 单词本页面 (`/vocab`)

---

# Shadowing 页面加载卡住问题修复

## 问题描述

在访问 `http://localhost:3000/practice/shadowing?lang=ja&level=2&practiced=all` 时，题目列表有时会一直卡在加载状态，但刷新一下页面又能立即加载成功。不刷新就会一直卡住。

## 问题原因分析

通过代码审查发现以下问题：

### 1. **缺少请求超时处理**
- fetch 请求没有设置超时时间
- 如果服务器响应慢或网络问题，请求会一直挂起
- loading 状态一直为 true，界面显示为加载中

### 2. **缺少请求取消机制（AbortController）**
- 当筛选条件快速变化时，可能产生多个并发请求
- 旧的请求没有被取消，造成竞态条件
- 可能导致响应顺序混乱或请求堆积

### 3. **重复触发问题**
- 有两个 useEffect 都在调用 `fetchItems`：
  - 初始加载时触发（依赖 fetchItems, fetchRecommendedLevel, authLoading, user）
  - 筛选条件变化时触发（依赖 lang, level, practiced, authLoading, user, fetchItems）
- 由于 fetchItems 依赖筛选条件，筛选变化时会重新创建 fetchItems
- 这导致第一个 useEffect 也被触发，造成重复请求

### 4. **缓存处理不完善**
- 有缓存时设置了 items 但没有立即返回
- loading 状态要等到 finally 块才设置为 false

### 5. **错误处理不完善**
- 请求失败时只有 console.error，用户不知道发生了什么
- 没有区分超时错误和其他错误

## 优化方案

### 1. 添加 AbortController 和超时处理

```typescript
const fetchItems = useCallback(async () => {
  // 取消之前的请求
  if (abortRef.current) {
    try {
      abortRef.current.abort();
    } catch {}
  }
  
  const controller = new AbortController();
  abortRef.current = controller;
  
  // 设置请求超时（15秒）
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  setLoading(true);
  try {
    // ... 请求逻辑
    const response = await fetch(url, { 
      signal: controller.signal  // 添加 abort signal
    });
    // ...
  } catch (error: any) {
    // 区分不同类型的错误
    if (error.name === 'AbortError') {
      console.log('Request was cancelled or timed out');
    } else {
      console.error('Failed to fetch items:', error);
    }
    setItems([]);
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
    abortRef.current = null;
  }
}, [lang, level, practiced, getAuthHeaders]);
```

### 2. 改进缓存处理

```typescript
const cached = getCached<any>(key);
if (cached) {
  setItems(cached.items || []);
  setLoading(false);  // 立即设置为 false
  clearTimeout(timeoutId);
  return;  // 立即返回
}
```

### 3. 合并重复的 useEffect

将两个 useEffect 合并为一个，避免重复触发：

```typescript
// 加载题库（初始加载和筛选条件变化时）
useEffect(() => {
  // 等待认证完成且用户已登录
  if (authLoading || !user) return;
  
  // 防抖延迟，避免快速切换时多次请求
  const t = setTimeout(() => {
    fetchItems();
    // 只在初始加载时获取推荐等级（level为null时）
    if (level === null) {
      fetchRecommendedLevel();
    }
  }, 50);
  
  return () => clearTimeout(t);
  // 依赖筛选条件，确保条件变化时重新加载
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [lang, level, practiced, authLoading, user]);
```

### 4. 添加 abortRef 声明

```typescript
// 请求中止控制器
const abortRef = useRef<AbortController | null>(null);
```

### 5. 完善依赖数组

在 fetchItems 和 fetchRecommendedLevel 的 useCallback 中添加 getAuthHeaders 依赖：

```typescript
const fetchItems = useCallback(async () => {
  // ...
}, [lang, level, practiced, getAuthHeaders]);

const fetchRecommendedLevel = useCallback(async () => {
  // ...
}, [lang, user, getAuthHeaders]);
```

## 优化效果

1. **超时保护**：15秒后自动取消请求，避免无限等待
2. **请求取消**：筛选条件变化时取消旧请求，避免竞态条件
3. **避免重复**：合并 useEffect，避免同时触发多个请求
4. **更快响应**：使用缓存时立即返回，不等待网络
5. **更好的错误处理**：区分超时和其他错误，便于调试

## 测试建议

1. **正常场景**：访问页面，验证数据正常加载
2. **快速切换**：快速切换筛选条件（语言、等级、练习状态），验证不会卡住
3. **网络慢速**：使用开发者工具模拟慢速网络，验证超时机制
4. **网络断开**：断开网络，验证错误处理
5. **缓存验证**：重复访问相同条件，验证缓存命中

## 相关文件

- `src/components/shadowing/ChineseShadowingPage.tsx` - 主要修改文件

## 相关技术

- [AbortController API](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Fetch API - signal option](https://developer.mozilla.org/en-US/docs/Web/API/fetch#signal)
- [React useCallback](https://react.dev/reference/react/useCallback)
- [React useEffect](https://react.dev/reference/react/useEffect)

## 日期

2025-10-11

---

# 个人资料页面加载卡住问题修复

## 问题描述

个人资料页面 (`/profile`) 在加载用户资料时，有时会卡在加载状态。

## 问题原因

与 Shadowing 页面类似：
1. `loadProfile` 函数没有超时机制
2. 没有 AbortController 取消机制
3. Supabase 查询可能卡住
4. 错误处理不完善

## 优化方案

### 1. 添加 AbortController 和超时处理

```typescript
const loadProfile = async () => {
  // 取消之前的请求
  if (abortRef.current) {
    try {
      abortRef.current.abort();
    } catch {}
  }
  
  const controller = new AbortController();
  abortRef.current = controller;
  
  // 设置请求超时（10秒）
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    setLoading(true);

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // 检查是否被取消
    if (controller.signal.aborted) {
      return;
    }
    
    // ... 其他逻辑

    // 获取用户资料时使用 abortSignal
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .abortSignal(controller.signal)
      .single();

    // ... 处理结果
  } catch (error: any) {
    // 区分不同类型的错误
    if (error?.name === 'AbortError') {
      console.log('Profile loading was cancelled or timed out');
    } else {
      console.error('加载资料失败:', error);
      toast.error(t.profile.load_failed || t.common.error);
    }
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
    abortRef.current = null;
  }
};
```

### 2. 在所有 Supabase 查询中使用 abortSignal

```typescript
// 插入操作
await supabase
  .from('profiles')
  .insert({ id: user.id })
  .abortSignal(controller.signal);

// 查询操作
await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .abortSignal(controller.signal)
  .single();
```

## 优化效果

1. **超时保护**：10秒后自动取消请求
2. **请求取消**：多次快速访问时取消旧请求
3. **更好的错误处理**：区分超时和其他错误

---

# 单词本页面加载卡住问题修复

## 问题描述

单词本页面 (`/vocab`) 在加载生词列表时，有时会卡在加载状态。特别是在快速切换筛选条件时。

## 问题原因

1. `fetchEntries` 函数没有超时机制
2. 没有 AbortController 取消机制
3. filters 变化时通过 useEffect 触发，可能产生多个并发请求
4. 错误处理不区分超时和网络错误

## 优化方案

### 1. 添加 AbortController 和超时处理

```typescript
const fetchEntries = async (page = 1, limit = itemsPerPage, useCache = true) => {
  // 取消之前的请求
  if (abortRef.current) {
    try {
      abortRef.current.abort();
    } catch {}
  }
  
  const controller = new AbortController();
  abortRef.current = controller;
  
  // 设置请求超时（15秒）
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  setIsLoading(true);
  setError('');

  try {
    // ... 构建请求参数

    // 使用 signal 参数
    const response = await fetch(`/api/vocab/dashboard?${params}`, {
      headers,
      signal: controller.signal,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || t.vocabulary.messages.fetch_vocab_failed);
    }

    const data = await response.json();
    
    // 更新状态
    setEntries(data.entries);
    setPagination(data.pagination);
    setDueCount(data.stats.dueCount);
    setTomorrowCount(data.stats.tomorrowCount || 0);
    setStatsLoaded(true);
  } catch (err: any) {
    // 区分不同类型的错误
    if (err?.name === 'AbortError') {
      console.log('Vocab fetch was cancelled or timed out');
    } else {
      setError(err instanceof Error ? err.message : t.vocabulary.messages.fetch_vocab_failed);
    }
  } finally {
    clearTimeout(timeoutId);
    setIsLoading(false);
    abortRef.current = null;
  }
};
```

### 2. 优化 useEffect 触发逻辑

单词本页面已经有防抖机制，filters 变化时触发 fetchEntries：

```typescript
useEffect(() => {
  fetchUserProfile();
  fetchAvailableModels();
  fetchEntries();
}, [filters]); // filters 变化时重新加载
```

现在有了 AbortController，旧请求会被自动取消，避免竞态条件。

## 优化效果

1. **超时保护**：15秒后自动取消请求
2. **请求取消**：筛选条件变化时取消旧请求，避免竞态条件
3. **更好的错误处理**：区分超时和网络错误
4. **更快响应**：旧请求立即取消，新请求立即开始

---

# 综合优化总结

## 修改的文件

1. `src/components/shadowing/ChineseShadowingPage.tsx` - Shadowing 页面
2. `src/app/profile/page.tsx` - 个人资料页面
3. `src/app/vocab/page.tsx` - 单词本页面

## 通用优化模式

### 1. 添加 AbortController ref

```typescript
const abortRef = useRef<AbortController | null>(null);
```

### 2. 在数据加载函数中实现取消和超时

```typescript
const fetchData = async () => {
  // 取消旧请求
  if (abortRef.current) {
    try {
      abortRef.current.abort();
    } catch {}
  }
  
  const controller = new AbortController();
  abortRef.current = controller;
  
  // 设置超时
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    // 使用 signal
    const response = await fetch(url, {
      signal: controller.signal
    });
    // ... 处理响应
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled or timed out');
    } else {
      // 处理其他错误
    }
  } finally {
    clearTimeout(timeoutId);
    setLoading(false);
    abortRef.current = null;
  }
};
```

### 3. Supabase 查询使用 abortSignal

```typescript
await supabase
  .from('table')
  .select('*')
  .abortSignal(controller.signal);
```

## 测试建议

### 所有页面通用测试

1. **正常加载**：访问页面，验证数据正常加载
2. **快速切换**：快速切换筛选条件，验证不会卡住
3. **慢速网络**：使用 Chrome DevTools 模拟慢速 3G，验证超时机制
4. **网络断开**：断开网络，验证错误提示
5. **多次刷新**：快速多次刷新页面，验证旧请求被正确取消

### Shadowing 页面特定测试

- 测试语言、等级、练习状态筛选的快速切换
- 验证缓存功能正常工作

### 单词本页面特定测试

- 测试翻页功能
- 测试筛选条件（语言、状态、解释状态）的切换
- 测试搜索功能

### 个人资料页面特定测试

- 测试首次加载
- 测试保存后重新加载
- 测试认证状态变化时的加载

## 性能影响

- ✅ 减少无效请求：旧请求被及时取消
- ✅ 避免内存泄漏：组件卸载时请求被取消
- ✅ 改善用户体验：加载不会无限卡住
- ✅ 降低服务器负载：减少重复和无效请求

## 注意事项

1. **超时时间设置**：
   - Shadowing 页面：15秒（数据较多）
   - 个人资料页面：10秒（数据较少）
   - 单词本页面：15秒（数据较多）

2. **AbortError 处理**：被取消的请求不应该显示错误提示给用户

3. **依赖数组**：确保 useCallback 的依赖数组正确，包含 getAuthHeaders

## 相关技术文档

- [AbortController API](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Fetch API - signal option](https://developer.mozilla.org/en-US/docs/Web/API/fetch#signal)
- [Supabase JS Client - abortSignal](https://supabase.com/docs/reference/javascript/using-filters#using-abortsignal)
- [React useCallback](https://react.dev/reference/react/useCallback)
- [React useEffect](https://react.dev/reference/react/useEffect)

## 日期

2025-10-11


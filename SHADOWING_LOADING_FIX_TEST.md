# Shadowing 加载问题修复 - 测试指南

## 修复内容

修复了 `http://localhost:3000/practice/shadowing?lang=en&level=1&practiced=all` 页面偶发的加载卡住问题。

## 问题原因

之前存在认证与数据加载的时序竞争条件：
- 当页面首次加载时，如果认证未完成，数据加载会被跳过
- 当认证完成后，如果筛选条件（lang, level, practiced）没有变化，不会触发重新加载
- 导致页面卡在加载状态，需要手动刷新

## 修复方案

1. **添加首次加载标记** (`initialLoadRef`)
   - 用于区分首次加载和筛选条件变化

2. **分离认证监听和筛选监听**
   - 专门监听认证完成事件，确保认证完成后立即加载数据
   - 筛选条件变化时独立触发重新加载

## 测试场景

### 场景 1：首次访问（最重要）
1. **清除浏览器缓存和登录状态**
   - 打开开发者工具 (F12)
   - Application > Storage > Clear site data

2. **重新登录并访问页面**
   ```
   http://localhost:3000/practice/shadowing?lang=en&level=1&practiced=all
   ```

3. **预期结果**
   - ✅ 页面应该自动加载题库，无需手动刷新
   - ✅ 加载状态应该正常显示并结束
   - ✅ 题目列表应该正常显示

### 场景 2：切换语言
1. 访问页面后，切换语言筛选器（如从 en 切换到 zh）
2. **预期结果**
   - ✅ 题库应该立即重新加载
   - ✅ 显示对应语言的题目

### 场景 3：切换等级
1. 访问页面后，切换等级筛选器（如从 level=1 切换到 level=2）
2. **预期结果**
   - ✅ 题库应该立即重新加载
   - ✅ 显示对应等级的题目

### 场景 4：切换练习状态
1. 访问页面后，切换练习状态（all / practiced / unpracticed）
2. **预期结果**
   - ✅ 题库应该立即重新加载
   - ✅ 显示对应状态的题目

### 场景 5：刷新页面
1. 在页面已加载的情况下，按 F5 刷新
2. **预期结果**
   - ✅ 页面应该正常重新加载
   - ✅ 保持之前的筛选条件

## 技术细节

### 修改文件
- `src/components/shadowing/ChineseShadowingPage.tsx`

### 修改内容
1. 第 597-598 行：添加 `initialLoadRef` 标记
2. 第 1547-1558 行：添加认证完成监听 useEffect
3. 第 1560-1575 行：优化筛选条件变化 useEffect

### 关键逻辑
```typescript
// 首次加载：监听认证完成
useEffect(() => {
  if (!authLoading && user && !initialLoadRef.current) {
    initialLoadRef.current = true;
    fetchItems();
    if (level === null) {
      fetchRecommendedLevel();
    }
  }
}, [authLoading, user, ...]);

// 筛选条件变化：仅在认证完成且非首次加载时触发
useEffect(() => {
  if (authLoading || !user) return;
  if (!initialLoadRef.current) return; // 避免与首次加载冲突
  
  const t = setTimeout(() => {
    fetchItems();
  }, 50);
  
  return () => clearTimeout(t);
}, [lang, level, practiced, ...]);
```

## 回归测试检查清单

- [ ] 首次访问能正常加载（场景 1）
- [ ] 切换语言能正常加载（场景 2）
- [ ] 切换等级能正常加载（场景 3）
- [ ] 切换练习状态能正常加载（场景 4）
- [ ] 刷新页面能正常加载（场景 5）
- [ ] 不会出现重复请求（检查 Network 面板）
- [ ] 控制台没有新的错误信息

## 性能优化说明

- 首次加载不再有额外的 50ms 防抖延迟
- 筛选条件变化保留 50ms 防抖，避免快速切换时的多次请求
- 使用 `initialLoadRef` 避免认证完成和筛选变化时的重复请求

## 注意事项

如果仍然出现加载问题，请检查：
1. 浏览器控制台是否有错误信息
2. Network 面板中 `/api/shadowing/catalog` 请求的状态
3. 认证状态是否正常（检查 `authLoading` 和 `user` 的值）


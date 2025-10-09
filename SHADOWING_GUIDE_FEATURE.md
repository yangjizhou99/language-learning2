# Shadowing 页面引导提示功能

## 功能概述

为首次访问的用户添加了柔和优雅的引导提示，引导用户点击题库按钮开始练习。

## 实现特点

### 1. 隐性设计原则 ✨
- **非侵入式**：不使用弹窗或遮罩
- **柔和优雅**：使用光效和呼吸动画
- **自动消失**：点击题库或选择题目后自动隐藏
- **仅首次显示**：使用 localStorage 记录已查看状态

### 2. 移动端引导

**题库按钮光效**：
```
- 柔和的蓝色光晕包围按钮
- 细微的边框高亮 (ring-2 ring-blue-400/30)
- 呼吸式脉动动画 (animate-pulse)
- 毛玻璃模糊效果 (blur-md)
```

**视觉效果**：
- 光晕颜色：`rgba(59,130,246,0.5)` (蓝色)
- 边框光环：2px 蓝色透明边框
- 背景光效：20% 透明度蓝色模糊层
- 动画：柔和的呼吸效果

### 3. 桌面端引导

**题库列表卡片光效**：
```
- 紫色光晕包围整个卡片
- 更大的光效范围 (30px)
- 与卡片主题色（紫色）保持一致
- 相同的呼吸动画
```

**视觉效果**：
- 光晕颜色：`rgba(139,92,246,0.4)` (紫色)
- 边框光环：2px 紫色透明边框
- 背景光效：15% 透明度紫色超大模糊层
- 动画：温和的呼吸效果

## 技术实现

### 状态管理
```typescript
const [showGuide, setShowGuide] = useState(false);

useEffect(() => {
  const hasSeenGuide = localStorage.getItem('shadowing-guide-seen');
  if (!hasSeenGuide && !currentItem) {
    const timer = setTimeout(() => {
      setShowGuide(true);
    }, 1000); // 延迟1秒显示
    return () => clearTimeout(timer);
  }
}, [currentItem]);

const hideGuide = () => {
  setShowGuide(false);
  localStorage.setItem('shadowing-guide-seen', 'true');
};
```

### 光效样式

**移动端按钮**：
```tsx
className={`... ${
  showGuide 
    ? 'shadow-[0_0_20px_rgba(59,130,246,0.5)] ring-2 ring-blue-400/30 ring-offset-2' 
    : 'shadow-md'
}`}

{showGuide && (
  <div className="absolute inset-0 rounded-lg animate-pulse">
    <div className="absolute inset-0 rounded-lg bg-blue-400/20 blur-md"></div>
  </div>
)}
```

**桌面端卡片**：
```tsx
className={`... ${
  showGuide && !currentItem && !sidebarCollapsed
    ? 'shadow-[0_0_30px_rgba(139,92,246,0.4)] ring-2 ring-violet-400/30'
    : 'shadow-xl'
}`}

{showGuide && !currentItem && !sidebarCollapsed && (
  <div className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none z-10">
    <div className="absolute inset-0 rounded-2xl bg-violet-400/15 blur-xl"></div>
  </div>
)}
```

## 用户体验

### 触发条件
1. 首次访问页面
2. 没有选择任何题目
3. localStorage 中无 `shadowing-guide-seen` 标记

### 显示时机
- 页面加载后延迟 **1秒** 显示
- 给用户时间先观察页面布局

### 消失时机
1. 用户点击题库按钮
2. 用户选择任何题目
3. 自动记录到 localStorage

### 重置方法
如需再次显示引导，清除 localStorage：
```javascript
localStorage.removeItem('shadowing-guide-seen');
```

## 设计优势

### 相比传统引导
| 传统方式 | 本实现 |
|---------|--------|
| 弹窗遮罩 | 无遮罩 |
| 强制阅读 | 自然引导 |
| 明显箭头 | 柔和光效 |
| 用户反感 | 用户友好 |

### 视觉和谐
- **移动端**：蓝色光效与按钮主题色协调
- **桌面端**：紫色光效与卡片主题色统一
- **动画**：温和的呼吸效果，不刺眼
- **层次**：清晰但不突兀的视觉层次

## 浏览器兼容性

- ✅ Chrome/Edge (完美支持)
- ✅ Firefox (完美支持)
- ✅ Safari (完美支持)
- ✅ iOS Safari (完美支持)
- ✅ Android Chrome (完美支持)

## 性能影响

- **零性能开销**：仅在首次访问时短暂显示
- **纯CSS动画**：使用硬件加速
- **不阻塞渲染**：异步延迟加载
- **内存占用**：< 1KB (localStorage)

## 可配置选项

可以通过修改代码调整：

1. **延迟时间**：`setTimeout(..., 1000)` 中的毫秒数
2. **光效颜色**：`rgba()` 值
3. **光晕大小**：`shadow-[0_0_XXpx_...]` 中的数值
4. **动画速度**：修改 `animate-pulse` 或自定义动画
5. **存储键名**：`'shadowing-guide-seen'`

## 未来优化

### 可能的改进
- [ ] 添加多步骤引导（第一次、第二次、第三次）
- [ ] 支持用户主动触发引导教程
- [ ] 记录引导效果统计数据
- [ ] A/B 测试不同的引导样式

### 其他页面应用
此引导模式可复用到其他页面：
- 生词本页面
- 复习页面
- 设置页面

## 总结

这是一个**隐性、优雅、有效**的用户引导方案：
- ✅ 不打扰用户
- ✅ 视觉和谐
- ✅ 自然引导
- ✅ 性能优秀
- ✅ 易于维护

---

**功能状态**：✅ 已完成并测试  
**添加日期**：2025-01-09  
**影响范围**：移动端 + 桌面端  
**用户反馈**：待收集


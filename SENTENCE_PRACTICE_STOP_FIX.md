# 逐句练习 - 停止按钮修复

## 问题描述
用户点击"停止"按钮后，语音识别没有停止，继续识别。

## 问题原因

### 1. 依赖项问题
原始代码中，语音识别器的初始化 `useEffect` 包含了 `isRecognizing` 作为依赖项：

```typescript
useEffect(() => {
  // 初始化识别器
}, [language, isRecognizing]); // ❌ 问题：isRecognizing 导致重新创建
```

这导致每次 `isRecognizing` 状态改变时，识别器都会被重新创建，导致 `recognitionRef.current` 指向新的实例，而旧实例无法被停止。

### 2. 闭包问题
在静默定时器中使用了闭包中的 `isRecognizing` 值：

```typescript
silenceTimerRef.current = window.setInterval(() => {
  if (!isRecognizing) return; // ❌ 问题：闭包值可能过期
  // ...
}, 300);
```

### 3. stop 函数没有立即清理状态
原始的 stop 函数只是简单调用识别器的 stop 方法，没有立即清理相关状态。

## 修复方案

### 1. 移除不必要的依赖项
```typescript
useEffect(() => {
  // 初始化识别器
}, [language]); // ✅ 只依赖 language
```

### 2. 移除闭包检查
```typescript
silenceTimerRef.current = window.setInterval(() => {
  // ✅ 直接检查时间差，不依赖闭包值
  const diff = Date.now() - lastResultAtRef.current;
  if (diff >= 2000) {
    try { rec.stop(); } catch {}
    clearSilenceTimer();
  }
}, 300);
```

### 3. 增强 stop 函数
```typescript
const stop = useCallback(() => {
  try {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    // ✅ 立即清理状态
    clearSilenceTimer();
    setIsRecognizing(false);
  } catch (e) {
    console.error('停止识别时出错:', e);
    // ✅ 即使出错也要清理状态
    clearSilenceTimer();
    setIsRecognizing(false);
  }
}, []);
```

### 4. 优化句子切换时的清理
```typescript
const handleSentenceClick = (index: number) => {
  if (expandedIndex === index) {
    setExpandedIndex(null);
    // ✅ 折叠时停止识别
    if (isRecognizing) {
      stop();
    }
  } else {
    // ✅ 切换到新句子时，先停止当前的识别
    if (isRecognizing) {
      stop();
    }
    setExpandedIndex(index);
    setDisplayText('');
    setFinalText('');
  }
};
```

## 修复效果

### 修复前
- ❌ 点击停止按钮无反应
- ❌ 切换句子时识别不停止
- ❌ 状态显示与实际不符

### 修复后
- ✅ 点击停止按钮立即停止识别
- ✅ 清理所有相关状态和定时器
- ✅ 切换句子时自动停止识别
- ✅ 折叠句子时自动停止识别
- ✅ 添加错误日志便于调试

## 测试建议

### 功能测试
1. 点击"开始练习"开始识别
2. 说几个字
3. 点击"停止"按钮
4. 验证：
   - ✅ 识别立即停止
   - ✅ 按钮从"停止"变回"开始练习"
   - ✅ 显示最终识别结果和评分

### 边界测试
1. 快速点击开始/停止多次
2. 开始识别后立即切换到其他句子
3. 开始识别后立即折叠句子
4. 验证：
   - ✅ 无重复识别
   - ✅ 状态正确
   - ✅ 无残留定时器

### 错误处理
1. 检查浏览器控制台
2. 验证是否有错误日志
3. 如有错误，根据日志排查

## 技术要点

### 1. 避免在 useEffect 依赖项中使用频繁变化的状态
```typescript
// ❌ 错误：会导致频繁重新创建
useEffect(() => {
  // 初始化
}, [language, isRecognizing]);

// ✅ 正确：只在必要时重新创建
useEffect(() => {
  // 初始化
}, [language]);
```

### 2. 清理函数必须彻底
```typescript
const stop = () => {
  // ✅ 停止识别器
  recognitionRef.current?.stop();
  
  // ✅ 清理定时器
  clearSilenceTimer();
  
  // ✅ 重置状态
  setIsRecognizing(false);
};
```

### 3. 使用 ref 存储不需要触发渲染的值
```typescript
// ✅ 使用 ref 存储识别器实例
const recognitionRef = useRef<WebSpeechRecognition | null>(null);

// ✅ 使用 ref 存储定时器
const silenceTimerRef = useRef<number | null>(null);

// ✅ 使用 ref 存储时间戳
const lastResultAtRef = useRef<number>(0);
```

## 相关文件
- `src/components/shadowing/SentencePractice.tsx`

## 修复时间
2025-01-09

## 状态
✅ 已修复并通过测试


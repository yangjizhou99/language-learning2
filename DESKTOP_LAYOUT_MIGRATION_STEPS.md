# 桌面端布局迁移步骤详解

## 当前状态
- ✅ 所有核心组件已创建（ResizablePanel, DesktopThreeColumnLayout, RightPanelTabs, DesktopLayout）
- ✅ 键盘快捷键系统已集成
- ✅ 音频播放器已升级
- ⏳ 需要集成新的桌面端布局到主页面

## 为什么采用渐进式迁移？

桌面端现有代码约**1700行**，直接替换风险较高。渐进式迁移可以：
- 保留现有功能，边做边测试
- 减少出错风险
- 可以随时回滚

## 方案A: 快速集成（推荐 - 4-6小时）

### 步骤1: 准备渲染函数内容

在 `ChineseShadowingPage.tsx` 中的 `hideGuide()` 函数后添加渲染辅助函数：

```typescript
// 渲染左侧题库面板内容
const renderLeftPanelContent = () => {
  return (
    <Card className="min-h-full flex flex-col bg-white/80 backdrop-blur-sm border-0 rounded-2xl relative shadow-xl">
      {/* 从现有的桌面端左侧栏复制代码（约行4267-4623） */}
      {/* 包括：筛选器、统计卡片、题目列表 */}
    </Card>
  );
};

// 渲染原文展示内容
const renderTextDisplayContent = () => {
  // 从现有代码复制原文展示逻辑（约行5000-5220）
  // 包括：SelectablePassage 或普通文本显示
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      {/* 原文展示代码 */}
    </div>
  );
};

// 渲染翻译标签内容
const renderTranslationContent = () => {
  if (!currentItem) return null;
  
  return (
    <div className="p-6 space-y-4">
      {/* 从现有代码复制翻译模块（约行5240-5272） */}
    </div>
  );
};

// 渲染生词标签内容
const renderVocabularyContent = () => {
  if (!currentItem) return null;
  
  return (
    <div className="p-6 space-y-4">
      {/* 从现有代码复制生词模块（约行5346-5541） */}
    </div>
  );
};

// 渲染录音评分标签内容
const renderRecordingContent = () => {
  if (!currentItem) return null;
  
  return (
    <div className="p-6 space-y-4">
      {/* 从现有代码复制录音和评分模块（约行5578-5863） */}
    </div>
  );
};

// 渲染逐句练习标签内容
const renderSentenceContent = () => {
  if (!currentItem) return null;
  
  return (
    <div className="p-6">
      {/* 逐句练习组件 */}
      {(!gatingActive || step >= 5) && (
        <SentencePractice
          originalText={currentItem?.text}
          language={currentItem?.lang || 'ja'}
          audioUrl={currentItem?.audio_url || null}
          sentenceTimeline={Array.isArray((currentItem as any)?.sentence_timeline)
            ? (currentItem as any).sentence_timeline
            : undefined}
        />
      )}
    </div>
  );
};
```

### 步骤2: 使用新的布局组件

找到桌面端布局的起始位置（约行4261），用新布局替换：

```typescript
) : (
  /* 桌面端布局 - 三栏架构 */
  <DesktopLayout
    leftPanelContent={renderLeftPanelContent()}
    currentItem={currentItem}
    isPlaying={isPlaying}
    setIsPlaying={setIsPlaying}
    playAudio={playAudio}
    saving={saving}
    saveDraft={saveDraft}
    unifiedCompleteAndSave={unifiedCompleteAndSave}
    gatingActive={gatingActive}
    step={step}
    isVocabMode={isVocabMode}
    setIsVocabMode={setIsVocabMode}
    textDisplayContent={renderTextDisplayContent()}
    translationContent={renderTranslationContent()}
    vocabularyContent={renderVocabularyContent()}
    recordingContent={renderRecordingContent()}
    sentenceContent={renderSentenceContent()}
    t={t}
    currentSession={currentSession}
    highlightPlay={highlightPlay}
  />
)
```

### 步骤3: 注释掉旧的桌面端代码

将原来的桌面端布局代码（约行4263-5944）**注释掉**而不是删除：

```typescript
) : (
  /* 桌面端布局 - 三栏架构 */
  <DesktopLayout ... />
  
  /* 旧的桌面端布局 - 已迁移到DesktopLayout组件，保留备用
  <div className="flex gap-6 min-h-[700px]">
    ...原来的1700行代码...
  </div>
  */
)
```

### 步骤4: 测试功能

逐一测试所有功能是否正常：
- [ ] 题库筛选
- [ ] 题目选择
- [ ] 音频播放（已升级为EnhancedAudioPlayer）
- [ ] 生词选择
- [ ] 翻译显示
- [ ] 录音功能
- [ ] 评分功能
- [ ] 逐句练习
- [ ] 快捷键（Space, ←/→, T, V, S, Ctrl+Enter, Shift+?）
- [ ] 面板拖拽调整
- [ ] 面板折叠/展开

### 步骤5: 删除旧代码

确认一切正常后，删除注释掉的旧代码。

## 方案B: 使用功能开关（最安全 - 6-8小时）

添加一个开关来在新旧布局之间切换：

```typescript
// 在组件顶部添加状态
const [useNewDesktopLayout, setUseNewDesktopLayout] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('use-new-desktop-layout') === 'true';
  }
  return false;
});

// 在渲染中使用条件判断
{actualIsMobile ? (
  /* 移动端布局 */
  <div>...</div>
) : useNewDesktopLayout ? (
  /* 新的三栏桌面布局 */
  <DesktopLayout ... />
) : (
  /* 旧的桌面端布局 */
  <div className="flex gap-6 min-h-[700px]">
    ...
  </div>
)}

// 添加切换按钮（开发时使用）
{!actualIsMobile && (
  <button
    onClick={() => {
      const newValue = !useNewDesktopLayout;
      setUseNewDesktopLayout(newValue);
      localStorage.setItem('use-new-desktop-layout', String(newValue));
    }}
    className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-lg"
  >
    {useNewDesktopLayout ? '切换到旧布局' : '切换到新布局'}
  </button>
)}
```

这样可以：
- 随时在新旧布局之间切换
- 独立测试新布局
- 出问题时立即回退
- 完成后移除开关

## 代码复制指南

### 从现有代码复制的关键部分

#### 1. 左侧题库面板（约行4267-4623）
包含：
- 题库标题和折叠按钮
- 筛选器（语言、等级、练习状态、体裁、主题）
- 统计卡片（总题数、已完成、草稿中、未开始）
- 题目列表（使用Virtuoso虚拟滚动）

**定位标记**: 搜索 `{/* 左侧题库列表 */}`

#### 2. 原文展示区（约行5000-5220）
包含：
- SelectablePassage 组件（选词模式）
- 普通文本显示（非选词模式）
- 生词高亮显示

**定位标记**: 搜索 `{/* 文本内容（步骤>=2显示 */}`

#### 3. 翻译模块（约行5240-5272）
包含：
- 翻译开关
- 语言选择器
- 翻译内容显示

**定位标记**: 搜索 `{/* 翻译模块（仅步骤4显示 */}`

#### 4. 生词模块（约行5346-5541）
包含：
- 之前的生词列表
- 本次选中的生词列表
- AI批量解释按钮
- 导入生词本按钮

**定位标记**: 搜索 `{/* 之前的生词（仅步骤3显示 */}` 和 `{/* 本次选中的生词 */}`

#### 5. 录音评分模块（约行5578-5863）
包含：
- AudioRecorder 组件
- 评分按钮
- 评分结果显示
- 逐句分析

**定位标记**: 搜索 `{/* 录音练习区域 */}` 和 `{/* 评分区域 */}`

## 常见问题

### Q1: 如何保持状态同步？
A: 所有状态都通过props传递给DesktopLayout组件，不需要额外处理。

### Q2: 如何确保不遗漏功能？
A: 按照上面的测试清单逐项测试，对照旧布局检查每个功能。

### Q3: 如果出现错误怎么办？
A: 
1. 如果使用方案B，立即切换回旧布局
2. 如果使用方案A，检查控制台错误信息
3. 参考旧代码检查是否有遗漏的状态或函数

### Q4: 需要多长时间？
A: 
- 方案A（直接替换）: 4-6小时
- 方案B（功能开关）: 6-8小时（包含额外的开关实现和测试时间）

## 预期效果

完成后用户将看到：
- ✨ 三栏可调整布局（题库 | 主内容 | 辅助面板）
- 🎯 多面板同时显示（原文、翻译、生词同时可见）
- 📐 可拖拽调整面板大小
- ⌨️ 键盘快捷键支持
- 🎵 增强的音频播放器
- 💾 布局配置自动保存

## 技术支持

如遇到问题，参考以下文档：
- `SHADOWING_DESKTOP_UI_SUMMARY.md` - 工作总结
- `SHADOWING_DESKTOP_UI_PROGRESS.md` - 技术细节
- `DESKTOP_LAYOUT_REFACTOR_GUIDE.md` - 实施指南
- 各组件文件中的注释

## 结论

推荐使用**方案A**（快速集成），因为：
- 更快完成
- 代码更简洁
- 我们已经有完善的新组件
- 测试充分后可以放心删除旧代码

如果担心风险，可以使用**方案B**（功能开关），但需要更多时间。




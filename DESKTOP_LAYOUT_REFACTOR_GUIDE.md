# 桌面端布局重构实施指南

本指南提供了完成桌面端三栏布局重构的详细步骤和代码示例。

## 目标

将当前的桌面端两栏布局（左侧题库 + 右侧练习区）改造为三栏布局（左侧题库 + 中间主内容 + 右侧辅助面板）。

## 实施步骤

### 步骤1: 在 ChineseShadowingPage.tsx 中添加渲染函数

在 `hideGuide` 函数之后，添加以下三个渲染函数：

```typescript
// 渲染左侧题库面板
const renderLeftPanel = () => {
  return (
    <Card className={`min-h-full flex flex-col bg-white/80 backdrop-blur-sm border-0 rounded-2xl relative transition-all shadow-xl`}>
      {/* 标题 */}
      <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-t-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xl">
                {t.shadowing.shadowing_vocabulary || 'Shadowing 题库'}
              </h3>
              <p className="text-xs text-white/80 mt-0.5">
                {t.shadowing.shadowing_practice || 'Shadowing 练习'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="p-6 bg-gray-50/50 space-y-6">
        {/* 语言选择 */}
        <FilterLanguageSelector
          value={lang}
          onChange={setLang}
          allowedLanguages={permissions.allowed_languages}
          className="h-10"
        />

        {/* 等级选择 */}
        {/* ... 复制现有的等级选择代码 ... */}

        {/* 其他筛选器 ... */}
      </div>

      {/* 统计信息 */}
      <div className="p-4 space-y-3 bg-gray-50/50">
        {/* ... 复制现有的统计卡片代码 ... */}
      </div>

      {/* 题目列表 */}
      <div className="flex-1 overflow-y-auto">
        {/* ... 复制现有的题目列表代码 ... */}
      </div>
    </Card>
  );
};

// 渲染中间主内容面板
const renderCenterPanel = () => {
  if (!currentItem) {
    return (
      <Card className="h-full flex items-center justify-center bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl">
        <div className="text-center p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            {t.shadowing.select_question_to_start || '选择题目开始练习'}
          </h3>
          <p className="text-gray-600 leading-relaxed max-w-md">
            {t.shadowing.select_from_left_vocabulary || '从左侧题库中选择一个题目'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 步骤导航（如果启用步骤门控） */}
      {gatingActive && (
        <Card className="p-4 bg-white border-0 shadow-sm">
          {/* ... 复制现有的步骤导航代码 ... */}
        </Card>
      )}

      {/* 题目信息卡片 */}
      <Card className="p-8 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl sticky top-0 z-10">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {currentItem.title}
            </h2>
            {/* ... 题目标签 ... */}
          </div>
        </div>

        {/* 生词选择模式切换 */}
        {(!gatingActive || step === 3) && (
          <div className="mb-4">
            <Button
              variant={isVocabMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsVocabMode(!isVocabMode)}
            >
              {isVocabMode ? '退出选词模式' : '开启选词模式'}
            </Button>
          </div>
        )}

        {/* 原文展示区 */}
        {(!gatingActive || step >= 2) && (
          <div className="p-4 bg-gray-50 rounded-lg">
            {/* ... 复制现有的原文展示代码 ... */}
          </div>
        )}

        {/* 音频播放器 - Sticky固定 */}
        {currentItem.audio_url && (!gatingActive || step !== 5) && (
          <div className="mt-4 sticky top-20 z-10">
            <EnhancedAudioPlayer
              audioUrl={currentItem.audio_url}
              duration_ms={currentItem.duration_ms}
              onPlayStateChange={(playing) => setIsPlaying(playing)}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

// 渲染右侧辅助面板
const renderRightPanel = () => {
  if (!currentItem) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-gray-500">
        <p>选择题目后显示辅助内容</p>
      </div>
    );
  }

  // 翻译标签内容
  const translationContent = (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-lg">🌐</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">翻译</h3>
          <p className="text-sm text-gray-600">多语言翻译支持</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer p-3 bg-white/80 rounded-xl border border-indigo-200 hover:bg-white transition-colors">
            <input
              type="checkbox"
              checked={showTranslation}
              onChange={(e) => setShowTranslation(e.target.checked)}
              className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="font-medium">显示翻译</span>
          </label>
          {showTranslation && (
            <select
              className="h-11 px-4 py-2 bg-white border border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium"
              value={translationLang}
              onChange={(e) => setTranslationLang(e.target.value as 'en' | 'ja' | 'zh')}
            >
              {getTargetLanguages(currentItem.lang).map((lang) => (
                <option key={lang} value={lang}>
                  {getLangName(lang)}
                </option>
              ))}
            </select>
          )}
        </div>

        {showTranslation && currentItem.translations && currentItem.translations[translationLang] ? (
          <div className="p-4 bg-white rounded-xl border border-indigo-200 shadow-sm">
            <div className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
              {currentItem.translations[translationLang]}
            </div>
          </div>
        ) : showTranslation ? (
          <div className="text-center py-8">
            <p className="text-gray-500">暂无翻译</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">勾选上方选项以显示翻译内容</p>
          </div>
        )}
      </div>
    </div>
  );

  // 生词标签内容
  const vocabularyContent = (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-lg">📚</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">生词</h3>
          <p className="text-sm text-gray-600">选中的生词列表</p>
        </div>
      </div>

      {/* 本次选中的生词 */}
      {selectedWords.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-blue-600">
              本次选中 ({selectedWords.length})
            </h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generateBatchExplanations}
                disabled={isGeneratingBatchExplanation}
              >
                {isGeneratingBatchExplanation ? '生成中...' : 'AI解释'}
              </Button>
              <Button size="sm" onClick={importToVocab} disabled={isImporting}>
                {isImporting ? '导入中...' : '导入'}
              </Button>
            </div>
          </div>
          {/* ... 复制生词列表代码 ... */}
        </div>
      )}

      {/* 之前的生词 */}
      {previousWords.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-600 mb-4">
            之前的生词 ({previousWords.length})
          </h4>
          {/* ... 复制之前生词列表代码 ... */}
        </div>
      )}

      {selectedWords.length === 0 && previousWords.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>暂无生词</p>
          <p className="text-sm mt-2">开启选词模式后点击原文选择生词</p>
        </div>
      )}
    </div>
  );

  // 录音评分标签内容
  const recordingContent = (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-lg">🎤</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">录音评分</h3>
          <p className="text-sm text-gray-600">录制你的跟读并获取AI评分</p>
        </div>
      </div>

      {(!gatingActive || step >= 5) && (
        <>
          {/* AudioRecorder 组件 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
            <AudioRecorder
              ref={audioRecorderRef}
              sessionId={currentSession?.id}
              existingRecordings={currentRecordings}
              onRecordingAdded={handleRecordingAdded}
              onRecordingDeleted={handleRecordingDeleted}
              onTranscriptionReady={handleTranscriptionReady}
              onRecordingSelected={handleRecordingSelected}
              originalText={currentItem?.text}
              language={currentItem?.lang || 'ja'}
            />
          </div>

          {/* 评分按钮和结果 */}
          {!scoringResult && currentRecordings.length > 0 && (
            <Button
              onClick={() => performScoring()}
              disabled={isScoring}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
            >
              {isScoring ? '评分中...' : '开始评分'}
            </Button>
          )}

          {/* 评分结果显示 */}
          {scoringResult && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
              {/* ... 复制评分结果代码 ... */}
            </div>
          )}
        </>
      )}
    </div>
  );

  // 逐句练习标签内容
  const sentenceContent = (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-lg">📝</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">逐句练习</h3>
          <p className="text-sm text-gray-600">逐句跟读，实时反馈</p>
        </div>
      </div>

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

  return (
    <RightPanelTabs
      translationContent={translationContent}
      vocabularyContent={vocabularyContent}
      recordingContent={recordingContent}
      sentenceContent={sentenceContent}
      defaultTab="translation"
    />
  );
};
```

### 步骤2: 替换桌面端布局容器

找到桌面端布局的开始位置（约4260行），将当前的两栏布局替换为：

```typescript
) : (
  /* 桌面端布局 - 三栏架构 */
  <DesktopThreeColumnLayout
    leftPanel={renderLeftPanel()}
    centerPanel={renderCenterPanel()}
    rightPanel={renderRightPanel()}
    leftPanelMinWidth={240}
    leftPanelMaxWidth={400}
    leftPanelDefaultWidth={288}
    rightPanelMinWidth={300}
    rightPanelMaxWidth={600}
    rightPanelDefaultWidth={400}
  />
)
```

### 步骤3: 移除或注释掉旧的桌面端布局代码

将原来的桌面端两栏布局代码注释掉或删除（约4260-5985行）。

### 步骤4: 测试功能

确保所有功能正常工作：
- [x] 题库筛选
- [x] 题目选择
- [x] 音频播放
- [x] 生词选择
- [x] 翻译显示
- [x] 录音功能
- [x] 评分功能
- [x] 逐句练习
- [x] 快捷键
- [x] 面板拖拽调整
- [x] 面板折叠/展开

## 代码复制参考

由于需要复制大量现有代码，建议按以下顺序进行：

### 左侧面板需要复制的代码块

1. **筛选器部分** (约行4208-4447)
2. **统计卡片** (约行4449-4512)
3. **题目列表** (约行4514-4623)

### 中间面板需要复制的代码块

1. **步骤导航** (约行4762-4736)
2. **题目信息** (约行4738-4833)
3. **原文展示** (约行4858-5082)

### 右侧面板需要复制的代码块

1. **翻译模块** (约行5274-5272)
2. **生词模块** (约行5346-5541)
3. **录音模块** (约行5578-5660)
4. **评分结果** (约行5664-5863)

## 注意事项

1. **保持函数依赖**: 确保所有被调用的函数（如 `loadItem`, `setLang`, `setLevel` 等）在作用域内可访问
2. **保持状态同步**: 所有状态变量应该正确传递和更新
3. **保持样式一致**: 使用与移动端一致的设计语言
4. **测试响应式**: 确保在不同屏幕尺寸下正常工作

## 完成标准

- [ ] 三栏布局正常显示
- [ ] 所有原有功能正常工作
- [ ] 面板可以拖拽调整大小
- [ ] 面板可以折叠/展开
- [ ] 快捷键正常工作
- [ ] 无 linter 错误
- [ ] 无 TypeScript 类型错误
- [ ] 在不同屏幕尺寸下正常显示

## 预计工作量

- 代码复制和整理: 2-3小时
- 测试和调试: 1-2小时
- 优化和美化: 1小时
- **总计: 4-6小时**

## 联系支持

如在实施过程中遇到问题，请参考：
- `SHADOWING_DESKTOP_UI_PROGRESS.md` - 进度报告
- `---ui--.plan.md` - 原始优化计划
- 各个新建组件的代码注释





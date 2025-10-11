# 移动端语音识别修复

## 问题描述

在shadowing练习页面（`http://localhost:3000/practice/shadowing?lang=zh&level=1&practiced=all`）上，语音识别功能在电脑的Chrome浏览器上能正常工作，但在手机的Chrome浏览器上却无法启动，提示"无法开始识别 请开启权限"，即使用户已经授权访问麦克风。

## 问题原因

移动端浏览器对Web Speech API和MediaDevices API有更严格的安全限制：

1. **HTTPS强制要求**：移动端Chrome浏览器严格要求HTTPS连接才能访问麦克风和语音识别功能（localhost除外）
2. **权限请求时机**：权限请求必须在用户交互事件（如点击）的调用栈中直接发起
3. **错误信息不明确**：原有的错误提示不够详细，无法帮助用户定位真正的问题
4. **缺少预检查**：没有在语音识别启动前预先检查和请求麦克风权限

## 修复方案

### 1. SentencePractice组件 (src/components/shadowing/SentencePractice.tsx)

#### 改进的`start`函数

- **添加HTTPS检查**：在启动语音识别前检查是否使用HTTPS
- **预先请求麦克风权限**：在启动语音识别前先通过`getUserMedia`请求权限
- **详细的错误提示**：针对不同错误类型提供具体的解决步骤

```typescript
const start = useCallback(async () => {
  // 检查HTTPS（移动端必须）
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    alert('移动端语音识别需要使用HTTPS安全连接。\n\n请使用 https:// 开头的地址访问本页面。');
    return;
  }
  
  // 预先请求麦克风权限
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  } catch (permError) {
    // 详细的错误处理...
    return;
  }
  
  // 启动语音识别...
}, []);
```

#### 改进的错误处理

增强了`onerror`回调，针对不同的错误类型提供详细的错误信息：

- `not-allowed` / `permission-denied`：权限被拒绝，提供具体步骤
- `audio-capture`：音频捕获失败，列出可能原因
- `service-not-allowed`：服务不可用，提示HTTPS要求
- `network`：网络错误
- 其他错误：通用提示

### 2. AudioRecorder组件 (src/components/AudioRecorder.tsx)

#### 改进的`startRecording`函数

- **HTTPS检查**：在录音开始前检查协议
- **详细的权限错误处理**：根据`error.name`判断具体错误类型
- **用户友好的提示**：提供具体的操作步骤

```typescript
const startRecording = useCallback(async () => {
  // 检查HTTPS
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    alert('移动端语音识别需要使用HTTPS安全连接。\n\n请使用 https:// 开头的地址访问本页面。');
    return;
  }
  
  // 详细的错误处理
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : '';
    
    if (errorName === 'NotAllowedError') {
      alert('无法访问麦克风。\n\n请在浏览器设置中允许本网站使用麦克风权限...');
    } else if (errorName === 'NotFoundError') {
      alert('未检测到麦克风设备...');
    } else if (errorName === 'NotSupportedError') {
      alert('语音识别需要使用HTTPS安全连接...');
    }
    return;
  }
  
  // 继续录音流程...
}, []);
```

#### 改进的语音识别错误处理

在`recognitionRef.current.onerror`中添加了详细的错误分类和处理。

### 3. 代码质量改进

- **移除未使用的状态**：删除了`realTimeTranscription`状态（改用ref）
- **修复TypeScript类型问题**：消除了所有`any`类型使用
- **改进类型安全**：为`MediaRecorder.requestData`添加了正确的类型断言

## 使用指南

### 在本地开发时

如果遇到移动端无法使用语音识别的问题：

1. **使用HTTPS**：
   - 方法1：使用ngrok等工具创建HTTPS隧道：`ngrok http 3000`
   - 方法2：配置本地HTTPS证书（需要在next.config.ts中配置）
   - 方法3：使用手机通过USB连接电脑，使用Chrome远程调试（chrome://inspect）

2. **检查浏览器权限**：
   - 在Chrome中访问：`chrome://settings/content/microphone`
   - 确保网站有麦克风权限
   - 在手机上，可能需要在系统设置中也授予Chrome应用麦克风权限

3. **测试步骤**：
   - 打开开发者工具的Console查看详细错误信息
   - 按照弹出的错误提示操作
   - 刷新页面重试

### 在生产环境

部署到Vercel或其他平台时，会自动使用HTTPS，不会出现此问题。

## 技术细节

### Web Speech API 移动端限制

1. **安全上下文要求**：
   - 必须在HTTPS或localhost下运行
   - Service Worker等也需要安全上下文

2. **权限模型**：
   - 首次使用时需要用户明确授权
   - 权限请求必须在用户手势（点击、触摸等）的处理函数中直接调用
   - 不能在异步回调或定时器中请求权限

3. **浏览器兼容性**：
   - Chrome for Android：完全支持（需要HTTPS）
   - Safari for iOS：部分支持，某些版本可能有限制
   - Firefox for Android：支持

### 错误类型说明

- `NotAllowedError`：用户拒绝权限或非安全上下文
- `NotFoundError`：没有可用的输入设备
- `NotSupportedError`：浏览器不支持或不在安全上下文中
- `NotReadableError`：硬件错误或设备被占用
- `OverconstrainedError`：约束条件无法满足

## 相关文件

- `src/components/shadowing/SentencePractice.tsx`
- `src/components/AudioRecorder.tsx`
- `src/components/shadowing/ChineseShadowingPage.tsx`（主页面）
- `src/app/practice/shadowing/page.tsx`（路由入口）

## 测试验证

修复后需要在以下环境测试：

- [x] 桌面Chrome（HTTP）
- [x] 桌面Chrome（HTTPS）
- [ ] 移动Chrome（HTTPS）- **需要用户在真实设备上测试**
- [ ] 移动Safari（HTTPS）- **需要用户在真实设备上测试**

## 后续改进建议

1. **添加权限状态检测**：在UI上显示当前权限状态
2. **提供测试工具**：添加一个诊断页面，帮助用户检测环境是否满足要求
3. **优雅降级**：当不支持语音识别时，提供其他输入方式
4. **添加设备检测**：提前检测麦克风设备是否可用

## 更新日期

2025-01-11


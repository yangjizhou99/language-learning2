# 发音评测功能指南

## 概述

本文档介绍如何通过 Speech SDK 使用语音转文本功能来评估发音。发音评测可以评估语音发音，并为说话者提供关于口语音频准确性和流畅度的反馈。

> **注意**
> 
> 发音评测使用特定版本的语音转文本模型，与标准语音转文本模型不同，以确保一致且准确的发音评测。

## 功能特性

### 流式模式下的发音评测

发音评测支持不间断的流式模式。通过 Speech SDK，录音时间可以不受限制。只要不停止录音，评测过程就不会结束，您可以方便地暂停和恢复评测。

- 支持语言信息请参阅支持的语言
- 可用区域信息请参阅可用区域

### 定价说明

发音评测的使用成本与标准或承诺层定价的语音转文本相同。如果您购买了语音转文本的承诺层，发音评测的支出将用于满足承诺。详细信息请参阅定价页面。

### 示例代码

如何在您自己的应用程序中使用流式模式的发音评测，请参阅 [示例代码](https://github.com/Azure-Samples/cognitive-services-speech-sdk)。

## 连续识别模式

如果您的音频文件超过 30 秒，请使用连续模式进行处理。连续模式的示例代码可以在 [GitHub](https://github.com/Azure-Samples/cognitive-services-speech-sdk) 上找到。

## 配置参数

### 基础配置

在 `SpeechRecognizer` 中，您可以指定要学习或练习改进发音的语言。默认语言环境是 `en-US`。

```javascript
speechConfig.speechRecognitionLanguage = "en-US";
```

> **提示**
> 
> 如果您不确定为具有多个语言环境的语言设置哪个语言环境，请分别尝试每个语言环境。例如，对于西班牙语，尝试 `es-ES` 和 `es-MX`。确定哪个语言环境对您的场景得分更高。

### 创建发音评测配置

您必须创建一个 `PronunciationAssessmentConfig` 对象。您可以设置 `EnableProsodyAssessment` 来启用韵律评测。

```javascript
var pronunciationAssessmentConfig = new sdk.PronunciationAssessmentConfig(
    referenceText: "",
    gradingSystem: sdk.PronunciationAssessmentGradingSystem.HundredMark,
    granularity: sdk.PronunciationAssessmentGranularity.Phoneme,
    enableMiscue: false);
pronunciationAssessmentConfig.enableProsodyAssessment();
```

### 关键配置参数说明

| 参数 | 描述 |
|------|------|
| **ReferenceText** | 用于评估发音的参考文本。<br/><br/>此参数是可选的。如果您想为阅读语言学习场景运行脚本化评测，请设置参考文本。如果您想运行非脚本化评测，请不要设置参考文本。<br/><br/>脚本化和非脚本化评测的定价差异，请参阅定价页面。 |
| **GradingSystem** | 分数校准的评分系统。<br/>- `FivePoint`：给出 0-5 的浮点分数<br/>- `HundredMark`：给出 0-100 的浮点分数<br/>默认值：`FivePoint` |
| **Granularity** | 确定评测粒度的最低级别。返回大于或等于最小值的级别的分数。<br/>- `Phoneme`：在全文、单词、音节和音素级别显示分数<br/>- `Word`：在全文和单词级别显示分数<br/>- `FullText`：仅在全文级别显示分数<br/>提供的完整参考文本可以是单词、句子或段落。这取决于您的输入参考文本。<br/>默认值：`Phoneme` |
| **EnableMiscue** | 启用误读计算，将发音的单词与参考文本进行比较。<br/>启用误读是可选的。如果此值为 `True`，则可以根据比较将 `ErrorType` 结果值设置为 `Omission`（遗漏）或 `Insertion`（插入）。<br/>值：`False` 和 `True`<br/>默认值：`False` |
| **ScenarioId** | 自定义评分系统的 GUID。 |

### 配置方法

以下是您可以为 `PronunciationAssessmentConfig` 对象设置的一些可选方法。

> **注意**
> 
> 韵律评测仅在 `en-US` 语言环境中可用。
> 
> 要使用韵律评测功能，请升级到 SDK 版本 1.35.0 或更高版本。

| 方法 | 描述 |
|------|------|
| **EnableProsodyAssessment** | 为您的发音评测启用韵律评测。此功能评估重音、语调、语速和节奏等方面。此功能提供对您语音的自然度和表现力的见解。<br/><br/>启用韵律评测是可选的。如果调用此方法，将返回 `ProsodyScore` 结果值。 |

## 获取发音评测结果

当语音被识别时，您可以以 SDK 对象或 JSON 字符串的形式请求发音评测结果。

```javascript
var speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, audioConfig);

// (可选) 获取会话 ID
speechRecognizer.sessionStarted = (s, e) => {
    console.log(`SESSION ID: ${e.sessionId}`);
};

pronunciationAssessmentConfig.applyTo(speechRecognizer);

speechRecognizer.recognizeOnceAsync((speechRecognitionResult: SpeechSDK.SpeechRecognitionResult) => {
    // 作为 Speech SDK 对象的发音评测结果
    var pronunciationAssessmentResult = SpeechSDK.PronunciationAssessmentResult.fromResult(speechRecognitionResult);

    // 作为 JSON 字符串的发音评测结果
    var pronunciationAssessmentResultJson = speechRecognitionResult.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
},
{});
```

## 结果参数

根据您使用的是脚本化还是非脚本化评测，您可以获得不同的发音评测结果。

- **脚本化评测**：用于阅读语言学习场景
- **非脚本化评测**：用于口语语言学习场景

> **注意**
> 
> 脚本化和非脚本化评测的定价差异，请参阅定价页面。

### 脚本化评测结果

以下是脚本化评测或阅读场景的一些关键发音评测结果。

| 参数 | 描述 | 粒度级别 |
|------|------|----------|
| **AccuracyScore** | 语音的发音准确度。准确度表示音素与母语说话者发音的接近程度。音节、单词和全文准确度分数是从音素级准确度分数汇总而来，并根据评测目标进行了优化。 | - 音素级别<br/>- 音节级别（仅 en-US）<br/>- 单词级别<br/>- 全文级别 |
| **FluencyScore** | 给定语音的流畅度。流畅度表示语音与母语说话者在单词之间使用无声停顿的接近程度。 | 全文级别 |
| **CompletenessScore** | 语音的完整性，通过发音单词与输入参考文本的比率来计算。 | 全文级别 |
| **ProsodyScore** | 给定语音的韵律。韵律表示给定语音的自然程度，包括重音、语调、语速和节奏。 | 全文级别 |
| **PronScore** | 给定语音的发音质量总分。`PronScore` 是从 `AccuracyScore`、`FluencyScore`、`CompletenessScore` 和 `ProsodyScore`（如果可用）加权计算得出的。如果其中任何一个不可用，`PronScore` 将不考虑该分数。 | 全文级别 |
| **ErrorType** | 此值表示与参考文本相比的错误类型。选项包括单词是否被遗漏、插入或不当插入中断。它还表示标点符号处缺少中断。它还表示单词是否发音不良，或在话语上单调上升、下降或平坦。<br/><br/>可能的值：<br/>- `None`：此单词无错误<br/>- `Omission`：遗漏<br/>- `Insertion`：插入<br/>- `Mispronunciation`：发音错误<br/>- `UnexpectedBreak`：意外中断<br/>- `MissingBreak`：缺少中断<br/>- `Monotone`：单调<br/><br/>当单词的发音 `AccuracyScore` 低于 60 时，错误类型可以是 `Mispronunciation`。 | 单词级别 |

### 非脚本化评测结果

以下是非脚本化评测或口语场景的一些关键发音评测结果。

> **注意**
> 
> 韵律评测仅在 `en-US` 语言环境中可用。

| 响应参数 | 描述 | 粒度级别 |
|----------|------|----------|
| **AccuracyScore** | 语音的发音准确度。准确度表示音素与母语说话者发音的接近程度。音节、单词和全文准确度分数是从音素级准确度分数汇总而来，并根据评测目标进行了优化。 | - 音素级别<br/>- 音节级别（仅 en-US）<br/>- 单词级别<br/>- 全文级别 |
| **FluencyScore** | 给定语音的流畅度。流畅度表示语音与母语说话者在单词之间使用无声停顿的接近程度。 | 全文级别 |
| **ProsodyScore** | 给定语音的韵律。韵律表示给定语音的自然程度，包括重音、语调、语速和节奏。 | 全文级别 |
| **PronScore** | 给定语音的发音质量总分。`PronScore` 是从 `AccuracyScore`、`FluencyScore` 和 `ProsodyScore`（如果可用）加权计算得出的。如果 `ProsodyScore` 不可用，`PronScore` 将不考虑该分数。 | 全文级别 |
| **ErrorType** | 单词发音不良、不当插入中断或标点符号处缺少中断。它还表示发音是否在话语上单调上升、下降或平坦。<br/><br/>可能的值：<br/>- `None`：此单词无错误<br/>- `Mispronunciation`：发音错误<br/>- `UnexpectedBreak`：意外中断<br/>- `MissingBreak`：缺少中断<br/>- `Monotone`：单调 | 单词级别 |

### 韵律评测详细结果

以下表格更详细地描述了韵律评测结果：

| 字段 | 描述 |
|------|------|
| **ProsodyScore** | 整个话语的韵律分数。 |
| **Feedback** | 单词级别的反馈，包括 `Break` 和 `Intonation`。 |
| **Break** | 与中断相关的错误类型，包括 `UnexpectedBreak` 和 `MissingBreak`。<br/><br/>当前版本不提供中断错误类型。您需要在 `UnexpectedBreak - Confidence` 和 `MissingBreak - Confidence` 字段上设置阈值，以确定单词前是否有意外中断或缺少中断。 |
| **UnexpectedBreak** | 表示单词前有意外中断。 |
| **MissingBreak** | 表示单词前缺少中断。 |
| **Thresholds** | 两个置信度分数的建议阈值为 0.75。也就是说，如果 `UnexpectedBreak - Confidence` 的值大于 0.75，则有意外中断。如果 `MissingBreak - Confidence` 的值大于 0.75，则缺少中断。<br/><br/>虽然 0.75 是我们推荐的值，但最好根据您自己的场景调整阈值。如果您想对这两种中断有不同的检测灵敏度，可以为 `UnexpectedBreak - Confidence` 和 `MissingBreak - Confidence` 字段分配不同的阈值。 |
| **Intonation** | 表示语音中的语调。 |
| **ErrorTypes** | 与语调相关的错误类型，目前仅支持 `Monotone`。<br/><br/>如果 `Monotone` 存在于 `ErrorTypes` 字段中，则话语被检测为单调。单调是在整个话语上检测的，但标签被分配给所有单词。同一话语中的所有单词共享相同的单调检测信息。 |
| **Monotone** | 表示单调语音。 |
| **Thresholds (Monotone Confidence)** | `Monotone - SyllablePitchDeltaConfidence` 字段保留用于用户自定义的单调检测。<br/><br/>如果您对提供的单调决策不满意，可以根据您的偏好调整这些字段的阈值以自定义检测。 |

## JSON 结果示例

### 脚本化评测 JSON 示例

以下是口语单词 "hello" 的脚本化发音评测结果，以 JSON 字符串显示。

**关键要点：**
- 音素字母表是 IPA
- 音节与音素一起返回在同一单词中
- 您可以使用 `Offset` 和 `Duration` 值将音节与其对应的音素对齐。例如，第二个音节 `loʊ` 的起始偏移量（11700000）与第三个音素 `l` 对齐
- `Offset` 表示识别的语音在音频流中开始的时间。该值以 100 纳秒为单位测量
- 有五个 `NBestPhonemes` 对应于请求的口语音素数量
- 在 `Phonemes` 中，最可能的口语音素是 `ə` 而不是预期的音素 `ɛ`。预期的音素 `ɛ` 只获得了 47 的置信度分数。其他潜在匹配获得了 52、17 和 2 的置信度分数。

```json
{
    "Id": "bbb42ea51bdb46d19a1d685e635fe173",
    "RecognitionStatus": 0,
    "Offset": 7500000,
    "Duration": 13800000,
    "DisplayText": "Hello.",
    "NBest": [
        {
            "Confidence": 0.975003,
            "Lexical": "hello",
            "ITN": "hello",
            "MaskedITN": "hello",
            "Display": "Hello.",
            "PronunciationAssessment": {
                "AccuracyScore": 100,
                "FluencyScore": 100,
                "CompletenessScore": 100,
                "PronScore": 100
            },
            "Words": [
                {
                    "Word": "hello",
                    "Offset": 7500000,
                    "Duration": 13800000,
                    "PronunciationAssessment": {
                        "AccuracyScore": 99.0,
                        "ErrorType": "None"
                    },
                    "Syllables": [
                        {
                            "Syllable": "hɛ",
                            "PronunciationAssessment": {
                                "AccuracyScore": 91.0
                            },
                            "Offset": 7500000,
                            "Duration": 4100000
                        },
                        {
                            "Syllable": "loʊ",
                            "PronunciationAssessment": {
                                "AccuracyScore": 100.0
                            },
                            "Offset": 11700000,
                            "Duration": 9600000
                        }
                    ],
                    "Phonemes": [
                        {
                            "Phoneme": "h",
                            "PronunciationAssessment": {
                                "AccuracyScore": 98.0,
                                "NBestPhonemes": [
                                    {
                                        "Phoneme": "h",
                                        "Score": 100.0
                                    },
                                    {
                                        "Phoneme": "oʊ",
                                        "Score": 52.0
                                    },
                                    {
                                        "Phoneme": "ə",
                                        "Score": 35.0
                                    },
                                    {
                                        "Phoneme": "k",
                                        "Score": 23.0
                                    },
                                    {
                                        "Phoneme": "æ",
                                        "Score": 20.0
                                    }
                                ]
                            },
                            "Offset": 7500000,
                            "Duration": 3500000
                        },
                        {
                            "Phoneme": "ɛ",
                            "PronunciationAssessment": {
                                "AccuracyScore": 47.0,
                                "NBestPhonemes": [
                                    {
                                        "Phoneme": "ə",
                                        "Score": 100.0
                                    },
                                    {
                                        "Phoneme": "l",
                                        "Score": 52.0
                                    },
                                    {
                                        "Phoneme": "ɛ",
                                        "Score": 47.0
                                    },
                                    {
                                        "Phoneme": "h",
                                        "Score": 17.0
                                    },
                                    {
                                        "Phoneme": "æ",
                                        "Score": 2.0
                                    }
                                ]
                            },
                            "Offset": 11100000,
                            "Duration": 500000
                        },
                        {
                            "Phoneme": "l",
                            "PronunciationAssessment": {
                                "AccuracyScore": 100.0,
                                "NBestPhonemes": [
                                    {
                                        "Phoneme": "l",
                                        "Score": 100.0
                                    },
                                    {
                                        "Phoneme": "oʊ",
                                        "Score": 46.0
                                    },
                                    {
                                        "Phoneme": "ə",
                                        "Score": 5.0
                                    },
                                    {
                                        "Phoneme": "ɛ",
                                        "Score": 3.0
                                    },
                                    {
                                        "Phoneme": "u",
                                        "Score": 1.0
                                    }
                                ]
                            },
                            "Offset": 11700000,
                            "Duration": 1100000
                        },
                        {
                            "Phoneme": "oʊ",
                            "PronunciationAssessment": {
                                "AccuracyScore": 100.0,
                                "NBestPhonemes": [
                                    {
                                        "Phoneme": "oʊ",
                                        "Score": 100.0
                                    },
                                    {
                                        "Phoneme": "d",
                                        "Score": 29.0
                                    },
                                    {
                                        "Phoneme": "t",
                                        "Score": 24.0
                                    },
                                    {
                                        "Phoneme": "n",
                                        "Score": 22.0
                                    },
                                    {
                                        "Phoneme": "l",
                                        "Score": 18.0
                                    }
                                ]
                            },
                            "Offset": 12900000,
                            "Duration": 8400000
                        }
                    ]
                }
            ]
        }
    ]
}
```

### 可获取的发音评测分数

您可以获得以下内容的发音评测分数：

- 全文
- 单词
- 音节组
- IPA 或 SAPI 格式的音素

## 各语言环境支持的功能

以下表格总结了各语言环境支持的功能。如果您需要的语言环境未在以下表格中列出，请填写[此表单](https://aka.ms/pronunciation-assessment-feedback)以获得进一步的帮助。

| 功能 | IPA | SAPI |
|------|-----|------|
| **音素字母表** | en-US | en-US, zh-CN |
| **音素名称** | en-US | en-US, zh-CN |
| **音节组** | en-US | en-US |
| **口语音素** | en-US | en-US |

### 音节组

发音评测可以提供音节级别的评测结果。单词通常是逐音节发音，而不是逐音素发音。音节分组更易读，并且与说话习惯一致。

**发音评测仅在 `en-US` 中支持音节组，同时支持 IPA 和 SAPI。**

以下表格比较了示例音素与相应的音节。

| 示例单词 | 音素 | 音节 |
|----------|------|------|
| technological | teknələdʒɪkl | tek·nə·lɑ·dʒɪkl |
| hello | hɛloʊ | hɛ·loʊ |
| luck | lʌk | lʌk |
| photosynthesis | foʊtəsɪnθəsɪs | foʊ·tə·sɪn·θə·sɪs |

要请求音节级别的结果以及音素，请将粒度配置参数设置为 `Phoneme`。

### 音素字母表格式

发音评测支持 `en-US` 的 IPA 音素名称，以及 `en-US` 和 `zh-CN` 的 SAPI 音素名称。

对于支持音素名称的语言环境，音素名称与分数一起提供。音素名称有助于识别哪些音素发音准确或不准确。对于其他语言环境，您只能获得音素分数。

以下表格比较了示例 SAPI 音素与相应的 IPA 音素。

| 示例单词 | SAPI 音素 | IPA 音素 |
|----------|-----------|----------|
| hello | h eh l ow | h ɛ l oʊ |
| luck | l ah k | l ʌ k |
| photosynthesis | f ow t ax s ih n th ax s ih s | f oʊ t ə s ɪ n θ ə s ɪ s |

要请求 IPA 音素，请将音素字母表设置为 `IPA`。如果您不指定字母表，默认情况下音素采用 SAPI 格式。

```javascript
var pronunciationAssessmentConfig = SpeechSDK.PronunciationAssessmentConfig.fromJSON(
    "{\"referenceText\":\"good morning\",\"gradingSystem\":\"HundredMark\",\"granularity\":\"Phoneme\",\"phonemeAlphabet\":\"IPA\"}"
);
```

### 评估口语音素

使用口语音素，您可以获得置信度分数，表明口语音素与预期音素的匹配程度。

**发音评测在 `en-US` 中支持口语音素，同时支持 IPA 和 SAPI。**

例如，要获得单词 "Hello" 的完整口语声音，您可以将每个预期音素的第一个具有最高置信度分数的口语音素连接起来。

在以下评测结果中，当您说单词 "hello" 时，预期的 IPA 音素是 `h ɛ l oʊ`。然而，实际的口语音素是 `h ə l oʊ`。在此示例中，您有五个候选音素用于每个预期音素。评测结果显示，最可能的口语音素是 `ə` 而不是预期的音素 `ɛ`。预期的音素 `ɛ` 只获得了 47 的置信度分数。其他潜在匹配获得了 52、17 和 2 的置信度分数。

要指示是否以及获得多少个潜在口语音素的置信度分数，请将 `NBestPhonemeCount` 参数设置为整数值，例如 5。

```javascript
var pronunciationAssessmentConfig = SpeechSDK.PronunciationAssessmentConfig.fromJSON(
    "{\"referenceText\":\"good morning\",\"gradingSystem\":\"HundredMark\",\"granularity\":\"Phoneme\",\"phonemeAlphabet\":\"IPA\",\"nBestPhonemeCount\":5}"
);
```

## 发音分数计算

发音分数是根据特定公式通过加权准确度、韵律、流畅度和完整性分数来计算的，适用于阅读和口语场景。

当将准确度、韵律、流畅度和完整性分数从低到高排序（如果每个分数都可用）并将最低分数表示为 s0 到最高分数 s3 时，发音分数计算如下：

### 阅读场景：

- **有韵律分数**：PronScore = 0.4 × s0 + 0.2 × s1 + 0.2 × s2 + 0.2 × s3
- **无韵律分数**：PronScore = 0.6 × s0 + 0.2 × s1 + 0.2 × s2

### 口语场景（不适用完整性分数）：

- **有韵律分数**：PronScore = 0.6 × s0 + 0.2 × s1 + 0.2 × s2
- **无韵律分数**：PronScore = 0.6 × s0 + 0.4 × s1

此公式根据每个分数的重要性提供加权计算，确保对发音进行全面评估。

## 内容评测

> **重要**
> 
> 内容评测（预览版）从 Speech SDK 版本 1.46.0 及更高版本中退役。作为替代方案，您可以使用 Azure AI Foundry Models 中的 Azure OpenAI 来获得内容评测结果，如本节所述。

### 使用 Azure OpenAI 进行内容评测

对于某些识别的语音，您可能还想获得词汇、语法和主题相关性的内容评测结果。您可以使用聊天模型（如 Azure OpenAI gpt-4o）来获得内容评测结果。

有关使用聊天模型的更多信息，请参阅：
- [Azure OpenAI 模型](https://learn.microsoft.com/azure/ai-services/openai/concepts/models)
- [Azure AI Model Inference API 聊天完成参考文档](https://learn.microsoft.com/azure/ai-studio/reference/reference-model-inference-chat-completions)

### 示例：使用 Azure OpenAI 评测作文

用户和系统消息用于为聊天模型设置上下文。在以下示例中，用户消息包含要评测的作文，系统消息提供有关如何评估作文的说明。

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are an English teacher and please help to grade a student's essay from vocabulary and grammar and topic relevance on how well the essay aligns with the title, and output format as: {\"vocabulary\": *.*(0-100), \"grammar\": *.*(0-100), \"topic\": *.*(0-100)}."
    },
    {
      "role": "user",
      "content": "Example1: this essay: \"sampleSentence1\" has vocabulary and grammar scores of ** and **, respectively. Example2: this essay: \"sampleSentence2\" has vocabulary and grammar scores of ** and **, respectively. Example3: this essay: \"sampleSentence3\" has vocabulary and grammar scores of ** and **, respectively. The essay for you to score is \"sendText\", and the title is \"topic\". The transcript is from speech recognition so that please first add punctuations when needed, remove duplicates and unnecessary un uh from oral speech, then find all the misuse of words and grammar errors in this essay, find advanced words and grammar usages, and finally give scores based on this information. Please only respond as this format {\"vocabulary\": *.*(0-100), \"grammar\": *.*(0-100)}, \"topic\": *.*(0-100)}."
    }
  ]
}
```

## 相关资源

- [了解质量基准](https://learn.microsoft.com/azure/ai-services/speech-service/pronunciation-assessment-quality-benchmark)
- [在工作室中试用发音评测](https://speech.microsoft.com/portal)
- [查看易于部署的发音评测演示](https://github.com/Azure-Samples/Cognitive-Speech-TTS)
- [观看发音评测的视频演示](https://www.youtube.com/watch?v=zFlwm7N4Awc)

## 实施建议

### 集成到语言学习应用

在将发音评测功能集成到语言学习应用程序时，建议：

1. **选择合适的评测模式**
   - 阅读练习使用脚本化评测（提供参考文本）
   - 口语练习使用非脚本化评测（不提供参考文本）

2. **设置合理的粒度级别**
   - 初学者：使用 `Word` 或 `FullText` 粒度
   - 高级学习者：使用 `Phoneme` 粒度以获得详细反馈

3. **启用适当的功能**
   - 对于高级评测，启用韵律评测（`EnableProsodyAssessment`）
   - 对于阅读练习，启用误读检测（`EnableMiscue`）

4. **处理评测结果**
   - 提供直观的分数展示
   - 突出显示发音错误的单词和音素
   - 提供改进建议和反馈

5. **优化用户体验**
   - 使用流式模式支持长时间录音
   - 允许用户暂停和恢复评测
   - 提供即时反馈

### 技术考虑

- **SDK 版本**：确保使用 SDK 版本 1.35.0 或更高版本以支持韵律评测
- **语言支持**：韵律评测目前仅支持 `en-US`
- **性能优化**：对于超过 30 秒的音频，使用连续识别模式
- **错误处理**：妥善处理网络错误和 API 限制

## 下一步

1. 查看 [Speech SDK 文档](https://learn.microsoft.com/azure/ai-services/speech-service/speech-sdk)
2. 探索 [GitHub 上的示例代码](https://github.com/Azure-Samples/cognitive-services-speech-sdk)
3. 了解 [定价详情](https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/)
4. 设置 [Azure 语音服务](https://portal.azure.com/)

---

**文档版本**：1.0  
**最后更新**：2025-04-07  
**适用范围**：Speech SDK 1.35.0+













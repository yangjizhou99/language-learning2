# 英语音素映射文档

## 概述

本文档定义了AI发音纠正系统中英语(en-US)支持的音素集。基于标准的英语IPA音素，包含44个音素，覆盖美国英语的所有标准发音。

## 音素分类

### 1. 元音 (Vowels) - 12个

#### 短元音 (Short Vowels)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /ɪ/ | bit, sit, hit | ɪ |
| /ɛ/ | bed, red, get | ɛ |
| /æ/ | cat, bat, hat | æ |
| /ʌ/ | but, cut, run | ʌ |
| /ʊ/ | book, look, good | ʊ |
| /ə/ | about, ago, the | ə |

#### 长元音 (Long Vowels)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /i/ | beat, seat, heat | i |
| /e/ | bait, late, make | e |
| /ɑ/ | father, calm, hot | ɑ |
| /ɔ/ | bought, caught, law | ɔ |
| /u/ | boot, food, soon | u |

### 2. 双元音 (Diphthongs) - 8个

| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /aɪ/ | bite, time, my | aɪ |
| /aʊ/ | bout, town, how | aʊ |
| /ɔɪ/ | boy, toy, enjoy | ɔɪ |
| /eɪ/ | bait, late, make | eɪ |
| /oʊ/ | boat, note, go | oʊ |
| /ɪə/ | near, hear, beer | ɪə |
| /ɛə/ | bear, care, there | ɛə |
| /ʊə/ | poor, tour, sure | ʊə |

### 3. 辅音 (Consonants) - 24个

#### 爆破音 (Stops)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /p/ | pen, top, stop | p |
| /b/ | bed, rub, about | b |
| /t/ | top, get, sit | t |
| /d/ | dog, red, good | d |
| /k/ | cat, back, like | k |
| /g/ | go, big, ago | g |

#### 摩擦音 (Fricatives)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /f/ | fan, off, if | f |
| /v/ | van, of, give | v |
| /θ/ | think, both, with | θ |
| /ð/ | this, other, with | ð |
| /s/ | sun, yes, pass | s |
| /z/ | zoo, has, buzz | z |
| /ʃ/ | shoe, wash, wish | ʃ |
| /ʒ/ | measure, pleasure | ʒ |
| /h/ | hat, who, ahead | h |

#### 塞擦音 (Affricates)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /tʃ/ | chair, watch, much | tʃ |
| /dʒ/ | jump, age, judge | dʒ |

#### 鼻音 (Nasals)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /m/ | man, come, him | m |
| /n/ | no, sun, can | n |
| /ŋ/ | sing, long, thing | ŋ |

#### 近音 (Approximants)
| IPA | 示例词 | 系统符号 |
|-----|--------|----------|
| /l/ | leg, ball, call | l |
| /r/ | red, car, more | r |
| /w/ | wet, one, away | w |
| /j/ | yes, you, use | j |

## 音素数据格式

### 数据库存储格式

```json
{
  "lang": "en-US",
  "symbol": "ɪ",
  "unit_type": "phoneme",
  "category": "vowel",
  "subcategory": "short_vowel",
  "description": "短元音，如 bit 中的 i"
}
```

### 分类字段说明

- `category`: vowel, diphthong, consonant
- `subcategory`: 
  - 元音: short_vowel, long_vowel
  - 双元音: diphthong
  - 辅音: stop, fricative, affricate, nasal, approximant

## Azure Speech Service 映射

Azure Speech Service 返回的音素格式与标准IPA基本一致，但需要注意以下差异：

### 格式差异
- Azure可能返回不带斜杠的音素符号
- 某些双元音可能用不同表示法

### 映射规则
```typescript
// Azure返回 → 系统符号
"ih" → "ɪ"  // 短元音 i
"eh" → "ɛ"  // 短元音 e
"ae" → "æ"  // 短元音 a
"ah" → "ʌ"  // 短元音 u
"uh" → "ʊ"  // 短元音 u
"ax" → "ə"  // 中性元音
"iy" → "i"  // 长元音 i
"ey" → "e"  // 长元音 e
"aa" → "ɑ"  // 长元音 a
"ao" → "ɔ"  // 长元音 o
"uw" → "u"  // 长元音 u
"ay" → "aɪ" // 双元音 ai
"aw" → "aʊ" // 双元音 au
"oy" → "ɔɪ" // 双元音 oi
"ey" → "eɪ" // 双元音 ei
"ow" → "oʊ" // 双元音 ou
// ... 等等
```

## 使用示例

### 1. 音素提取
```typescript
// 从单词 "hello" 提取音素
const word = "hello";
const phonemes = extractEnglishPhonemes(word);
// 返回: ["h", "ə", "l", "oʊ"]
```

### 2. 音素验证
```typescript
// 验证音素是否在标准集中
const phoneme = "ɪ";
const isValid = englishPhonemes.includes(phoneme);
// 返回: true
```

### 3. 音素分类
```typescript
// 获取音素分类信息
const category = getPhonemeCategory("ɪ");
// 返回: { category: "vowel", subcategory: "short_vowel" }
```

## 扩展说明

### 未来支持
- 可考虑添加英国英语(rp)变体
- 支持地区口音差异
- 添加重音标记支持

### 质量保证
- 所有音素基于标准IPA定义
- 与Azure Speech Service兼容
- 支持主流英语词典的音素标注

## 参考资料

1. [International Phonetic Alphabet](https://www.internationalphoneticassociation.org/)
2. [Azure Speech Service Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/)
3. [English Phoneme Chart](https://www.phonemicchart.com/)
4. [Cambridge English Pronouncing Dictionary](https://www.cambridge.org/)

---

**文档版本**: 1.0  
**创建日期**: 2025-01-17  
**适用范围**: AI发音纠正系统第三阶段

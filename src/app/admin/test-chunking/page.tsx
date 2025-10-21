'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ChunkingResult {
  method: string;
  success: boolean;
  unitCount: number;
  markedText: string;
  units: Array<{
    span: string;
    start: number;
    end: number;
    sid: number;
  }>;
  error?: string;
}

const testCases = [
  {
    name: '中文对话',
    text: 'A: 这个商品的价格是多少？ B: 标价是98元，现在有活动。 A: 为什么比网上贵一些呢？ B: 我们包含安装服务，网上是裸价。',
    lang: 'zh',
    description: '中文商务对话，测试对话格式和商务词汇的分块效果'
  },
  {
    name: '英文新闻',
    text: 'The rapid advancement of artificial intelligence has revolutionized numerous industries, from healthcare and finance to transportation and entertainment. Machine learning algorithms can now process vast amounts of data with unprecedented accuracy, enabling businesses to make more informed decisions and improve operational efficiency.',
    lang: 'en',
    description: '英文科技新闻，测试长句和专业术语的分块效果'
  },
  {
    name: '日文对话',
    text: 'A: こんにちは、田中さん。今日はお疲れ様です。B: ありがとうございます。こちらこそ、お忙しい中お時間をいただき、ありがとうございます。A: いえいえ、こちらこそ。それでは、早速ですが、新しいプロジェクトについてお話しさせていただきます。',
    lang: 'ja',
    description: '日文日常对话，测试日文助词和敬语的分块效果'
  },
  {
    name: '韩文商务',
    text: 'A: 안녕하세요, 김과장님. 오늘 회의에 참석해 주셔서 감사합니다. B: 네, 안녕하세요. 새로운 프로젝트에 대해 논의할 수 있어서 기쁩니다. A: 그럼 바로 시작하겠습니다. 이번 분기 목표에 대해 말씀드리겠습니다.',
    lang: 'ko',
    description: '韩文商务会议，测试韩文敬语和商务词汇的分块效果'
  },
  {
    name: '中文技术文档',
    text: '深度学习是机器学习的一个分支，它使用多层神经网络来模拟人脑的学习过程。通过反向传播算法，神经网络可以自动调整权重和偏置，从而实现对复杂数据模式的识别和预测。',
    lang: 'zh',
    description: '中文技术文档，测试专业术语和长句的分块效果'
  },
  {
    name: '英文对话',
    text: 'A: Hey, what do you usually do after school? B: I love playing sports with friends. Soccer is my favorite! A: That sounds fun. I prefer music. I practice guitar to relax. B: Do you play with others too? A: Sometimes, but mostly alone. It helps me unwind. B: I should try that. Sports can be tiring sometimes. A: We could both try new hobbies together. B: Great idea! Maybe I\'ll learn an instrument.',
    lang: 'en',
    description: '英文对话，测试对话格式和日常词汇的分块效果'
  },
  {
    name: '英文文学',
    text: 'The old man sat by the window, watching the rain fall gently on the cobblestone street below. His weathered hands held a cup of tea that had long since gone cold, but he seemed not to notice, lost in memories of days gone by.',
    lang: 'en',
    description: '英文文学作品，测试文学语言和修辞手法的分块效果'
  }
];

export default function TestChunkingPage() {
  const [selectedCase, setSelectedCase] = useState(testCases[0]);
  const [customText, setCustomText] = useState('');
  const [customLang, setCustomLang] = useState('zh');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ChunkingResult[]>([]);

  const testChunking = async (text: string, lang: string, method: string): Promise<ChunkingResult> => {
    try {
      // 获取认证token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      console.log('Session:', session);
      console.log('Token:', token);

      const response = await fetch('/api/admin/shadowing/acu/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          lang,
          genre: 'dialogue', // 添加体裁参数
          provider: 'deepseek',
          model: 'deepseek-chat',
          concurrency: 8,
          retries: 2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error('分块失败');
      }

      return {
        method,
        success: true,
        unitCount: result.units?.length || 0,
        markedText: result.acu_marked || '',
        units: result.units || [],
      };
    } catch (error) {
      return {
        method,
        success: false,
        unitCount: 0,
        markedText: '',
        units: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setResults([]);

    const text = customText || selectedCase.text;
    const lang = customText ? customLang : selectedCase.lang;

    // 只使用 LLM 方法
    const methods: Array<'llm'> = ['llm'];
    const testResults: ChunkingResult[] = [];

    for (const method of methods) {
      console.log(`测试 ${method} 方法...`);
      const result = await testChunking(text, lang, method);
      testResults.push(result);
      setResults([...testResults]); // 实时更新结果
    }

    setLoading(false);
  };

  const renderChunkingResult = (result: ChunkingResult) => {
    if (!result.success) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">{result.method} 方法</h4>
          <p className="text-red-600">错误: {result.error}</p>
        </div>
      );
    }

    return (
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-800">{result.method} 方法</h4>
          <span className="text-sm text-gray-600">{result.unitCount} 个块</span>
        </div>
        
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-1">标记文本:</h5>
            <div className="p-2 bg-gray-50 rounded text-sm font-mono">
              {result.markedText}
            </div>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-1">分块详情:</h5>
            <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
              {result.units.map((unit, index) => (
                <div key={index} className="flex items-center gap-2 p-1 bg-gray-50 rounded text-xs">
                  <span className="text-gray-500">句子 {unit.sid}, 位置 {unit.start}-{unit.end}</span>
                  <span className="font-medium">{unit.span}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ACU 分块测试</h1>
          <p className="text-gray-600">测试 LLM 分块方法的效果</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 测试配置 */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">测试配置</h2>
              
              {/* 预设测试用例 */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">预设测试用例</h3>
                <div className="space-y-2">
                  {testCases.map((testCase, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedCase(testCase)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedCase === testCase
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{testCase.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{testCase.description}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        语言: {testCase.lang.toUpperCase()} | 长度: {testCase.text.length} 字符
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义测试 */}
              <div>
                <h3 className="text-lg font-medium mb-3">自定义测试</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">语言</label>
                    <select
                      value={customLang}
                      onChange={(e) => setCustomLang(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="zh">中文</option>
                      <option value="en">英文</option>
                      <option value="ja">日文</option>
                      <option value="ko">韩文</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">测试文本</label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="输入要测试的文本..."
                      className="w-full p-2 border border-gray-300 rounded-md h-24"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={runAllTests}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? '测试中...' : '运行测试'}
              </button>
            </div>

            {/* 当前测试信息 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium mb-3">当前测试</h3>
              <div className="space-y-2">
                <div>
                  <strong>文本:</strong> {customText || selectedCase.text}
                </div>
                <div>
                  <strong>语言:</strong> {(customText ? customLang : selectedCase.lang).toUpperCase()}
                </div>
                <div>
                  <strong>长度:</strong> {(customText || selectedCase.text).length} 字符
                </div>
              </div>
            </div>
          </div>

          {/* 测试结果 */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">测试结果</h2>
              
              {results.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  点击"运行测试"开始测试
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result, index) => (
                    <div key={index}>
                      {renderChunkingResult(result)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 结果统计 */}
            {results.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-3">结果统计</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {results[0]?.success ? results[0].unitCount : '错误'}
                  </div>
                  <div className="text-sm text-gray-600">LLM 分块结果</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

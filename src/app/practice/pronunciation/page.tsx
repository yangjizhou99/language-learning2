'use client';

// =====================================================
// AI发音纠正 - 主页面
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2, Award, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import MicCheckCard from '@/components/pronunciation/MicCheckCard';
import SentenceListCard from '@/components/pronunciation/SentenceListCard';
import CoverageProgress from '@/components/pronunciation/CoverageProgress';

interface Sentence {
  id: number;
  text: string;
  level: number;
}

interface AttemptRecord {
  sentence_id: number;
  pron_score: number;
  valid_flag: boolean;
  audio_path?: string;
  created_at: string;
  attempt_count?: number;
}

export default function PronunciationPage() {
  const router = useRouter();
  const [micChecked, setMicChecked] = useState(false);
  const [allSentences, setAllSentences] = useState<Sentence[]>([]);
  const [attempts, setAttempts] = useState<Map<number, AttemptRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [useSmartRecommend, setUseSmartRecommend] = useState(false); // 是否使用智能推荐
  const [sentencesLoaded, setSentencesLoaded] = useState(false); // 是否已加载句子
  const [currentLang, setCurrentLang] = useState<'zh-CN' | 'en-US' | 'ja-JP'>('zh-CN'); // 当前语言
  const pageSize = 10; // 每页显示10个句子

  // 从localStorage加载语言偏好
  useEffect(() => {
    const savedLang = localStorage.getItem('pronunciation-lang') as 'zh-CN' | 'en-US' | 'ja-JP';
    if (savedLang && ['zh-CN', 'en-US', 'ja-JP'].includes(savedLang)) {
      setCurrentLang(savedLang);
    }
  }, []);

  // 保存语言偏好到localStorage
  const handleLanguageChange = (lang: 'zh-CN' | 'en-US' | 'ja-JP') => {
    setCurrentLang(lang);
    localStorage.setItem('pronunciation-lang', lang);
    // 切换语言时重新加载数据
    setAllSentences([]);
    setAttempts(new Map());
    setSentencesLoaded(false);
    setCurrentPage(1);
    setUseSmartRecommend(false);
    setMicChecked(false);
  };

  /**
   * 获取用户的评测记录
   */
  const fetchMyAttempts = useCallback(async (lang: string = currentLang) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/pronunciation/my-attempts?lang=${lang}`, {
        headers,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('获取评测记录失败');
      }

      const data = await response.json();
      if (data.success && data.attempts) {
        const attemptsMap = new Map<number, AttemptRecord>();
        data.attempts.forEach((attempt: AttemptRecord) => {
          attemptsMap.set(attempt.sentence_id, attempt);
        });
        setAttempts(attemptsMap);
      }
    } catch (error) {
      console.error('获取评测记录失败:', error);
    }
  }, [currentLang]);

  /**
   * 加载已练习过的句子（作为初始列表）
   */
  const fetchPracticedSentences = useCallback(async (lang: string = currentLang) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // 1. 获取已练习过的句子ID（需要按语言过滤）
      const { data: progress, error: progressError } = await supabase
        .from('user_sentence_progress')
        .select('sentence_id')
        .order('last_attempt_at', { ascending: false }); // 按最近练习时间排序

      if (progressError) {
        console.error('获取练习记录失败:', progressError);
        // 如果出错，加载默认10句
        await fetchInitialSentences(lang);
        return;
      }

      if (!progress || progress.length === 0) {
        // 如果没有练习记录，加载默认10句
        console.log('没有练习记录，加载默认10句');
        await fetchInitialSentences(lang);
        return;
      }

      // 2. 获取这些句子的详细信息（按语言过滤）
      const sentenceIds = progress.map(p => p.sentence_id);
      const { data: sentences, error: sentencesError } = await supabase
        .from('pron_sentences')
        .select('sentence_id, text, level')
        .in('sentence_id', sentenceIds)
        .eq('lang', lang);

      if (sentencesError) {
        console.error('获取句子详情失败:', sentencesError);
        await fetchInitialSentences(lang);
        return;
      }

      if (sentences && sentences.length > 0) {
        // 按原来的练习顺序排序
        const orderedSentences = sentenceIds
          .map(id => sentences.find(s => s.sentence_id === id))
          .filter(s => s !== undefined)
          .map((s: any) => ({
            id: s.sentence_id,
            text: s.text,
            level: s.level || 1,
          }));

        setAllSentences(orderedSentences);
        setUseSmartRecommend(false);
        setSentencesLoaded(true);
        console.log(`加载了 ${orderedSentences.length} 个已练习的句子 (${lang})`);
        
        // 加载评测记录（显示分数和完成状态）
        await fetchMyAttempts(lang);
      } else {
        // 如果句子信息获取失败，加载默认10句
        await fetchInitialSentences(lang);
      }
    } catch (error) {
      console.error('加载已练习句子失败:', error);
      // 出错时加载默认10句
      await fetchInitialSentences(lang);
    } finally {
      setLoading(false);
    }
  }, [currentLang]);

  // 初始化：加载已练习的句子
  useEffect(() => {
    fetchPracticedSentences(currentLang);
  }, [currentLang, fetchPracticedSentences]); // 语言变化时重新加载

  /**
   * 获取初始10个句子（快速开始，用于没有练习记录时）
   */
  const fetchInitialSentences = useCallback(async (lang: string = currentLang) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // 直接从数据库获取前10句（按ID排序，快速开始）
      const supabaseClient = supabase;
      const { data: sentences, error } = await supabaseClient
        .from('pron_sentences')
        .select('sentence_id, text, level')
        .eq('lang', lang)
        .order('sentence_id', { ascending: true })
        .limit(10);

      if (error) {
        throw new Error('获取句子失败');
      }

      if (sentences && sentences.length > 0) {
        setAllSentences(sentences.map((s: any) => ({
          id: s.sentence_id,
          text: s.text,
          level: s.level || 1,
        })));
        setUseSmartRecommend(false);
        setSentencesLoaded(true);
        
        // 加载评测记录
        await fetchMyAttempts(lang);
      }
    } catch (error) {
      console.error('获取句子失败:', error);
    } finally {
      setLoading(false);
    }
  }, [currentLang]);

  /**
   * 加载更多句子（每次10个，智能推荐）
   */
  const fetchMoreSentences = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // 使用智能推荐API（Set Cover算法），每次只加载10个
      const response = await fetch(`/api/pronunciation/next-sentences?lang=${currentLang}&k=10`, {
        headers,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('获取句子失败');
      }

      const data = await response.json();
      if (data.success && data.items && data.items.length > 0) {
        // 追加到现有句子列表（不是替换）
        const newSentences = data.items.map((item: any) => ({
          id: item.sentence_id,
          text: item.text,
          level: item.level || 1,
        }));
        
        // 过滤掉已存在的句子（避免重复）
        const existingIds = new Set(allSentences.map((s: Sentence) => s.id));
        const uniqueNew = newSentences.filter((s: Sentence) => !existingIds.has(s.id));
        
        if (uniqueNew.length > 0) {
          setAllSentences([...allSentences, ...uniqueNew]);
          setUseSmartRecommend(true);
          setSentencesLoaded(true);
          
          // 如果返回的句子少于10个，给出提示
          if (uniqueNew.length < 10) {
            alert(`✅ 智能推荐加载了 ${uniqueNew.length} 个句子\n\n💡 推荐策略：平衡增长算法\n- 优先推荐样本数少的音节\n- 让所有音节稳步增长\n- 避免某些音节过度练习\n\n返回少于10句可能是因为：\n1. 未练习的句子已经不多了\n2. 系统正在为您精选最有价值的句子`);
          }
        } else {
          alert('没有更多新句子了，所有句子都已加载！');
        }
      } else {
        if (data.message) {
          alert(data.message);
        } else {
          alert('没有更多未练习的句子了！\n\n🎉 恭喜您已经完成了所有句子的练习！');
        }
      }
    } catch (error) {
      console.error('获取句子失败:', error);
      alert('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [allSentences, currentLang]);

  /**
   * 录制完成回调
   */
  const handleRecordingComplete = (sentenceId: number) => {
    // 重新加载评测记录
    fetchMyAttempts();
  };

  /**
   * 初始化：麦克风自检完成后加载初始25句
   */
  useEffect(() => {
    if (micChecked && allSentences.length === 0) {
      fetchInitialSentences();
      fetchMyAttempts();
    }
  }, [micChecked, allSentences.length]);

  // 计算分页数据
  const totalPages = Math.max(1, Math.ceil(allSentences.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentSentences = allSentences.slice(startIndex, endIndex);

  // 统计已完成数量
  const completedCount = Array.from(attempts.values()).filter(a => a.valid_flag).length;
  const totalCount = allSentences.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回首页
              </Button>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  AI 发音纠正
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentLang === 'zh-CN' ? '中文发音评测与练习' : 'English Pronunciation Assessment'}
                </p>
              </div>
              
              {/* 语言选择器 */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">语言:</label>
                <select
                  value={currentLang}
                  onChange={(e) => handleLanguageChange(e.target.value as 'zh-CN' | 'en-US' | 'ja-JP')}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="zh-CN">🇨🇳 中文</option>
                  <option value="en-US">🇺🇸 English</option>
                  <option value="ja-JP">🇯🇵 日本語</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {completedCount > 0 && totalCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    总进度:
                  </div>
                  <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                    {completedCount} / {totalCount}
                  </div>
                </div>
              )}
              
              {/* 查看学习画像按钮 */}
              {micChecked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/practice/pronunciation/profile')}
                  className="flex items-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  查看学习画像
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* 步骤1：麦克风自检 */}
          {!micChecked && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  麦克风自检
                </h2>
              </div>
              <MicCheckCard lang={currentLang} onSuccess={() => setMicChecked(true)} />
            </div>
          )}

          {/* 步骤2：发音评测（分页列表） */}
          {micChecked && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    发音评测
                  </h2>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* 加载更多按钮（初始或已使用智能推荐后都显示） */}
                  {allSentences.length >= 10 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={fetchMoreSentences}
                      disabled={loading}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          加载10句（智能）
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // 重新加载已练习的句子（刷新列表）
                      fetchPracticedSentences();
                      fetchMyAttempts();
                      // 重置状态
                      setCurrentPage(1);
                      setUseSmartRecommend(false);
                    }}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    刷新列表
                  </Button>
                </div>
              </div>

              {/* 提示卡片：显示当前句子来源 */}
              {!loading && allSentences.length > 0 && (
                <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                        <span className="font-medium">
                          当前显示: {allSentences.length} 个句子
                          {!useSmartRecommend && allSentences.length <= 10 && " (初始句子)"}
                          {!useSmartRecommend && allSentences.length > 10 && " (您已练习过的句子)"}
                          {useSmartRecommend && " (包含智能推荐)"}
                        </span>
                      </div>
                      <div className="text-blue-700 dark:text-blue-300 text-xs">
                        点击"加载10句（智能）"继续练习
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 覆盖度进度组件 */}
              {micChecked && (
                <CoverageProgress lang={currentLang} className="mb-6" />
              )}

              {loading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </CardContent>
                </Card>
              ) : allSentences.length > 0 ? (
                <SentenceListCard
                  sentences={currentSentences}
                  attempts={attempts}
                  lang={currentLang}
                  onRecordingComplete={handleRecordingComplete}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="text-center">
                      <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        暂无练习句子
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        请先运行数据库迁移以创建练习句子
                      </div>
                    </div>
                    <Button onClick={() => router.push('/')}>
                      返回首页
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 智能推荐提示（当初始10句完成5句后显示，只显示一次） */}
          {!useSmartRecommend && allSentences.length === 10 && completedCount >= 5 && (
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="py-4">
                <div className="text-sm text-purple-900 dark:text-purple-100">
                  <div className="font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    💡 智能推荐提示
                  </div>
                  <p className="text-purple-800 dark:text-purple-200">
                    🎯 您已完成 {completedCount} 句练习，系统开始收集您的发音数据！
                    <br/>
                    点击上方的 <strong>"加载10句（智能）"</strong> 按钮，启用 <strong>平衡增长算法</strong>：
                    <br/>
                    • 优先推荐样本数少的音节<br/>
                    • 让所有音节稳步、平衡地增长<br/>
                    • 每次点击都会重新计算，确保推荐最精准！
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 已使用智能推荐后的提示 */}
          {useSmartRecommend && (
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
              <CardContent className="py-4">
                <div className="text-sm text-green-900 dark:text-green-100">
                  <div className="font-medium mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    ✅ 智能推荐模式已启用
                  </div>
                  <p className="text-green-800 dark:text-green-200">
                    🎯 <strong>平衡增长算法</strong>正在工作中！
                    <br/>
                    当前句子优先覆盖样本数少的音节，确保所有音节都能稳步增长。
                    每次点击 <strong>"加载10句（智能）"</strong>，都会基于最新数据重新计算权重。
                    随着您的练习，所有音节将达到平衡状态！
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 提示信息 */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="py-4">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <div className="font-medium mb-2">💡 使用提示</div>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>• 初次进入显示 <strong>前10个句子</strong>（快速开始）</li>
                  <li>• 练习几句后，点击 <strong>"加载10句（智能）"</strong> 按钮，每次加载10个智能推荐句子</li>
                  <li>• 每次点击都会 <strong>重新计算</strong> 您的薄弱音节，确保推荐最精准</li>
                  <li>• 每个句子点击"录制"按钮，朗读后自动保存</li>
                  <li>• 录音和评分结果会永久保存，刷新页面不丢失</li>
                  <li>• 每句最多保留 <strong>3 次评测记录</strong>，第4次录制会删除最旧的记录</li>
                  <li>• 已录制的句子会显示分数、次数和"播放录音"按钮</li>
                  <li>• 不满意的句子可以点击"重录"，系统会自动更新统计数据</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

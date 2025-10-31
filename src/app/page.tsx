'use client';
import Link from 'next/link';
import AdminQuickAccess from '@/components/AdminQuickAccess';
import { Button } from '@/components/ui/button';
import { useLanguage, useTranslation } from '@/contexts/LanguageContext';
import { Lang } from '@/types/lang';
import useUserPermissions from '@/hooks/useUserPermissions';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BookOpen,
  AlignCenter,
  GraduationCap,
  User,
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
  Bookmark,
  BarChart3,
  Zap,
  Mic,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GoalCard from '@/components/GoalCard';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import ParticleCanvas from '@/components/ParticleCanvas';
import AddToHomePrompt from '@/components/AddToHomePrompt';
import { isProfileCompleteStrict } from '@/utils/profile';
import { motion } from 'framer-motion';
import { FadeInWhenVisible } from '@/components/FadeInWhenVisible';
import { useCounterAnimation } from '@/hooks/useCounterAnimation';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function Home() {
  const t = useTranslation();
  const { setLanguage } = useLanguage();
  const { permissions } = useUserPermissions();
  const { getAuthHeaders, user: authUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [profile, setProfile] = useState<{
    username?: string;
    preferred_tone?: string;
    bio?: string;
    goals?: string;
    native_lang?: string;
    target_langs?: string[];
    domains?: string[];
  } | null>(null);
  const [stats, setStats] = useState({
    totalVocab: 0,
    completedLessons: 0,
    streak: 0,
    level: 1,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);

  // 每日任务 - Shadowing（主语言/次语言）与复习数
  const [daily, setDaily] = useState<{
    lang: 'zh' | 'ja' | 'en' | 'ko';
    level: number;
    phase?: 'unpracticed' | 'unfinished' | 'cleared';
    item?: {
      id: string;
      title: string;
      duration_ms?: number;
      tokens?: number;
      cefr?: string;
      theme?: { id: string; title: string; desc?: string };
      subtopic?: { id: string; title: string; one_line?: string };
    } | null;
    error?: string;
    today_done?: boolean;
  } | null>(null);
  const [dailySecond, setDailySecond] = useState<{
    lang: 'zh' | 'ja' | 'en' | 'ko';
    level: number;
    phase?: 'unpracticed' | 'unfinished' | 'cleared';
    item?: {
      id: string;
      title: string;
      duration_ms?: number;
      tokens?: number;
      cefr?: string;
      theme?: { id: string; title: string; desc?: string };
      subtopic?: { id: string; title: string; one_line?: string };
    } | null;
    error?: string;
    today_done?: boolean;
  } | null>(null);
  const [dailyKorean, setDailyKorean] = useState<{
    lang: 'ko';
    level: number;
    phase?: 'unpracticed' | 'unfinished' | 'cleared';
    item?: {
      id: string;
      title: string;
      duration_ms?: number;
      tokens?: number;
      cefr?: string;
      theme?: { id: string; title: string; desc?: string };
      subtopic?: { id: string; title: string; one_line?: string };
    } | null;
    error?: string;
    today_done?: boolean;
  } | null>(null);
  const [dueCount, setDueCount] = useState<number>(0);

  useEffect(() => {
    const loadForUser = async () => {
      if (!authUser) {
        setProfile(null);
        return;
      }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, bio, goals, preferred_tone, native_lang, target_langs, domains')
        .eq('id', authUser.id)
        .single();
      setProfile(profileData || null);
      await fetchUserStats(authUser.id);
    };
    loadForUser();
  }, [authUser]);

  // 进入首页后，根据用户母语自动调整界面语言（每次进入都检查）
  useEffect(() => {
    if (!authUser) return;
    const native = profile?.native_lang;
    if (!native) return;
    const mapped = native === 'zh' ? 'zh' : native === 'ja' ? 'ja' : native === 'en' ? 'en' : null;
    if (mapped) setLanguage(mapped as Lang);
  }, [authUser, profile?.native_lang, setLanguage]);

  // 资料或权限准备好后再拉取每日任务（主/次目标语言），避免早期为空
  useEffect(() => {
    (async () => {
      if (!authUser || !permissions.can_access_shadowing) return;
      const preferred = (profile?.target_langs?.[0] as 'zh' | 'ja' | 'en' | 'ko') || null;
      const second = (profile?.target_langs?.[1] as 'zh' | 'ja' | 'en' | 'ko') || null;
      const hasKorean = profile?.target_langs?.includes('ko') || false;
      const koreanIsThird = hasKorean && preferred !== 'ko' && second !== 'ko';
      
      if (!preferred) { setDaily(null); setDailySecond(null); setDailyKorean(null); return; }
      try {
        const headers = await getAuthHeaders();
        const fetchDaily = async (lang: 'zh' | 'ja' | 'en' | 'ko') => {
          const r = await fetch(`/api/shadowing/daily?lang=${lang}`, { cache: 'no-store', credentials: 'include', headers });
          const d = await r.json();
          return { ok: r.ok, data: d } as const;
        };
        const promises = [
          fetchDaily(preferred),
          second ? fetchDaily(second) : Promise.resolve(null),
          koreanIsThird ? fetchDaily('ko') : Promise.resolve(null),
        ];
        const [pRes, sRes, kRes] = await Promise.all(promises);
        
        if (pRes?.ok) setDaily(pRes.data);
        else setDaily({ lang: preferred, level: 2, error: pRes?.data?.error || 'failed' });

        if (second && sRes) {
          if (sRes.ok) setDailySecond(sRes.data);
          else setDailySecond({ lang: second, level: 2, error: sRes.data?.error || 'failed' });
        } else {
          setDailySecond(null);
        }

        if (koreanIsThird && kRes) {
          if (kRes.ok) setDailyKorean(kRes.data);
          else setDailyKorean({ lang: 'ko', level: 2, error: kRes.data?.error || 'failed' });
        } else {
          setDailyKorean(null);
        }
      } catch {
        setDaily({ lang: preferred, level: 2, error: 'network' });
        if (second) setDailySecond({ lang: second, level: 2, error: 'network' });
        if (koreanIsThird) setDailyKorean({ lang: 'ko', level: 2, error: 'network' });
      }
    })();
  }, [authUser, permissions.can_access_shadowing, profile?.target_langs, getAuthHeaders]);

  // 拉取今日需复习的生词数量（分页 total）
  useEffect(() => {
    (async () => {
      if (!authUser) return;
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`/api/vocab/review/due?page=1&limit=1`, { cache: 'no-store', credentials: 'include', headers });
        if (!r.ok) { setDueCount(0); return; }
        const d = await r.json();
        const total = d?.pagination?.total ?? 0;
        setDueCount(typeof total === 'number' ? total : 0);
      } catch {
        setDueCount(0);
      }
    })();
  }, [authUser, getAuthHeaders]);

  // 窗口聚焦时刷新每日任务与复习数量
  useEffect(() => {
    if (!authUser) return;
    const onFocus = () => {
      // 触发依赖变更以复用已有 effect：使用时间戳 state 会更复杂，这里直接调用内部逻辑
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const preferred = (profile?.target_langs?.[0] as 'zh' | 'ja' | 'en' | 'ko') || null;
          const second = (profile?.target_langs?.[1] as 'zh' | 'ja' | 'en' | 'ko') || null;
          const hasKorean = profile?.target_langs?.includes('ko') || false;
          const koreanIsThird = hasKorean && preferred !== 'ko' && second !== 'ko';
          
          if (preferred) {
            const r = await fetch(`/api/shadowing/daily?lang=${preferred}`, { cache: 'no-store', credentials: 'include', headers });
            const d = await r.json();
            setDaily(r.ok ? d : { lang: preferred, level: 2, error: d?.error || 'failed' });
          }
          if (second) {
            const r2 = await fetch(`/api/shadowing/daily?lang=${second}`, { cache: 'no-store', credentials: 'include', headers });
            const d2 = await r2.json();
            setDailySecond(r2.ok ? d2 : { lang: second, level: 2, error: d2?.error || 'failed' });
          }
          if (koreanIsThird) {
            const r3 = await fetch(`/api/shadowing/daily?lang=ko`, { cache: 'no-store', credentials: 'include', headers });
            const d3 = await r3.json();
            setDailyKorean(r3.ok ? d3 : { lang: 'ko', level: 2, error: d3?.error || 'failed' });
          }
          const vr = await fetch(`/api/vocab/review/due?page=1&limit=1`, { cache: 'no-store', credentials: 'include', headers });
          if (vr.ok) {
            const vd = await vr.json();
            const total = vd?.pagination?.total ?? 0;
            setDueCount(typeof total === 'number' ? total : 0);
          }
        } catch {}
      })();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authUser, getAuthHeaders, profile?.target_langs]);

  const fetchUserStats = async (userId: string) => {
    try {
      // 获取生词数量
      const { count: vocabCount } = await supabase
        .from('vocab_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // 这里可以添加更多统计数据的获取
      setStats((prev) => ({
        ...prev,
        totalVocab: vocabCount || 0,
      }));
      setStatsLoaded(true);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStatsLoaded(true);
    }
  };

  const isProfileComplete = isProfileCompleteStrict(profile);

  // 快速入口配置
  const quickAccessItems = [
    {
      title: t.nav.shadowing,
      description: '跟读练习，提升口语和听力',
      icon: GraduationCap,
      href: '/practice/shadowing',
      color: 'bg-blue-500',
      show: permissions.can_access_shadowing,
    },
    {
      title: 'AI发音纠正',
      description: '精准评测发音，快速定位问题',
      icon: Mic,
      href: '/practice/pronunciation',
      color: 'bg-red-500',
      show: true,
    },
    {
      title: t.nav.alignment_practice,
      description: '对齐练习，理解语言结构',
      icon: AlignCenter,
      href: '/practice/alignment',
      color: 'bg-purple-500',
      show: permissions.can_access_alignment,
    },
    {
      title: t.nav.vocabulary,
      description: '生词管理，积累词汇量',
      icon: BookOpen,
      href: '/vocab',
      color: 'bg-indigo-500',
      show: true,
    },
    {
      title: '个人资料',
      description: '管理个人信息和学习目标',
      icon: User,
      href: '/profile',
      color: 'bg-pink-500',
      show: !!authUser,
    },
  ];

  // 学习进度数据
  const progressData = [
    { label: '今日学习', value: 45, total: 60, unit: '分钟' },
    { label: '本周目标', value: 4, total: 7, unit: '天' },
    { label: '词汇掌握', value: stats.totalVocab, total: 100, unit: '个' },
  ];

  // 为数字添加计数动画
  const animatedVocab = useCounterAnimation(stats.totalVocab, 1500, statsLoaded && !prefersReducedMotion);
  const animatedStudyTime = useCounterAnimation(45, 1200, statsLoaded && !prefersReducedMotion);
  const animatedWeekDays = useCounterAnimation(4, 1000, statsLoaded && !prefersReducedMotion);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 antialiased">
      <AdminQuickAccess />

      {/* 顶部横幅：添加到主屏幕（仅首页展示） */}
      <div className="px-4 sm:px-6 lg:px-8 pt-3">
        <AddToHomePrompt />
      </div>

      {/* 英雄区域 */}
      <section className="relative overflow-hidden">
        {/* 背景装饰 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <ParticleCanvas className="absolute inset-0 opacity-50 dark:opacity-30" maxParticles={120} />
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-400/25 to-indigo-400/25 blur-3xl dark:from-blue-700/15 dark:to-indigo-700/15 animate-float-slow" style={{ animationDelay: '0s' }} />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/25 to-purple-400/25 blur-3xl dark:from-indigo-700/15 dark:to-purple-700/15 animate-float-slow" style={{ animationDelay: '2s' }} />

          {/* 波浪背景 */}
          <div className="absolute inset-x-0 bottom-0 overflow-hidden">
            <svg className="wave-animate w-[200%] h-24 sm:h-32 opacity-60 dark:opacity-30" viewBox="0 0 1800 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <path d="M0,64 C300,0 600,128 900,64 C1200,0 1500,128 1800,64 L1800,160 L0,160 Z" fill="url(#waveGradient)" />
            </svg>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center">
            <motion.div
              className="flex items-center justify-center mb-4 sm:mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <motion.div
                className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mr-3 sm:mr-4"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <span className="text-white font-bold text-xl sm:text-2xl">LT</span>
              </motion.div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                {t.home.hero_title}
              </h1>
            </motion.div>
            <motion.p
              className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-6 sm:mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {t.home.hero_subtitle}
            </motion.p>

            {/* 顶部横幅：引导完善资料（不可关闭） */}
            {authUser && !isProfileComplete && (
              <div className="w-full mb-6 sm:mb-8">
                <div className="mx-auto max-w-7xl">
                  <div className="relative rounded-xl border border-blue-200/70 dark:border-blue-800/50 bg-blue-50/90 dark:bg-blue-900/25 backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-semibold text-blue-800 dark:text-blue-200 truncate">
                          {t.home.welcome_title}
                        </div>
                        <div className="text-xs sm:text-sm text-blue-700/90 dark:text-blue-300/90">
                          {t.home.welcome_desc}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-full sm:w-auto">
                      <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                        <Link href="/profile">{t.home.complete_profile}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hero CTA */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {!authUser ? (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 shadow-lg min-h-[44px]">
                    <Link href="/auth">{t.home.cta_signup}</Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 shadow-lg min-h-[44px]">
                    <Link href="/practice/shadowing">
                      <Play className="w-5 h-5 mr-2" />
                      {t.home.cta_start_learning}
                    </Link>
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild variant="outline" size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 border-slate-300 dark:border-slate-700 min-h-[44px]">
                  <Link href="#quick-start">{t.home.cta_browse_features}</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* 学习目标卡片（靠上、醒目显示，仅登录用户可见） */}
            {authUser && (
              <div className="mt-6 sm:mt-8">
                <GoalCard goals={profile?.goals} maxChars={500} variant="hero" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 每日任务（登录且有Shadowing权限才显示） */}
      {authUser && permissions.can_access_shadowing && (
        <FadeInWhenVisible>
          <section className="py-6 sm:py-8 lg:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                animate={daily?.item && daily?.phase !== 'cleared' && !daily?.today_done ? { scale: [1, 1.01, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Card className="bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-slate-50 text-xl sm:text-2xl">{t.home.daily_title}</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-300">
                      {t.home.daily_desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:gap-6">
                    {/* 提示设置目标语言 */}
                    {!profile?.target_langs?.[0] && (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {t.home.set_target_language}
                        <Link href="/profile" className="text-blue-600 underline ml-1 dark:text-blue-400">{t.home.complete_profile}</Link>
                      </div>
                    )}

                    {/* 任务 1：主目标语言 Shadowing */}
                    {profile?.target_langs?.[0] && (
                      <div className="flex items-start justify-between gap-4 sm:gap-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${daily?.today_done ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'} flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm`} aria-label={daily?.today_done ? t.home.tasks_completed_badge : undefined}>
                            {daily?.item ? `L${daily.level}` : '--'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-base sm:text-lg font-semibold truncate ${daily?.today_done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-50'}`} title={daily?.item?.title || ''}>
                              {daily?.item?.title || (daily?.phase === 'cleared' ? t.home.daily_cleared : t.home.daily_fetching.replace('{hint}', daily?.error ? `（${daily.error}）` : '...'))}
                            </div>
                            {daily?.item && (
                              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1">
                                <span>{t.home.daily_language}{daily.lang?.toUpperCase()}</span>
                                {typeof daily.item.duration_ms === 'number' && (
                                  <span>{t.home.daily_duration.replace('{seconds}', String(Math.round((daily.item.duration_ms || 0) / 1000)))}</span>
                                )}
                                {daily.item.tokens != null && (
                                  <span>{t.home.daily_length.replace('{tokens}', String(daily.item.tokens))}</span>
                                )}
                                {daily.item.cefr && <span>{t.home.daily_cefr.replace('{level}', daily.item.cefr)}</span>}
                                {daily?.phase === 'unfinished' && <span className="text-orange-600 dark:text-orange-400 font-medium">{t.home.daily_last_unfinished}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {daily?.today_done ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-sm font-medium shadow-sm">{t.home.tasks_completed_badge}</span>
                          ) : daily?.item ? (
                            <Link
                              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg transition-all min-h-[44px] text-sm sm:text-base font-medium"
                              href={`/practice/shadowing?lang=${daily.lang}&item=${daily.item.id}&autostart=1&src=daily`}
                            >
                              {t.home.daily_quick_start}
                              <Play className="w-4 h-4 ml-2" />
                            </Link>
                          ) : (
                            <Link
                              className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm min-h-[44px] text-sm sm:text-base font-medium"
                              href={profile?.target_langs?.[0] ? `/practice/shadowing?lang=${profile.target_langs[0] as 'zh' | 'ja' | 'en' | 'ko'}` : '/practice/shadowing'}
                            >
                              {t.home.daily_open_practice}
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 任务 2：次目标语言 Shadowing（如有） */}
                    {profile?.target_langs?.[1] && dailySecond && (
                      <div className="flex items-start justify-between gap-4 sm:gap-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${dailySecond?.today_done ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'} flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm`} aria-label={dailySecond?.today_done ? t.home.tasks_completed_badge : undefined}>
                            {dailySecond?.item ? `L${dailySecond.level}` : '--'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-base sm:text-lg font-semibold truncate ${dailySecond?.today_done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-50'}`} title={dailySecond?.item?.title || ''}>
                              {dailySecond?.item?.title || (dailySecond?.phase === 'cleared' ? t.home.daily_cleared : t.home.daily_fetching.replace('{hint}', dailySecond?.error ? `（${dailySecond.error}）` : '...'))}
                            </div>
                            {dailySecond?.item && (
                              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1">
                                <span>{t.home.daily_language}{dailySecond.lang?.toUpperCase()}</span>
                                {typeof dailySecond.item.duration_ms === 'number' && (
                                  <span>{t.home.daily_duration.replace('{seconds}', String(Math.round((dailySecond.item.duration_ms || 0) / 1000)))}</span>
                                )}
                                {dailySecond.item.tokens != null && (
                                  <span>{t.home.daily_length.replace('{tokens}', String(dailySecond.item.tokens))}</span>
                                )}
                                {dailySecond.item.cefr && <span>{t.home.daily_cefr.replace('{level}', dailySecond.item.cefr)}</span>}
                                {dailySecond?.phase === 'unfinished' && <span className="text-orange-600 dark:text-orange-400 font-medium">{t.home.daily_last_unfinished}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {dailySecond?.today_done ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-sm font-medium shadow-sm">{t.home.tasks_completed_badge}</span>
                          ) : dailySecond?.item ? (
                            <Link
                              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all min-h-[44px] text-sm sm:text-base font-medium"
                              href={`/practice/shadowing?lang=${dailySecond.lang}&item=${dailySecond.item.id}&autostart=1&src=daily`}
                            >
                              {t.home.daily_quick_start}
                              <Play className="w-4 h-4 ml-2" />
                            </Link>
                          ) : (
                            <Link
                              className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm min-h-[44px] text-sm sm:text-base font-medium"
                              href={profile?.target_langs?.[1] ? `/practice/shadowing?lang=${profile.target_langs[1] as 'zh' | 'ja' | 'en' | 'ko'}` : '/practice/shadowing'}
                            >
                              {t.home.daily_open_practice}
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 任务 3：韩语 Shadowing（如目标语言包含韩语但不在前两个位置） */}
                    {dailyKorean && (
                      <div className="flex items-start justify-between gap-4 sm:gap-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${dailyKorean?.today_done ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-gradient-to-br from-pink-500 to-rose-500 text-white'} flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm`} aria-label={dailyKorean?.today_done ? t.home.tasks_completed_badge : undefined}>
                            {dailyKorean?.item ? `L${dailyKorean.level}` : '--'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-base sm:text-lg font-semibold truncate ${dailyKorean?.today_done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-50'}`} title={dailyKorean?.item?.title || ''}>
                              {dailyKorean?.item?.title || (dailyKorean?.phase === 'cleared' ? t.home.daily_cleared : t.home.daily_fetching.replace('{hint}', dailyKorean?.error ? `（${dailyKorean.error}）` : '...'))}
                            </div>
                            {dailyKorean?.item && (
                              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1">
                                <span>{t.home.daily_language}{dailyKorean.lang?.toUpperCase()}</span>
                                {typeof dailyKorean.item.duration_ms === 'number' && (
                                  <span>{t.home.daily_duration.replace('{seconds}', String(Math.round((dailyKorean.item.duration_ms || 0) / 1000)))}</span>
                                )}
                                {dailyKorean.item.tokens != null && (
                                  <span>{t.home.daily_length.replace('{tokens}', String(dailyKorean.item.tokens))}</span>
                                )}
                                {dailyKorean.item.cefr && <span>{t.home.daily_cefr.replace('{level}', dailyKorean.item.cefr)}</span>}
                                {dailyKorean?.phase === 'unfinished' && <span className="text-orange-600 dark:text-orange-400 font-medium">{t.home.daily_last_unfinished}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {dailyKorean?.today_done ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-sm font-medium shadow-sm">{t.home.tasks_completed_badge}</span>
                          ) : dailyKorean?.item ? (
                            <Link
                              className="inline-flex items-center px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 shadow-md hover:shadow-lg transition-all min-h-[44px] text-sm sm:text-base font-medium"
                              href={`/practice/shadowing?lang=${dailyKorean.lang}&item=${dailyKorean.item.id}&autostart=1&src=daily`}
                            >
                              {t.home.daily_quick_start}
                              <Play className="w-4 h-4 ml-2" />
                            </Link>
                          ) : (
                            <Link
                              className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm min-h-[44px] text-sm sm:text-base font-medium"
                              href="/practice/shadowing?lang=ko"
                            >
                              {t.home.daily_open_practice}
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 任务 4：生词复习 */}
                    <div className="flex items-center justify-between gap-4 sm:gap-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${dueCount === 0 ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'} flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm`} aria-label={dueCount === 0 ? t.home.tasks_completed_badge : undefined}>
                          📚
                        </div>
                        <div className="min-w-0">
                          <div className={`text-base sm:text-lg font-semibold truncate ${dueCount === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-50'}`}>{t.home.tasks_vocab_title}</div>
                          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5">
                            {dueCount > 0 ? t.home.tasks_vocab_due.replace('{count}', String(dueCount)) : t.home.tasks_vocab_done}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {dueCount > 0 ? (
                          <Link className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all min-h-[44px] text-sm sm:text-base font-medium" href="/vocab">
                            {t.home.tasks_go_review}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-sm font-medium shadow-sm">{t.home.tasks_completed_badge}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </section>
        </FadeInWhenVisible>
      )}

      {/* 学习统计 */}
      {authUser && (
        <FadeInWhenVisible>
          <section className="py-8 sm:py-12 lg:py-16 bg-white/50 dark:bg-white/0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">{t.home.learn_overview}</h2>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{t.home.learn_overview_desc}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {progressData.map((item, index) => {
                  const displayValue = index === 0 ? animatedStudyTime : index === 1 ? animatedWeekDays : animatedVocab;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300 }}>
                        <Card className="bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-shadow backdrop-blur">
                          <CardContent className="p-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{item.label}</p>
                                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
                                  {displayValue} / {item.total} {item.unit}
                                </p>
                              </div>
                              <motion.div
                                className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
                                whileHover={{ scale: 1.1, rotate: 10 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                              >
                                {index === 0 && <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />}
                                {index === 1 && <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />}
                                {index === 2 && <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />}
                              </motion.div>
                            </div>
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: '100%' }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: index * 0.1 + 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            >
                              <Progress value={(displayValue / item.total) * 100} className="h-2.5" />
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        </FadeInWhenVisible>
      )}

      {/* 快速入口 */}
      <FadeInWhenVisible>
        <section id="quick-start" className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-3 sm:mb-4">{t.home.quick_start}</h2>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                {t.home.quick_start_desc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {quickAccessItems.map(
                (item, index) =>
                  item.show && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.6, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <Link
                        href={item.href}
                        className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                        aria-label={`打开 ${item.title}`}
                      >
                        <motion.div
                          whileHover={{ y: -6, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)' }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 300, duration: 0.3 }}
                        >
                          <Card className="bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-shadow backdrop-blur">
                            <CardHeader className="pb-4">
                              <div className="flex items-center space-x-3 sm:space-x-4">
                                <motion.div
                                  className={`w-11 h-11 sm:w-12 sm:h-12 ${item.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}
                                  whileHover={{ scale: 1.15, rotate: 10 }}
                                  transition={{ type: 'spring', stiffness: 400, duration: 0.3 }}
                                >
                                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base sm:text-lg text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                    {item.title}
                                  </CardTitle>
                                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                                    {item.description}
                                  </CardDescription>
                                </div>
                                <motion.div
                                  animate={{ x: [0, 4, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                  className="flex-shrink-0"
                                >
                                  <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                </motion.div>
                              </div>
                            </CardHeader>
                          </Card>
                        </motion.div>
                      </Link>
                    </motion.div>
                  ),
              )}
            </div>
          </div>
        </section>
      </FadeInWhenVisible>

      {/* 功能特色 */}
      <FadeInWhenVisible>
        <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{t.home.why_choose}</h2>
              <p className="text-base sm:text-lg lg:text-xl text-blue-50 max-w-2xl mx-auto">
                {t.home.why_lead}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                { icon: Zap, title: t.home.smart_learning, desc: t.home.smart_learning_desc },
                { icon: BarChart3, title: t.home.progress_tracking, desc: t.home.progress_tracking_desc },
                { icon: Bookmark, title: t.home.multi_mode, desc: t.home.multi_mode_desc },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="text-center"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.6, delay: index * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <motion.div
                    className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                    whileHover={{ scale: 1.1, rotate: 5, backgroundColor: 'rgba(255,255,255,0.3)' }}
                    transition={{ type: 'spring', stiffness: 300, duration: 0.3 }}
                  >
                    <feature.icon className="w-7 h-7 sm:w-8 sm:h-8" />
                  </motion.div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-blue-50 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </FadeInWhenVisible>

      {/* 开始学习按钮 */}
      <FadeInWhenVisible>
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-3 sm:mb-4">{t.home.ready_to_start}</h2>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 mb-6 sm:mb-8">
              {t.home.ready_desc}
            </p>
            <motion.div
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {!authUser ? (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 shadow-lg min-h-[44px]">
                    <Link href="/auth">{t.home.cta_signup}</Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 shadow-lg min-h-[44px]">
                    <Link href="/practice/shadowing">
                      <Play className="w-5 h-5 mr-2" />
                      {t.home.cta_start_learning}
                    </Link>
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild variant="outline" size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 border-slate-300 dark:border-slate-700 min-h-[44px]">
                  <Link href="/profile">{t.home.learn_more}</Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </FadeInWhenVisible>
      {/* 局部样式：微动效与降低运动偏好 */}
      <style jsx>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-12px) scale(1.02); }
        }
        .animate-float-slow { animation: floatSlow 14s ease-in-out infinite; }
        @keyframes waveDrift {
          0% { transform: translateX(-25%); }
          100% { transform: translateX(0%); }
        }
        .wave-animate { animation: waveDrift 18s linear infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .animate-float-slow, .wave-animate { animation: none; }
        }
      `}</style>
    </div>
  );
}

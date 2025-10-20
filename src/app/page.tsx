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

  // 每日一题状态
  const [daily, setDaily] = useState<{
    lang: 'zh' | 'ja' | 'en';
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
  } | null>(null);

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

  // 资料或权限准备好后再拉取每日一题，避免早期为空
  useEffect(() => {
    (async () => {
      if (!authUser || !permissions.can_access_shadowing) return;
      const preferred = (profile?.target_langs?.[0] as 'zh' | 'ja' | 'en') || null;
      if (!preferred) { setDaily(null); return; }
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(`/api/shadowing/daily?lang=${preferred}`, { cache: 'no-store', credentials: 'include', headers });
        const data = await resp.json();
        if (resp.ok) setDaily(data);
        else setDaily({ lang: preferred, level: 2, error: data?.error || 'failed' });
      } catch {
        setDaily({ lang: preferred, level: 2, error: 'network' });
      }
    })();
  }, [authUser, permissions.can_access_shadowing, profile?.target_langs, getAuthHeaders]);

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
          <ParticleCanvas className="absolute inset-0 opacity-60 dark:opacity-40" maxParticles={120} />
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-400/30 to-indigo-400/30 blur-3xl dark:from-blue-700/20 dark:to-indigo-700/20 animate-float-slow" style={{ animationDelay: '0s' }} />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 blur-3xl dark:from-indigo-700/20 dark:to-purple-700/20 animate-float-slow" style={{ animationDelay: '2s' }} />

          {/* 波浪背景 */}
          <div className="absolute inset-x-0 bottom-0 overflow-hidden">
            <svg className="wave-animate w-[200%] h-24 sm:h-32 opacity-70 dark:opacity-40" viewBox="0 0 1800 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <path d="M0,64 C300,0 600,128 900,64 C1200,0 1500,128 1800,64 L1800,160 L0,160 Z" fill="url(#waveGradient)" />
            </svg>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <motion.div
              className="flex items-center justify-center mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <motion.div
                className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mr-4"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <span className="text-white font-bold text-2xl">LT</span>
              </motion.div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                {t.home.hero_title}
              </h1>
            </motion.div>
            <motion.p
              className="text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {t.home.hero_subtitle}
            </motion.p>

            {/* 顶部横幅：引导完善资料（不可关闭） */}
            {authUser && !isProfileComplete && (
              <div className="w-full mb-8">
                <div className="mx-auto max-w-7xl">
                  <div className="relative rounded-xl border border-blue-200/70 bg-blue-50/80 dark:bg-blue-900/20 dark:border-blue-800/50 backdrop-blur p-4 sm:p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-sm">
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
                    <div className="flex-shrink-0 ml-4">
                      <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Link href="/profile">{t.home.complete_profile}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hero CTA */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {!authUser ? (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3 shadow-sm">
                    <Link href="/auth">{t.home.cta_signup}</Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3 shadow-sm">
                    <Link href="/practice/shadowing">
                      <Play className="w-5 h-5 mr-2" />
                      {t.home.cta_start_learning}
                    </Link>
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3 border-slate-300 dark:border-slate-700">
                  <Link href="#quick-start">{t.home.cta_browse_features}</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* 学习目标卡片（靠上、醒目显示，仅登录用户可见） */}
            {authUser && (
              <div className="mt-8">
                <GoalCard goals={profile?.goals} maxChars={500} variant="hero" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 每日一题（登录且有Shadowing权限才显示） */}
      {authUser && permissions.can_access_shadowing && (
        <FadeInWhenVisible>
          <section className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                animate={daily?.item && daily?.phase !== 'cleared' ? { scale: [1, 1.01, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Card className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 shadow-lg backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-slate-100">{t.home.daily_title}</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-slate-400">
                      {t.home.daily_desc}
                    </CardDescription>
                  </CardHeader>
              <CardContent className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  {!profile?.target_langs?.[0] ? (
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      {t.home.set_target_language}
                      <Link href="/profile" className="text-blue-600 underline ml-1 dark:text-blue-400">{t.home.complete_profile}</Link>
                    </div>
                  ) : daily?.item ? (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xl font-bold">
                          L{daily.level}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-semibold truncate text-gray-900 dark:text-slate-100" title={daily.item.title}>{daily.item.title}</div>
                          <div className="text-sm text-gray-600 dark:text-slate-400 mt-1 flex items-center flex-wrap gap-x-3 gap-y-1">
                            <span>{t.home.daily_language}{daily.lang?.toUpperCase()}</span>
                            {typeof daily.item.duration_ms === 'number' && (
                              <span>{t.home.daily_duration.replace('{seconds}', String(Math.round((daily.item.duration_ms || 0) / 1000)))}</span>
                            )}
                            {daily.item.tokens != null && (
                              <span>{t.home.daily_length.replace('{tokens}', String(daily.item.tokens))}</span>
                            )}
                            {daily.item.cefr && <span>{t.home.daily_cefr.replace('{level}', daily.item.cefr)}</span>}
                            {daily?.phase === 'unfinished' && <span className="text-orange-600 dark:text-orange-400">{t.home.daily_last_unfinished}</span>}
                          </div>
                          <div className="mt-2 text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                            {daily.item.theme?.title && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30">
                                {t.home.daily_main_theme.replace('{title}', daily.item.theme.title)}
                              </span>
                            )}
                            {daily.item.subtopic?.title && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900/30">
                                {t.home.daily_sub_theme.replace('{title}', daily.item.subtopic.title)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : daily?.phase === 'cleared' ? (
                    <div className="text-sm text-gray-700 dark:text-slate-300">{t.home.daily_cleared}</div>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-slate-400">{t.home.daily_fetching.replace('{hint}', daily?.error ? `（${daily.error}）` : '...')}</div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {profile?.target_langs?.[0] ? (
                    daily?.item ? (
                      <Link
                        className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        href={`/practice/shadowing?lang=${daily.lang}&item=${daily.item.id}&autostart=1`}
                      >
                        {t.home.daily_quick_start}
                        <Play className="w-4 h-4 ml-2" />
                      </Link>
                    ) : (
                      <Link
                        className="inline-flex items-center px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        href={profile?.target_langs?.[0] ? `/practice/shadowing?lang=${profile.target_langs[0] as 'zh' | 'ja' | 'en'}` : '/practice/shadowing'}
                      >
                        {t.home.daily_open_practice}
                      </Link>
                    )
                  ) : (
                    <Link
                      className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                      href="/profile"
                    >
                      {t.home.go_set_target_language}
                    </Link>
                  )}
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
          <section className="py-12 bg-white/50 dark:bg-white/0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">{t.home.learn_overview}</h2>
                <p className="text-gray-600 dark:text-slate-400">{t.home.learn_overview_desc}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {progressData.map((item, index) => {
                  const displayValue = index === 0 ? animatedStudyTime : index === 1 ? animatedWeekDays : animatedVocab;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300 }}>
                        <Card className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 shadow-lg backdrop-blur">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{item.label}</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                                  {displayValue} / {item.total} {item.unit}
                                </p>
                              </div>
                              <motion.div
                                className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
                                whileHover={{ scale: 1.1, rotate: 10 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                              >
                                {index === 0 && <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                                {index === 1 && <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />}
                                {index === 2 && <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
                              </motion.div>
                            </div>
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: '100%' }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                            >
                              <Progress value={(displayValue / item.total) * 100} className="h-2" />
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
        <section id="quick-start" className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.home.quick_start}</h2>
              <p className="text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
                {t.home.quick_start_desc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickAccessItems.map(
                (item, index) =>
                  item.show && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                        aria-label={`打开 ${item.title}`}
                      >
                        <motion.div
                          whileHover={{ y: -8, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          <Card className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 shadow-lg backdrop-blur">
                            <CardHeader className="pb-4">
                              <div className="flex items-center space-x-4">
                                <motion.div
                                  className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center`}
                                  whileHover={{ scale: 1.15, rotate: 10 }}
                                  transition={{ type: 'spring', stiffness: 400 }}
                                >
                                  <item.icon className="w-6 h-6 text-white" />
                                </motion.div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {item.title}
                                  </CardTitle>
                                  <CardDescription className="text-sm text-gray-600 dark:text-slate-400">
                                    {item.description}
                                  </CardDescription>
                                </div>
                                <motion.div
                                  animate={{ x: [0, 5, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  <ArrowRight className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
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
        <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t.home.why_choose}</h2>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                {t.home.why_lead}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                >
                  <motion.div
                    className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    whileHover={{ scale: 1.1, rotate: 5, backgroundColor: 'rgba(255,255,255,0.3)' }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <feature.icon className="w-8 h-8" />
                  </motion.div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-blue-100">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </FadeInWhenVisible>

      {/* 开始学习按钮 */}
      <FadeInWhenVisible>
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.home.ready_to_start}</h2>
            <p className="text-lg text-gray-600 dark:text-slate-400 mb-8">
              {t.home.ready_desc}
            </p>
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {!authUser ? (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                    <Link href="/auth">{t.home.cta_signup}</Link>
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                    <Link href="/practice/shadowing">
                      <Play className="w-5 h-5 mr-2" />
                      {t.home.cta_start_learning}
                    </Link>
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3 border-slate-300 dark:border-slate-700">
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

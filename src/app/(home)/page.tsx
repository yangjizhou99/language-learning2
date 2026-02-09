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
  Map,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GoalCard from '@/components/GoalCard';
import { DailyTaskItem } from '@/components/home/DailyTaskItem';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import AddToHomePrompt from '@/components/AddToHomePrompt';
import { isProfileCompleteStrict } from '@/utils/profile';
import { motion } from 'framer-motion';
import { FadeInWhenVisible } from '@/components/FadeInWhenVisible';
import { useCounterAnimation } from '@/hooks/useCounterAnimation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

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

  // Main Effect: Fetch all initial data aggregated
  useEffect(() => {
    const initHome = async () => {
      if (!authUser) {
        setProfile(null);
        setDaily(null);
        setDailySecond(null);
        setDailyKorean(null);
        setDueCount(0);
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/home/init', { cache: 'no-store', headers });
        if (!res.ok) throw new Error('Init failed');

        const data = await res.json();

        // Profile
        if (data.profile) {
          setProfile(data.profile);
          // Redirect check
          if (data.profile.onboarding_completed === false) {
            window.location.href = '/onboarding';
            return;
          }
        }

        // Stats
        if (data.stats) {
          setStats(prev => ({ ...prev, ...data.stats }));
          setStatsLoaded(true);
        }

        // Daily Tasks
        if (data.daily) setDaily(data.daily);
        else if (data.profile?.target_langs?.[0]) setDaily({ lang: data.profile.target_langs[0], level: 2, error: 'failed' });

        if (data.dailySecond) setDailySecond(data.dailySecond);
        else setDailySecond(null);

        if (data.dailyKorean) setDailyKorean(data.dailyKorean);
        else setDailyKorean(null);

        // Due Count
        setDueCount(typeof data.dueCount === 'number' ? data.dueCount : 0);

      } catch (e) {
        console.error('Home init error', e);
        // Fallback or partial error handling could go here
        setStatsLoaded(true);
      }
    };

    initHome();
  }, [authUser, getAuthHeaders]); // Removed complex dependencies

  // Auto-set UI language based on profile (keep separate as it depends on profile state)
  useEffect(() => {
    if (!authUser || !profile?.native_lang) return;
    const native = profile.native_lang;
    const mapped = native === 'zh' ? 'zh' : native === 'ja' ? 'ja' : native === 'en' ? 'en' : null;
    if (mapped) setLanguage(mapped as Lang);
  }, [authUser, profile?.native_lang, setLanguage]);

  // Window Focus Revalidation (Keep separate but call same API?)
  // Optimization: Call the aggregate API again on focus to keep everything strict sync
  useEffect(() => {
    if (!authUser) return;
    const onFocus = () => {
      // Reuse the logic? Or just simplified re-fetch?
      // Let's re-fetch the aggregate to ensure consistency
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch('/api/home/init', { cache: 'no-store', headers });
          if (res.ok) {
            const data = await res.json();
            if (data.stats) setStats(prev => ({ ...prev, ...data.stats }));
            if (data.daily) setDaily(data.daily);
            if (data.dailySecond) setDailySecond(data.dailySecond);
            if (data.dailyKorean) setDailyKorean(data.dailyKorean);
            setDueCount(data.dueCount ?? 0);
          }
        } catch { }
      })();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [authUser, getAuthHeaders]);


  const isProfileComplete = isProfileCompleteStrict(profile);

  // 快速入口配置
  const quickAccessItems = [
    {
      title: t.nav.shadowing,
      description: t.home.quick_access_shadowing_desc,
      icon: GraduationCap,
      href: '/practice/shadowing',
      gradient: 'from-blue-500 to-indigo-600',
      show: permissions.can_access_shadowing,
    },
    {
      title: t.home.quick_access_storyline,
      description: t.home.quick_access_storyline_desc,
      icon: Map,
      href: '/shadowing/storyline',
      gradient: 'from-amber-400 to-orange-500',
      show: permissions.can_access_shadowing,
    },
    {
      title: t.home.quick_access_pronunciation,
      description: t.home.quick_access_pronunciation_desc,
      icon: Mic,
      href: '/practice/pronunciation',
      gradient: 'from-rose-500 to-pink-600',
      show: true,
    },
    {
      title: t.nav.alignment_practice,
      description: t.home.quick_access_alignment_desc,
      icon: AlignCenter,
      href: '/practice/alignment',
      gradient: 'from-violet-500 to-purple-600',
      show: permissions.can_access_alignment,
    },
    {
      title: t.nav.vocabulary,
      description: t.home.quick_access_vocab_desc,
      icon: BookOpen,
      href: '/vocab',
      gradient: 'from-emerald-500 to-teal-600',
      show: true,
    },
    {
      title: t.home.quick_access_profile,
      description: t.home.quick_access_profile_desc,
      icon: User,
      href: '/profile',
      gradient: 'from-pink-500 to-rose-500',
      show: !!authUser,
    },
  ];

  // 学习进度数据
  const progressData = [
    { label: t.home.progress_today, value: 45, total: 60, unit: t.home.unit_minutes },
    { label: t.home.progress_week, value: 4, total: 7, unit: t.home.unit_days },
    { label: t.home.progress_vocab, value: stats.totalVocab, total: 100, unit: t.home.unit_words },
  ];

  // 为数字添加计数动画
  const animatedVocab = useCounterAnimation(stats.totalVocab, 1500, statsLoaded && !prefersReducedMotion);
  const animatedStudyTime = useCounterAnimation(45, 1200, statsLoaded && !prefersReducedMotion);
  const animatedWeekDays = useCounterAnimation(4, 1000, statsLoaded && !prefersReducedMotion);

  return (
    <div className="min-h-screen relative antialiased overflow-x-hidden text-slate-900 dark:text-slate-100 selection:bg-blue-500/30">
      <AdminQuickAccess />

      {/* 沉浸式动态背景 (Aurora Background) */}
      <div className="fixed inset-0 -z-10 bg-slate-50 dark:bg-slate-950">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-purple-100/30 to-rose-100/40 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-rose-900/10 bg-[length:400%_400%] animate-aurora blur-3xl opacity-80" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] dark:opacity-[0.05] brightness-100 contrast-150 mix-blend-overlay" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-6 pb-20 space-y-12 sm:space-y-16">

        {/* 顶部：添加到主屏幕 prompt */}
        <div className="max-w-md mx-auto">
          <AddToHomePrompt />
        </div>

        {/* Hero Section */}
        <section className="text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative inline-block mb-6 sm:mb-8"
          >
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 opacity-40 animate-pulse-subtle" />
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-gradient-to-br from-blue-600 to-violet-600 rounded-[2rem] shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
              <span className="text-white font-bold text-3xl sm:text-4xl tracking-tighter">LT</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 dark:from-white dark:via-blue-200 dark:to-white animate-shine bg-[length:200%_auto]">
              {t.home.hero_title}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            {t.home.hero_subtitle}
          </motion.p>

          {/* Hero Actions */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            {!authUser ? (
              <Button asChild size="lg" className="h-14 px-8 rounded-full text-lg shadow-xl shadow-blue-500/25 bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all text-white">
                <Link href="/auth">{t.home.cta_signup}</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-14 px-8 rounded-full text-lg shadow-xl shadow-blue-500/25 bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all text-white group">
                <Link href="/practice/shadowing">
                  {t.home.cta_start_learning}
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-full text-lg border-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Link href={authUser ? "/profile" : "#features"}>
                {authUser ? t.home.learn_more : t.home.cta_browse_features}
              </Link>
            </Button>
          </motion.div>

          {/* Profile/Welcome Card (Glass) */}
          {authUser && !isProfileComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="max-w-3xl mx-auto"
            >
              <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t.home.welcome_title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t.home.welcome_desc}</p>
                  </div>
                </div>
                <Button asChild variant="secondary" className="shrink-0 bg-white dark:bg-slate-800 hover:bg-slate-50">
                  <Link href="/profile">{t.home.complete_profile}</Link>
                </Button>
              </div>
            </motion.div>
          )}

          {authUser && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 max-w-2xl mx-auto"
            >
              <GoalCard goals={profile?.goals} maxChars={500} variant="hero" />
            </motion.div>
          )}
        </section>

        {/* Dashboard Grid */}
        {authUser && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Column: Daily Tasks & Stats (8 cols) */}
            <div className="lg:col-span-8 space-y-8">

              {/* Daily Tasks */}
              {permissions.can_access_shadowing && (
                <FadeInWhenVisible>
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                        <Zap className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold">{t.home.daily_title}</h2>
                    </div>

                    <div className="glass-card rounded-3xl p-1 overflow-hidden">
                      <div className="bg-white/50 dark:bg-slate-900/50 p-6 sm:p-8 rounded-[1.3rem] space-y-6">
                        {/* Tasks List */}
                        <div className="space-y-1">
                          {!profile?.target_langs?.[0] && (
                            <div className="text-center py-8 text-slate-500">
                              {t.home.set_target_language} <Link href="/profile" className="text-blue-600 hover:underline">{t.home.complete_profile}</Link>
                            </div>
                          )}

                          {/* Task Items */}
                          {profile?.target_langs?.[0] && (
                            <DailyTaskItem
                              data={daily}
                              t={t}
                              colorClass="from-blue-500 to-indigo-500"
                              buttonColorClass="bg-blue-600 hover:bg-blue-700"
                              fallbackHref={profile?.target_langs?.[0] ? `/practice/shadowing?lang=${profile.target_langs[0]}` : '/practice/shadowing'}
                            />
                          )}
                          {profile?.target_langs?.[1] && dailySecond && (
                            <DailyTaskItem
                              data={dailySecond}
                              t={t}
                              colorClass="from-indigo-500 to-purple-500"
                              buttonColorClass="bg-indigo-600 hover:bg-indigo-700"
                              fallbackHref={`/practice/shadowing?lang=${profile.target_langs[1]}`}
                            />
                          )}
                          {dailyKorean && (
                            <DailyTaskItem
                              data={dailyKorean}
                              t={t}
                              colorClass="from-pink-500 to-rose-500"
                              buttonColorClass="bg-pink-600 hover:bg-pink-700"
                              fallbackHref="/practice/shadowing?lang=ko"
                            />
                          )}

                          {/* Vocab Review Task */}
                          <div className="flex items-center justify-between gap-4 sm:gap-6 pt-6 mt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-colors",
                                dueCount > 0
                                  ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                              )}>
                                <BookOpen className="w-6 h-6" />
                              </div>
                              <div>
                                <div className="font-semibold text-lg">{t.home.tasks_vocab_title}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  {dueCount > 0
                                    ? t.home.tasks_vocab_due.replace('{count}', String(dueCount))
                                    : t.home.tasks_vocab_done}
                                </div>
                              </div>
                            </div>
                            {dueCount > 0 ? (
                              <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                                <Link href="/vocab">{t.home.tasks_go_review}</Link>
                              </Button>
                            ) : (
                              <div className="px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                                {t.home.tasks_completed_badge}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </FadeInWhenVisible>
              )}

              {/* Stats Overview */}
              <FadeInWhenVisible delay={0.1}>
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold">{t.home.learn_overview}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {progressData.map((item, index) => {
                      const displayValue = index === 0 ? animatedStudyTime : index === 1 ? animatedWeekDays : animatedVocab;
                      const Icon = index === 0 ? Clock : index === 1 ? TrendingUp : BookOpen;
                      const color = index === 0 ? 'text-blue-500' : index === 1 ? 'text-green-500' : 'text-purple-500';

                      return (
                        <div key={index} className="glass-card hover:translate-y-[-4px] transition-transform duration-300 p-5 rounded-2xl flex flex-col justify-between h-32">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">{item.label}</span>
                            <Icon className={cn("w-5 h-5", color)} />
                          </div>
                          <div>
                            <div className="text-3xl font-bold tracking-tight mb-1">
                              {displayValue} <span className="text-sm font-normal text-slate-400">{item.unit}</span>
                            </div>
                            <Progress value={(displayValue / item.total) * 100} className="h-1.5 bg-slate-100 dark:bg-slate-800" indicatorClassName={index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-green-500' : 'bg-purple-500'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </FadeInWhenVisible>
            </div>

            {/* Right Column: Quick Access (4 cols) */}
            <div className="lg:col-span-4 space-y-8">
              <FadeInWhenVisible delay={0.2}>
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                      <Zap className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold">{t.home.quick_start}</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                    {quickAccessItems.map((item, idx) => (
                      item.show && (
                        <Link
                          key={idx}
                          href={item.href}
                          className="group relative block"
                        >
                          <div className="glass-card glass-card-hover p-4 rounded-xl flex items-center gap-4 group-active:scale-[0.98]">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br", item.gradient)}>
                              <item.icon className="w-6 h-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">{item.title}</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{item.description}</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                          </div>
                        </Link>
                      )
                    ))}
                  </div>
                </section>
              </FadeInWhenVisible>
            </div>
          </div>
        )}

        {/* Feature Highlights (for non-logged in or at bottom) */}
        <section id="features" className="py-12 border-t border-slate-200/50 dark:border-slate-800/50 mt-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t.home.why_choose}</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">{t.home.why_lead}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: t.home.smart_learning, desc: t.home.smart_learning_desc, color: "text-amber-500" },
              { icon: BarChart3, title: t.home.progress_tracking, desc: t.home.progress_tracking_desc, color: "text-blue-500" },
              { icon: Bookmark, title: t.home.multi_mode, desc: t.home.multi_mode_desc, color: "text-rose-500" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-8 rounded-3xl text-center hover:shadow-2xl transition-shadow"
              >
                <div className={cn("w-16 h-16 mx-auto mb-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center", feature.color)}>
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

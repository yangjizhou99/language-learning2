'use client';
import Link from 'next/link';
import AdminQuickAccess from '@/components/AdminQuickAccess';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import useUserPermissions from '@/hooks/useUserPermissions';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BookOpen,
  Target,
  AlignCenter,
  FileText,
  GraduationCap,
  User,
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
  Bookmark,
  BarChart3,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import ParticleCanvas from '@/components/ParticleCanvas';

export default function Home() {
  const t = useTranslation();
  const { permissions } = useUserPermissions();
  const { getAuthHeaders } = useAuth();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{
    username?: string;
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
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // 获取用户资料
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, bio, goals, native_lang, target_langs, domains')
          .eq('id', user.id)
          .single();
        setProfile(profileData);

        // 获取用户统计数据
        fetchUserStats(user.id);
      }
    };
    checkUser();
  }, []);

  // 资料或权限准备好后再拉取每日一题，避免早期为空
  useEffect(() => {
    (async () => {
      if (!user || !permissions.can_access_shadowing) return;
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
  }, [user, permissions.can_access_shadowing, profile?.target_langs, getAuthHeaders]);

  const fetchUserStats = async (userId: string) => {
    try {
      // 获取生词数量
      const { count: vocabCount } = await supabase
        .from('user_vocab')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // 这里可以添加更多统计数据的获取
      setStats((prev) => ({
        ...prev,
        totalVocab: vocabCount || 0,
      }));
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const isProfileComplete =
    profile &&
    (profile.username ||
      profile.bio ||
      profile.goals ||
      profile.native_lang ||
      (profile.target_langs && profile.target_langs.length > 0) ||
      (profile.domains && profile.domains.length > 0));

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
      title: t.nav.cloze,
      description: '完形填空，巩固语法和词汇',
      icon: Target,
      href: '/practice/cloze',
      color: 'bg-green-500',
      show: permissions.can_access_cloze,
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
      title: t.nav.wide_reading,
      description: '广泛阅读，扩展知识面',
      icon: FileText,
      href: '/practice/wideread',
      color: 'bg-orange-500',
      show: permissions.can_access_articles,
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
      show: !!user,
    },
  ];

  // 学习进度数据
  const progressData = [
    { label: '今日学习', value: 45, total: 60, unit: '分钟' },
    { label: '本周目标', value: 4, total: 7, unit: '天' },
    { label: '词汇掌握', value: stats.totalVocab, total: 100, unit: '个' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 antialiased">
      <AdminQuickAccess />

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
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mr-4">
                <span className="text-white font-bold text-2xl">LT</span>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                {t.home.hero_title}
              </h1>
            </div>
            <p className="text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              {t.home.hero_subtitle}
            </p>

            {/* 个人资料提示 */}
            {user && !isProfileComplete && (
              <div className="rounded-xl p-6 max-w-md mx-auto mb-8 bg-white/70 dark:bg-slate-900/60 backdrop-blur border border-blue-200/60 dark:border-blue-900/30">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👋</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  {t.home.welcome_title}
                </h3>
                <p className="text-blue-600 dark:text-blue-300/90 text-sm mb-4">{t.home.welcome_desc}</p>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/profile">{t.home.complete_profile}</Link>
                </Button>
              </div>
            )}

            {/* Hero CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-2">
              {!user ? (
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3 shadow-sm">
                  <Link href="/auth">{t.home.cta_signup}</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3 shadow-sm">
                  <Link href="/practice/shadowing">
                    <Play className="w-5 h-5 mr-2" />
                    {t.home.cta_start_learning}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3 border-slate-300 dark:border-slate-700">
                <Link href="#quick-start">{t.home.cta_browse_features}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 每日一题（登录且有Shadowing权限才显示） */}
      {user && permissions.can_access_shadowing && (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          </div>
        </section>
      )}

      {/* 学习统计 */}
      {user && (
        <section className="py-12 bg-white/50 dark:bg-white/0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">{t.home.learn_overview}</h2>
              <p className="text-gray-600 dark:text-slate-400">{t.home.learn_overview_desc}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {progressData.map((item, index) => (
                <Card key={index} className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 shadow-lg backdrop-blur">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-slate-400">{item.label}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {item.value} / {item.total} {item.unit}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        {index === 0 && <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                        {index === 1 && <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />}
                        {index === 2 && <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
                      </div>
                    </div>
                    <Progress value={(item.value / item.total) * 100} className="h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 快速入口 */}
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
                  <Link
                    key={index}
                    href={item.href}
                    className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                    aria-label={`打开 ${item.title}`}
                  >
                    <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 shadow-lg backdrop-blur">
                      <CardHeader className="pb-4">
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                          >
                            <item.icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {item.title}
                            </CardTitle>
                            <CardDescription className="text-sm text-gray-600 dark:text-slate-400">
                              {item.description}
                            </CardDescription>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ),
            )}
          </div>
        </div>
      </section>

      {/* 功能特色 */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t.home.why_choose}</h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              {t.home.why_lead}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.home.smart_learning}</h3>
              <p className="text-blue-100">{t.home.smart_learning_desc}</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.home.progress_tracking}</h3>
              <p className="text-blue-100">{t.home.progress_tracking_desc}</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.home.multi_mode}</h3>
              <p className="text-blue-100">{t.home.multi_mode_desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 开始学习按钮 */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.home.ready_to_start}</h2>
          <p className="text-lg text-gray-600 dark:text-slate-400 mb-8">
            {t.home.ready_desc}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                <Link href="/auth">{t.home.cta_signup}</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                <Link href="/practice/shadowing">
                  <Play className="w-5 h-5 mr-2" />
                  {t.home.cta_start_learning}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3 border-slate-300 dark:border-slate-700">
              <Link href="/profile">{t.home.learn_more}</Link>
            </Button>
          </div>
        </div>
      </section>
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

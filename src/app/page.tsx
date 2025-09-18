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

export default function Home() {
  const t = useTranslation();
  const { permissions } = useUserPermissions();
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <AdminQuickAccess />

      {/* 英雄区域 */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mr-4">
                <span className="text-white font-bold text-2xl">LT</span>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Lang Trainer
              </h1>
            </div>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              智能语言学习平台，通过多种练习模式帮助您快速提升语言能力
            </p>

            {/* 个人资料提示 */}
            {user && !isProfileComplete && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 max-w-md mx-auto mb-8">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👋</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  欢迎使用 Lang Trainer！
                </h3>
                <p className="text-blue-600 text-sm mb-4">完善您的个人资料，获得更好的学习体验</p>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/profile">完善个人资料</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 学习统计 */}
      {user && (
        <section className="py-12 bg-white/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">学习概览</h2>
              <p className="text-gray-600">您的学习进度和成就</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {progressData.map((item, index) => (
                <Card key={index} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{item.label}</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {item.value} / {item.total} {item.unit}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        {index === 0 && <Clock className="w-6 h-6 text-blue-600" />}
                        {index === 1 && <TrendingUp className="w-6 h-6 text-green-600" />}
                        {index === 2 && <BookOpen className="w-6 h-6 text-purple-600" />}
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
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">快速开始</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              选择您想要练习的内容，开始您的语言学习之旅
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickAccessItems.map(
              (item, index) =>
                item.show && (
                  <Card
                    key={index}
                    className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-1"
                  >
                    <Link href={item.href}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                          >
                            <item.icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                              {item.title}
                            </CardTitle>
                            <CardDescription className="text-sm text-gray-600">
                              {item.description}
                            </CardDescription>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </CardHeader>
                    </Link>
                  </Card>
                ),
            )}
          </div>
        </div>
      </section>

      {/* 功能特色 */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">为什么选择 Lang Trainer？</h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              我们提供最先进的语言学习工具和方法
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">智能学习</h3>
              <p className="text-blue-100">AI驱动的个性化学习路径，根据您的进度调整难度</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">进度跟踪</h3>
              <p className="text-blue-100">详细的学习统计和进度分析，让您清楚了解学习效果</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">多模式练习</h3>
              <p className="text-blue-100">跟读、完形填空、对齐练习等多种学习模式</p>
            </div>
          </div>
        </div>
      </section>

      {/* 开始学习按钮 */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">准备开始学习了吗？</h2>
          <p className="text-lg text-gray-600 mb-8">
            选择您感兴趣的学习模式，立即开始您的语言学习之旅
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                <Link href="/auth">立即注册</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                <Link href="/practice/shadowing">
                  <Play className="w-5 h-5 mr-2" />
                  开始学习
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3">
              <Link href="/profile">了解更多</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

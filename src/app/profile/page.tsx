'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useLanguage, useTranslation } from '@/contexts/LanguageContext';
import { User, Save, Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string | null;
  bio: string | null;
  goals: string | null;
  preferred_tone: string | null;
  domains: string[];
  native_lang: string | null;
  target_langs: string[];
  created_at: string;
}

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
];

const TONE_OPTIONS = [
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '随意' },
  { value: 'professional', label: '专业' },
  { value: 'friendly', label: '友好' },
  { value: 'academic', label: '学术' },
];

const DOMAIN_OPTIONS = [
  { value: 'business', label: '商务' },
  { value: 'technology', label: '科技' },
  { value: 'education', label: '教育' },
  { value: 'healthcare', label: '医疗' },
  { value: 'finance', label: '金融' },
  { value: 'travel', label: '旅游' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'sports', label: '体育' },
  { value: 'news', label: '新闻' },
  { value: 'lifestyle', label: '生活' },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const t = useTranslation();
  const { language } = useLanguage();

  // 表单状态
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    goals: '',
    preferred_tone: '',
    domains: [] as string[],
    native_lang: '',
    target_langs: [] as string[],
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      // 获取当前用户
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;

      setUser(user);

      // 获取用户资料
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
      setFormData({
        username: profileData.username || '',
        bio: profileData.bio || '',
        goals: profileData.goals || '',
        preferred_tone: profileData.preferred_tone || '',
        domains: profileData.domains || [],
        native_lang: profileData.native_lang || '',
        target_langs: profileData.target_langs || [],
      });
    } catch (error) {
      console.error('加载资料失败:', error);
      toast.error(t.profile.load_failed || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username || null,
          bio: formData.bio || null,
          goals: formData.goals || null,
          preferred_tone: formData.preferred_tone || null,
          domains: formData.domains,
          native_lang: formData.native_lang || null,
          target_langs: formData.target_langs,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(t.profile.save_success || t.common.success);
      await loadProfile(); // 重新加载数据
    } catch (error) {
      console.error('保存失败:', error);
      toast.error(t.profile.save_failed || t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const handleDomainToggle = (domain: string) => {
    setFormData((prev) => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter((d) => d !== domain)
        : [...prev.domains, domain],
    }));
  };

  const handleTargetLangToggle = (lang: string) => {
    setFormData((prev) => ({
      ...prev,
      target_langs: prev.target_langs.includes(lang)
        ? prev.target_langs.filter((l) => l !== lang)
        : [...prev.target_langs, lang],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t.profile.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            {t.profile.title}
          </h1>
          <p className="text-muted-foreground mt-2">{t.profile.subtitle}</p>
        </div>

        <div className="grid gap-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>{t.profile.section_basic}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user?.email || '')}`}
                  />
                  <AvatarFallback className="text-lg">
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.profile.registered_at}: {new Date(profile?.created_at || '').toLocaleDateString(t.profile.date_locales[language])}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">{t.profile.username}</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder={t.profile.username_placeholder}
                  />
                </div>
                <div>
                  <Label htmlFor="native_lang">{t.profile.native_language}</Label>
                  <Select
                    value={formData.native_lang}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, native_lang: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.profile.native_language_placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {t.profile.language_labels[lang.value] ?? lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="bio">{t.profile.bio}</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder={t.profile.bio_placeholder}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="goals">{t.profile.goals}</Label>
                <Textarea
                  id="goals"
                  value={formData.goals}
                  onChange={(e) => setFormData((prev) => ({ ...prev, goals: e.target.value }))}
                  placeholder={t.profile.goals_placeholder}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 学习偏好 */}
          <Card>
            <CardHeader>
              <CardTitle>{t.profile.section_preferences}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>{t.profile.target_languages}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LANGUAGES.map((lang) => (
                    <Badge
                      key={lang.value}
                      variant={formData.target_langs.includes(lang.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleTargetLangToggle(lang.value)}
                    >
                      {t.profile.language_labels[lang.value] ?? lang.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="preferred_tone">{t.profile.preferred_tone}</Label>
                <Select
                  value={formData.preferred_tone}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, preferred_tone: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.profile.preferred_tone_placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {t.profile.tones[tone.value as keyof typeof t.profile.tones] ?? tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t.profile.interested_domains}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DOMAIN_OPTIONS.map((domain) => (
                    <Badge
                      key={domain.value}
                      variant={formData.domains.includes(domain.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleDomainToggle(domain.value)}
                    >
                      {t.profile.domains[domain.value as keyof typeof t.profile.domains] ?? domain.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="min-w-32">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.profile.saving}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t.profile.save}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

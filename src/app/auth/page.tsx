'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/contexts/LanguageContext';
import type { RegistrationConfig } from '@/types/registrationConfig';

export default function AuthPage() {
  const router = useRouter();
  const t = useTranslation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectTo = `${origin}/auth/callback`;

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [isValidatingInvitation, setIsValidatingInvitation] = useState(false);
  const [showInvitationForm, setShowInvitationForm] = useState(true); // 默认展开邀请码注册
  const [registrationConfig, setRegistrationConfig] = useState<RegistrationConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s?.session?.user) router.replace('/');
    })();
  }, [router]);

  // 获取注册配置
  useEffect(() => {
    fetchRegistrationConfig();
  }, []);

  const fetchRegistrationConfig = async () => {
    try {
      setConfigLoading(true);
      const response = await fetch('/api/registration-config');

      if (response.ok) {
        const data = await response.json();
        setRegistrationConfig(data.config);
      }
    } catch (error) {
      console.error('获取注册配置失败:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const signUp = async () => {
    if (!registrationConfig?.allow_direct_registration) {
      setMsg(t.auth.invitation_required);
      return;
    }

    setMsg('');
    const { error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: { emailRedirectTo: redirectTo },
    });
    setMsg(error ? `${t.auth.signup_failed}：${error.message}` : t.auth.signup_success_email);
  };

  // 合并验证和注册为一个操作
  const validateAndRegister = async () => {
    // 验证输入
    if (!invitationCode.trim()) {
      setMsg(t.auth.invitation_required);
      return;
    }
    if (!email.trim()) {
      setMsg('请输入邮箱');
      return;
    }
    if (!pw.trim()) {
      setMsg('请输入密码');
      return;
    }
    if (pw.length < 6) {
      setMsg(t.form.password_min);
      return;
    }

    setIsValidatingInvitation(true);
    setMsg(t.auth.invitation_validating);

    try {
      // 直接调用注册接口，后端会验证邀请码
      const response = await fetch('/api/auth/register-with-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: pw,
          invitation_code: invitationCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMsg('注册成功！正在自动登录...');

        // 等待一小段时间让权限应用完成
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 自动登录
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) {
          setMsg(`注册成功，但自动登录失败：${error.message}`);
        } else {
          setMsg('登录成功！正在跳转...');
          // 等待一下让权限状态更新
          await new Promise((resolve) => setTimeout(resolve, 500));
          router.replace('/');
        }
      } else {
        setMsg(`注册失败：${data.error}`);
      }
    } catch (error) {
      console.error('注册失败:', error);
      setMsg('注册时发生错误');
    } finally {
      setIsValidatingInvitation(false);
    }
  };

  const signIn = async () => {
    setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg(`${t.auth.login_failed}：${error.message}`);
    else router.replace('/');
  };

  const signInWithGoogle = async () => {
    setMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) setMsg(`${t.auth.google_login_failed}：${error.message}`);
  };

  // 维护模式检查
  if (registrationConfig?.maintenance_mode) {
    return (
      <main className="max-w-xl mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">{t.auth.maintenance_mode}</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              {registrationConfig.maintenance_message || t.auth.maintenance_desc}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (configLoading) {
    return (
      <main className="max-w-xl mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t.auth.login_register_title}</h1>
      {msg && (
        <div className={`text-sm ${msg.includes('成功') ? 'text-green-700' : 'text-red-700'}`}>
          {msg}
        </div>
      )}

      {/* 登录区域 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">{t.auth.user_login}</h2>
        <input
          className="border rounded px-2 py-1 w-full"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 w-full"
          type="password"
          placeholder={t.form.password_min}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={signIn} className="px-3 py-1 rounded border">
            {t.common.login}
          </button>
          {registrationConfig?.allow_direct_registration && (
            <button onClick={signUp} className="px-3 py-1 rounded bg-black text-white">
              {t.common.register}
            </button>
          )}
        </div>
      </section>

      {/* 邀请码注册 */}
      {registrationConfig?.allow_invitation_registration && (
        <section
          className={`p-4 rounded-2xl shadow space-y-3 ${!registrationConfig?.allow_direct_registration
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200'
              : 'bg-white'
            }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-blue-800">🎫 {t.auth.invitation_register}</h2>
            {!registrationConfig?.allow_direct_registration && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                {t.auth.only_way}
              </span>
            )}
          </div>

          {showInvitationForm && (
            <div className="space-y-3">
              <div className="space-y-2">
                <input
                  className="border rounded px-2 py-1 w-full"
                  placeholder={t.form.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="border rounded px-2 py-1 w-full"
                  type="password"
                  placeholder={t.auth.password_placeholder}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <input
                  className="border rounded px-2 py-1 w-full"
                  placeholder={t.auth.invitation_placeholder}
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>

              <button
                onClick={validateAndRegister}
                disabled={isValidatingInvitation}
                className="w-full px-3 py-2 rounded bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isValidatingInvitation ? t.auth.processing : t.auth.verify_register}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Temporarily disabled Google login */}
      {/* <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">{t.auth.google_login}</h2>
        <button onClick={signInWithGoogle}
                className="px-3 py-1 rounded border">{t.auth.use_google_login}</button>
      </section> */}
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/contexts/LanguageContext";
import { validateInvitationCode } from "@/lib/invitation";
import type { InvitationValidationResult } from "@/types/invitation";
import type { RegistrationConfig } from "@/types/registrationConfig";

export default function AuthPage() {
  const router = useRouter();
  const t = useTranslation();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback`;

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [invitationValidation, setInvitationValidation] = useState<InvitationValidationResult | null>(null);
  const [isValidatingInvitation, setIsValidatingInvitation] = useState(false);
  const [showInvitationForm, setShowInvitationForm] = useState(true); // 默认展开邀请码注册
  const [registrationConfig, setRegistrationConfig] = useState<RegistrationConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s?.session?.user) router.replace("/");
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
      setMsg("当前不允许直接注册，请使用邀请码注册");
      return;
    }

    setMsg("");
    const { error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: redirectTo }
    });
    setMsg(error ? `${t.auth.signup_failed}：${error.message}` :
      t.auth.signup_success_email);
  };

  const validateInvitation = async () => {
    if (!invitationCode.trim()) {
      setMsg("请输入邀请码");
      return;
    }

    setIsValidatingInvitation(true);
    setMsg("");

    try {
      const result = await validateInvitationCode(invitationCode);
      setInvitationValidation(result);
      
      if (result.is_valid) {
        setMsg("邀请码验证成功！");
      } else {
        setMsg(`邀请码验证失败：${result.error_message}`);
      }
    } catch (error) {
      console.error('验证邀请码失败:', error);
      setMsg("验证邀请码时发生错误");
    } finally {
      setIsValidatingInvitation(false);
    }
  };

  const registerWithInvitation = async () => {
    if (!invitationValidation?.is_valid) {
      setMsg("请先验证邀请码");
      return;
    }

    setMsg("");

    try {
      const response = await fetch('/api/auth/register-with-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password: pw,
          invitation_code: invitationCode
        })
      });

      const data = await response.json();

      if (data.success) {
        setMsg("注册成功！正在跳转...");
        // 自动登录
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) {
          setMsg(`注册成功，但自动登录失败：${error.message}`);
        } else {
          router.replace("/");
        }
      } else {
        setMsg(`注册失败：${data.error}`);
      }
    } catch (error) {
      console.error('注册失败:', error);
      setMsg("注册时发生错误");
    }
  };

  const signIn = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg(`${t.auth.login_failed}：${error.message}`);
    else router.replace("/");
  };

  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) setMsg(`${t.auth.google_login_failed}：${error.message}`);
  };

  // 维护模式检查
  if (registrationConfig?.maintenance_mode) {
    return (
      <main className="max-w-xl mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">系统维护中</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              {registrationConfig.maintenance_message || '系统正在维护中，请稍后再试'}
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
      <h1 className="text-2xl font-semibold">登录 / 注册</h1>
      {msg && <div className={`text-sm ${msg.includes('成功') ? 'text-green-700' : 'text-red-700'}`}>{msg}</div>}

      {/* 登录区域 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">用户登录</h2>
        <input className="border rounded px-2 py-1 w-full"
               placeholder="email@example.com" value={email}
               onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" type="password"
               placeholder={t.form.password_min} value={pw}
               onChange={e=>setPw(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={signIn} className="px-3 py-1 rounded border">{t.common.login}</button>
          {registrationConfig?.allow_direct_registration && (
            <button onClick={signUp} className="px-3 py-1 rounded bg-black text-white">{t.common.register}</button>
          )}
        </div>
      </section>

      {/* 邀请码注册 */}
      {registrationConfig?.allow_invitation_registration && (
        <section className={`p-4 rounded-2xl shadow space-y-3 ${
          !registrationConfig?.allow_direct_registration 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200' 
            : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-blue-800">🎫 邀请码注册</h2>
            {!registrationConfig?.allow_direct_registration && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">唯一注册方式</span>
            )}
          </div>
        
        {showInvitationForm && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input 
                className="border rounded px-2 py-1 flex-1"
                placeholder="请输入8位邀请码" 
                value={invitationCode}
                onChange={e => setInvitationCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
              <button 
                onClick={validateInvitation}
                disabled={isValidatingInvitation}
                className="px-3 py-1 rounded border bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
              >
                {isValidatingInvitation ? '验证中...' : '验证'}
              </button>
            </div>
            
            {invitationValidation && (
              <div className={`p-3 rounded text-sm ${
                invitationValidation.is_valid 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {invitationValidation.is_valid ? (
                  <div>
                    <p className="font-medium">✅ 邀请码验证成功！</p>
                    <p className="text-xs mt-1">
                      使用次数：{invitationValidation.used_count}/{invitationValidation.max_uses}
                      {invitationValidation.expires_at && (
                        <span> | 过期时间：{new Date(invitationValidation.expires_at).toLocaleDateString()}</span>
                      )}
                    </p>
                    {invitationValidation.permissions && (
                      <div className="mt-2 text-xs">
                        <p className="font-medium">权限设置：</p>
                        <div className="space-y-2 mt-1">
                          {/* 功能权限 */}
                          <div>
                            <p className="text-gray-600 font-medium">功能权限：</p>
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {invitationValidation.permissions.can_access_shadowing && <span>✓ Shadowing 练习</span>}
                              {invitationValidation.permissions.can_access_cloze && <span>✓ Cloze 练习</span>}
                              {invitationValidation.permissions.can_access_alignment && <span>✓ Alignment 练习</span>}
                              {invitationValidation.permissions.can_access_articles && <span>✓ 广读文章</span>}
                            </div>
                          </div>
                          
                          {/* 语言权限 */}
                          {invitationValidation.permissions.allowed_languages && invitationValidation.permissions.allowed_languages.length > 0 && (
                            <div>
                              <p className="text-gray-600 font-medium">允许语言：</p>
                              <span className="text-gray-800">
                                {invitationValidation.permissions.allowed_languages.map(lang => 
                                  lang === 'en' ? '英语' : lang === 'ja' ? '日语' : '中文'
                                ).join(', ')}
                              </span>
                            </div>
                          )}
                          
                          {/* 难度等级 */}
                          {invitationValidation.permissions.allowed_levels && invitationValidation.permissions.allowed_levels.length > 0 && (
                            <div>
                              <p className="text-gray-600 font-medium">难度等级：</p>
                              <span className="text-gray-800">
                                等级 {invitationValidation.permissions.allowed_levels.join(', ')}
                              </span>
                            </div>
                          )}
                          
                          {/* 使用限制 */}
                          {invitationValidation.permissions.max_daily_attempts && (
                            <div>
                              <p className="text-gray-600 font-medium">每日限制：</p>
                              <span className="text-gray-800">
                                {invitationValidation.permissions.max_daily_attempts} 次练习
                              </span>
                            </div>
                          )}
                          
                          {/* AI功能 */}
                          {invitationValidation.permissions.ai_enabled && (
                            <div>
                              <p className="text-gray-600 font-medium">AI功能：</p>
                              <span className="text-gray-800">✓ 启用</span>
                            </div>
                          )}
                          
                          {/* API使用限制 */}
                          {invitationValidation.permissions.api_limits?.enabled && (
                            <div>
                              <p className="text-gray-600 font-medium">API使用限制：</p>
                              <div className="text-gray-800 text-xs space-y-1">
                                <div>每日: {invitationValidation.permissions.api_limits.daily_calls_limit}次调用, 
                                {invitationValidation.permissions.api_limits.daily_tokens_limit} tokens, 
                                ${invitationValidation.permissions.api_limits.daily_cost_limit}</div>
                                <div>每月: {invitationValidation.permissions.api_limits.monthly_calls_limit}次调用, 
                                {invitationValidation.permissions.api_limits.monthly_tokens_limit} tokens, 
                                ${invitationValidation.permissions.api_limits.monthly_cost_limit}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* API密钥配置 */}
                          {(invitationValidation.permissions.api_keys?.deepseek || invitationValidation.permissions.api_keys?.openrouter) && (
                            <div>
                              <p className="text-gray-600 font-medium">API密钥配置：</p>
                              <div className="text-gray-800 text-xs space-y-1">
                                {invitationValidation.permissions.api_keys?.deepseek && (
                                  <div>✓ DeepSeek API Key 已配置</div>
                                )}
                                {invitationValidation.permissions.api_keys?.openrouter && (
                                  <div>✓ OpenRouter API Key 已配置</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* 模型权限 */}
                          {invitationValidation.permissions.model_permissions && invitationValidation.permissions.model_permissions.length > 0 && (
                            <div>
                              <p className="text-gray-600 font-medium">可用AI模型：</p>
                              <div className="text-gray-800 text-xs space-y-1">
                                {invitationValidation.permissions.model_permissions.map((model, index) => (
                                  <div key={index}>
                                    {model.enabled ? '✓' : '✗'} {model.model_name} 
                                    ({model.daily_limit}次/日, {model.token_limit} tokens)
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>❌ {invitationValidation.error_message}</p>
                )}
              </div>
            )}
            
            {invitationValidation?.is_valid && (
              <button 
                onClick={registerWithInvitation}
                className="w-full px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                使用邀请码注册
              </button>
            )}
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

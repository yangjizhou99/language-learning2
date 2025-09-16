"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ShadowingReviewDetail(){
  const params = useParams<{ id:string }>();
  const id = params?.id;
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [ttsLoading, setTtsLoading] = useState(false);
  
  // 翻译相关状态
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [transLoading, setTransLoading] = useState(false);
  const [transProvider, setTransProvider] = useState('deepseek');
  const [transModel, setTransModel] = useState('deepseek-chat');
  const [transTemperature, setTransTemperature] = useState(0.3);
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(()=>{ (async()=>{
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
    const j = await r.json();
    setDraft(j.draft);
    // 设置翻译内容
    if (j.draft?.translations) {
      setTranslations(j.draft.translations);
    }
  })(); }, [id]);

  // 加载可用模型
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  async function save(){
    if (!draft) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, { 
      method:"PUT", 
      headers:{"Content-Type":"application/json", ...(token? { Authorization: `Bearer ${token}` }: {})}, 
      body: JSON.stringify({ 
        title:draft.title, 
        topic:draft.topic, 
        genre:draft.genre, 
        register:draft.register, 
        text:draft.text, 
        notes:draft.notes,
        translations: translations,
        trans_updated_at: translations && Object.keys(translations).length > 0 ? new Date().toISOString() : null
      }) 
    });
    setSaving(false);
    setLog(r.ok? "已保存" : `保存失败: ${r.status}`);
  }

  async function publish(){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, { method:"POST", headers:{"Content-Type":"application/json", ...(token? { Authorization: `Bearer ${token}` }: {})}, body: JSON.stringify({ action:"publish" }) });
    if (r.ok) router.push("/admin/shadowing/review");
    else setLog(`发布失败: ${r.status}`);
  }

  async function synthAndAttach(){
    try {
      setTtsLoading(true); setLog("合成中…");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/synthesize', {
        method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) },
        body: JSON.stringify({ text: draft.text, lang: draft.lang, voice: draft?.notes?.voice || null, speakingRate: draft?.notes?.speakingRate || 1.0 })
      });
      const j = await r.json();
      if (!r.ok) { setLog('合成失败：' + (j.error||r.statusText)); setTtsLoading(false); return; }
      setAudioUrl(j.audio_url);
      // 将音频 URL 写入 notes.audio_url，保存草稿
      const next = { ...draft, notes: { ...(draft.notes||{}), audio_url: j.audio_url } };
      setDraft(next);
      await save();
      setLog('已合成并保存到草稿 Notes');
      setTtsLoading(false);
    } catch (e:any) {
      setTtsLoading(false); setLog('合成异常：' + (e.message||String(e)));
    }
  }

  // 生成翻译
  async function generateTranslations(force = false) {
    if (!draft) return;
    
    try {
      setTransLoading(true);
      setLog("生成翻译中…");
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch('/api/admin/shadowing/translate/one', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: draft.id,
          scope: 'drafts',
          provider: transProvider,
          model: transModel,
          temperature: transTemperature,
          force
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '翻译失败');
      }
      
      setTranslations(result.translations);
      setLog('翻译生成完成');
      
      // 更新草稿数据
      setDraft((prev: any) => ({
        ...prev,
        translations: result.translations,
        trans_updated_at: result.trans_updated_at
      }));
      
    } catch (error: any) {
      setLog('翻译失败：' + (error.message || String(error)));
    } finally {
      setTransLoading(false);
    }
  }

  // 获取目标语言
  function getTargetLanguages(sourceLang: string): string[] {
    switch (sourceLang) {
      case 'zh': return ['en', 'ja'];
      case 'en': return ['ja', 'zh'];
      case 'ja': return ['en', 'zh'];
      default: return [];
    }
  }

  // 获取语言名称
  function getLangName(lang: string): string {
    const names = {
      'en': 'English',
      'ja': '日本語',
      'zh': '简体中文'
    };
    return names[lang as keyof typeof names] || lang;
  }

  // 获取可用模型
  async function fetchAvailableModels() {
    try {
      setModelsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch('/api/admin/shadowing/translate/models', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const result = await response.json();
        setAvailableModels(result.models);
        
        // 如果当前模型不在新列表中，重置为默认模型
        if (result.models[transProvider] && !result.models[transProvider].includes(transModel)) {
          setTransModel(result.models[transProvider][0] || '');
        }
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setModelsLoading(false);
    }
  }

  // 提供商改变时重置模型
  const handleProviderChange = (provider: string) => {
    setTransProvider(provider);
    if (availableModels[provider] && availableModels[provider].length > 0) {
      setTransModel(availableModels[provider][0]);
    }
  };

  if (!draft) return <div>加载中…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shadowing 草稿详情</h1>
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-500">标题</div>
            <input className="w-full border rounded px-2 py-1" value={draft.title||""} onChange={e=> setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <div className="text-sm text-gray-500">主题</div>
            <input className="w-full border rounded px-2 py-1" value={draft.topic||""} onChange={e=> setDraft({ ...draft, topic: e.target.value })} />
          </div>
          <div>
            <div className="text-sm text-gray-500">体裁 / 语域</div>
            <div className="flex gap-2">
              <select className="border rounded px-2 py-1" value={draft.genre||"monologue"} onChange={e=> setDraft({ ...draft, genre: e.target.value })}>
                <option value="monologue">monologue</option>
                <option value="dialogue">dialogue</option>
                <option value="news">news</option>
                <option value="lecture">lecture</option>
              </select>
              <select className="border rounded px-2 py-1" value={draft.register||"neutral"} onChange={e=> setDraft({ ...draft, register: e.target.value })}>
                <option value="casual">casual</option>
                <option value="neutral">neutral</option>
                <option value="formal">formal</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">正文</div>
          <textarea className="w-full border rounded px-2 py-1" rows={12} value={draft.text||""} onChange={e=> setDraft({ ...draft, text: e.target.value })} />
        </div>
        <div>
          <div className="text-sm text-gray-500">Notes JSON</div>
          <textarea className="w-full border rounded px-2 py-1 font-mono" rows={10} value={JSON.stringify(draft.notes||{}, null, 2)} onChange={e=> { try{ setDraft({ ...draft, notes: JSON.parse(e.target.value) }); } catch {} }} />
        </div>
        
        {/* 翻译卡片 */}
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">翻译</h3>
            <div className="flex items-center gap-2">
              <select 
                className="border rounded px-2 py-1 text-sm" 
                value={transProvider} 
                onChange={e => handleProviderChange(e.target.value)}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
              </select>
              <select 
                className="border rounded px-2 py-1 text-sm" 
                value={transModel} 
                onChange={e => setTransModel(e.target.value)}
                disabled={modelsLoading || !availableModels[transProvider]}
              >
                {modelsLoading ? (
                  <option value="loading">加载中...</option>
                ) : availableModels[transProvider] ? (
                  availableModels[transProvider].map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value="no-models">无可用模型</option>
                )}
              </select>
              <input 
                type="number" 
                step="0.1" 
                min="0" 
                max="1" 
                className="border rounded px-2 py-1 text-sm w-20" 
                value={transTemperature} 
                onChange={e => setTransTemperature(Number(e.target.value))}
                placeholder="温度"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm" 
              onClick={() => generateTranslations(false)}
              disabled={transLoading}
            >
              {transLoading ? "生成中..." : "生成/补齐翻译"}
            </button>
            <button 
              className="px-3 py-1 rounded border text-sm" 
              onClick={() => generateTranslations(true)}
              disabled={transLoading}
            >
              重新生成
            </button>
          </div>
          
          {Object.keys(translations).length > 0 && (
            <div className="space-y-3">
              {getTargetLanguages(draft.lang).map(targetLang => (
                <div key={targetLang}>
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    {getLangName(targetLang)}:
                  </div>
                  <textarea 
                    className="w-full border rounded px-2 py-1 text-sm" 
                    rows={4}
                    value={translations[targetLang] || ''}
                    onChange={e => {
                      const newTranslations = { ...translations };
                      newTranslations[targetLang] = e.target.value;
                      setTranslations(newTranslations);
                    }}
                    placeholder={`${getLangName(targetLang)}翻译...`}
                  />
                </div>
              ))}
            </div>
          )}
          
          {draft.trans_updated_at && (
            <div className="text-xs text-gray-500">
              最后更新: {new Date(draft.trans_updated_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={save} disabled={saving}>保存</button>
          <button className="px-4 py-2 rounded border" onClick={synthAndAttach} disabled={ttsLoading}>生成语音并写入</button>
          <button className="px-4 py-2 rounded border" onClick={publish}>发布</button>
          <div className="text-sm text-gray-500">{log}</div>
        </div>
        {audioUrl && (
          <audio controls src={audioUrl} className="w-full" />
        )}
      </div>
    </div>
  );
}



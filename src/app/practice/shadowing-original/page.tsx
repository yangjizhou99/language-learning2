"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { supabase } from "@/lib/supabase";
import { Play, Pause, RotateCcw, ArrowRight, Shuffle } from "lucide-react";

// 题目数据类型
interface ShadowingItem {
  id: string;
  lang: "ja" | "en" | "zh";
  level: number;
  title: string;
  text: string;
  audio_url: string;
  duration_ms?: number;
  tokens?: number;
  cefr?: string;
  meta?: Record<string, unknown>;
}

export default function ShadowingOriginalPage() {
  const [lang, setLang] = useState<"ja" | "en" | "zh">("ja");
  const [level, setLevel] = useState<number>(2);
  const [recommendedLevel, setRecommendedLevel] = useState<number>(2);
  const [currentItem, setCurrentItem] = useState<ShadowingItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{id: string, email?: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [practiceStartTime, setPracticeStartTime] = useState<Date | null>(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // 获取认证头
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // 检查用户认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        setAuthLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  // 获取推荐等级
  const fetchRecommendedLevel = useCallback(async () => {
    if (!user) return;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/recommended?lang=${lang}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setRecommendedLevel(data.recommended);
        if (!currentItem) {
          setLevel(data.recommended);
        }
      }
    } catch (error) {
      console.error('Failed to fetch recommended level:', error);
    }
  }, [lang, user, currentItem]);

  // 获取下一题
  const getNextItem = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/next?lang=${lang}&level=${level}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setCurrentItem(data.item);
        setPracticeStartTime(new Date());
        setPracticeComplete(false);
        setAudioChunks([]);
      } else {
        const errorData = await response.json();
        alert(`获取题目失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to fetch next item:', error);
      alert('获取题目失败');
    } finally {
      setLoading(false);
    }
  }, [lang, level]);

  // 播放音频
  const playAudio = () => {
    if (!currentItem?.audio_url) return;
    
    const audio = new Audio(currentItem.audio_url);
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      alert('音频播放失败');
    };
    audio.play();
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      recorder.onstop = () => {
        setAudioChunks(chunks);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('录音失败，请检查麦克风权限');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // 记录练习结果
  const recordPracticeResult = async () => {
    if (!currentItem || !practiceStartTime) return;
    
    const practiceTime = Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000);
    
    // 模拟评分数据（实际应用中应该使用语音识别API）
    const metrics = {
      accuracy: Math.random() * 0.3 + 0.7, // 70-100% 随机准确率
      complete: true,
      time_sec: practiceTime,
      replays: Math.floor(Math.random() * 3) + 1
    };

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/shadowing/attempts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: currentItem.id,
          lang: currentItem.lang,
          level: currentItem.level,
          metrics
        })
      });

      if (response.ok) {
        setPracticeComplete(true);
        alert(`练习完成！准确率: ${(metrics.accuracy * 100).toFixed(1)}%`);
      } else {
        const errorData = await response.json();
        alert(`记录练习结果失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to record practice result:', error);
      alert('记录练习结果失败');
    }
  };

  // 重置练习
  const resetPractice = () => {
    setCurrentItem(null);
    setPracticeStartTime(null);
    setPracticeComplete(false);
    setAudioChunks([]);
    setRecording(false);
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
  };

  // 当语言改变时获取推荐等级
  useEffect(() => {
    if (!authLoading && user) {
      fetchRecommendedLevel();
    }
  }, [lang, authLoading, user, fetchRecommendedLevel]);

  if (authLoading) {
    return (
      <Container>
        <div className="p-8 text-center">
          <div className="text-lg">检查登录状态...</div>
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container>
        <div className="p-8 text-center">
          <div className="text-lg mb-4">请先登录</div>
          <Button onClick={() => window.location.href = '/auth'}>
            去登录
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Breadcrumbs items={[
        { label: "首页", href: "/" },
        { label: "Shadowing 跟读练习", href: "/practice/shadowing" }
      ]} />

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Shadowing 跟读练习</h1>
        
        {/* 控制面板 */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="lang">语言</Label>
              <Select value={lang} onValueChange={(value: "ja" | "en" | "zh") => setLang(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ja">日语</SelectItem>
                  <SelectItem value="en">英语</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="level">等级</Label>
              <Select value={level.toString()} onValueChange={(value) => setLevel(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">L1 - 超短句</SelectItem>
                  <SelectItem value="2">L2 - 短句</SelectItem>
                  <SelectItem value="3">L3 - 中等篇幅</SelectItem>
                  <SelectItem value="4">L4 - 较长</SelectItem>
                  <SelectItem value="5">L5 - 长句</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={getNextItem} disabled={loading} className="w-full">
                {loading ? "获取中..." : "获取下一题"}
              </Button>
            </div>
          </div>
          
          {recommendedLevel !== level && (
            <div className="text-sm text-blue-600 mb-4">
              系统推荐等级: L{recommendedLevel}
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => setLevel(recommendedLevel)}
                className="ml-2"
              >
                使用推荐等级
              </Button>
            </div>
          )}
        </Card>

        {/* 练习区域 */}
        {currentItem && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{currentItem.title}</h2>
            
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <Button onClick={playAudio} disabled={isPlaying}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "播放中..." : "播放音频"}
                </Button>
                
                <Button 
                  onClick={recording ? stopRecording : startRecording}
                  variant={recording ? "destructive" : "outline"}
                >
                  {recording ? "停止录音" : "开始录音"}
                </Button>
                
                <Button onClick={resetPractice} variant="outline">
                  <RotateCcw className="w-4 h-4" />
                  重新开始
                </Button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">
                  {currentItem.text}
                </p>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                等级: L{currentItem.level} | 
                语言: {currentItem.lang === 'ja' ? '日语' : currentItem.lang === 'en' ? '英语' : '中文'} |
                时长: {currentItem.duration_ms ? Math.round(currentItem.duration_ms / 1000) : '未知'}秒
              </div>
              
              <Button 
                onClick={recordPracticeResult}
                disabled={practiceComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                {practiceComplete ? "已完成" : "记录练习结果"}
              </Button>
            </div>
          </Card>
        )}

        {!currentItem && (
          <Card className="p-6 text-center">
            <p className="text-gray-600 mb-4">点击"获取下一题"开始练习</p>
          </Card>
        )}
      </div>
    </Container>
  );
}
